"use client";

// The capture side of an interview-prep session, voice or typed, as one hook.
//
// A voice interview is one MediaStream with two taps (see app/lib/voice/capture):
//   - MediaRecorder (Opus, 24 kbps, 250 ms chunks) -> the part queue -> S3 by
//     presigned POST. This is the record: the report is built from it.
//   - live captions: 16 kHz PCM frames -> the voice gateway -> AWS streaming,
//     or the browser's SpeechRecognition when the service says `web-speech`,
//     when the gateway gives up (`limited`, `unavailable`, a spent ticket), or
//     when the page cannot run the PCM tap. A browser with neither (Firefox)
//     gets no captions; the page then sends answers on mic-level silence.
// Captions are a convenience and fail cheaply. Nothing about them can stop the
// recording, and the report transcript always comes from AWS batch.
//
// Every time here is on one session clock whose zero is the recorder's `start`
// event, because that is where the stored audio begins: the interviewer's
// turns, the answer windows and the caption times all have to point at the
// right second of the recording for the report's "▶ 3:42" chips to work.
// A typed session has no recording, so its zero is simply when it began; its
// turn times are kept for the same report, minus the audio.
//
// Why the work lives in a plain closure rather than in React state: the
// recorder, the queue, the socket and the timers must outlive re-renders, and
// the finish has to keep running when the component goes away mid-session (an
// in-app navigation keeps the JavaScript alive, so the last parts can still be
// uploaded and the session finished). React only sees a snapshot, through
// useSyncExternalStore, and the mic level goes to subscribers directly, as
// useVoiceSession does, so nothing re-renders at 60 fps.
//
// Leaving:
//  - `end` stops the captions, stops the recorder, lets the queue drain, and
//    finishes the session. When the service reports parts it has not got, the
//    queue re-sends them from the blobs it kept, at most twice: a part the
//    queue never had cannot be filled, and the abandon sweep finishes the rest.
//  - the tab closing (`pagehide`) sends the same finish as a beacon, with what
//    is known at that moment; `beforeunload` warns while audio is still going up.
//  - unmounting mid-session finishes it as `ended-early` in the background, or
//    deletes it when nothing was answered yet, and always releases the mic,
//    the worklet, the recorder and the socket.
//
// Nothing here logs. The stream ticket and the part URLs are credentials.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BackendError } from "@/app/lib/api/core";
import { beaconFinish, deletePrepSession, finishPrepSession, getPartUrls, getStreamTicket, PREP_PATH } from "@/app/lib/voice/api";
import { createSessionClock, type SessionClock } from "@/app/lib/voice/capture/clock";
import { createMicLevel, type MicLevel } from "@/app/lib/voice/capture/micLevel";
import { createPartQueue, type PartQueue } from "@/app/lib/voice/capture/partQueue";
import { pcmTap, pcmTapSupported, type PcmTap } from "@/app/lib/voice/capture/pcmTap";
import { createRecorder, recorderSupported, type Recorder } from "@/app/lib/voice/capture/recorder";
import { connectRelay, type Relay } from "@/app/lib/voice/capture/relayStream";
import { postPart } from "@/app/lib/voice/capture/s3Upload";
import { formatClock } from "@/app/lib/voice/format";
import {
  PREP_LIMITS,
  type CapReason,
  type CreatePrepSessionResult,
  type EndReason,
  type FinishPrepSessionInput,
  type FinishPrepSessionResult,
  type LiveSttProvider,
  type PrepSessionMode,
  type PrepSessionStatus,
  type PrepTurnInput,
  type TurnSource,
  type TurnSpeaker,
} from "@/app/lib/voice/types";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * One voice for one analysis. Echo cancellation and noise suppression keep the
 * interviewer and the room out; automatic gain stays off because it flattens
 * exactly the loudness changes the delivery analysis measures (iOS may ignore
 * this, and the prosody service warns when it suspects so).
 */
export const INTERVIEW_MIC_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
};

/** The warning shows this long before the cap. */
export const CAP_WARNING_MS = 60_000;
/**
 * The parts/urls call is also the session's heartbeat; the abandon sweep
 * finishes a session silent for 20 minutes, so a few minutes is plenty.
 */
const HEARTBEAT_MS = 2 * 60_000;
/**
 * Parts that failed for good (a connection down for longer than the queue's
 * backoff) are sent again this often while the session runs, and at once when
 * the browser says it is back online, so an outage mid-interview costs no
 * audio as long as the tab stays open.
 */
const PART_RETRY_MS = 30_000;
/** The elapsed clock and the cap backstop tick at this rate; the snapshot changes once a second. */
const TICK_MS = 250;
/** A recorder whose `start` event never arrives still gets a clock after this. */
const CLOCK_FALLBACK_MS = 2_000;
/** Finish calls answered with `uploading`, re-sent after re-uploading the missing parts. */
const FINISH_ROUNDS_MAX = 2;
/** One finish call's tries on a network or server failure. */
const FINISH_ATTEMPTS = 3;
const FINISH_BACKOFF_MS = [1_000, 3_000];
/**
 * The service accepts answer times up to a minute past the cap (the recorder
 * stops at the cap; the submit lands after). A little under that, so a clock
 * that ran slightly long is clamped rather than refused.
 */
const VOICE_TURN_GRACE_MS = 55_000;
/** A typed session's turn times are only checked against 12 hours. */
const TEXT_TURN_MAX_MS = 12 * 60 * 60_000;
/** A browser recognizer that ends this soon after starting failed to start. */
const RECOGNITION_QUICK_END_MS = 1_000;
const RECOGNITION_MAX_QUICK_ENDS = 3;

const MIC_DENIED = "Your browser blocked the microphone. Allow it for this site, then try again.";
const MIC_UNAVAILABLE = "We couldn't use a microphone. Check one is connected and not in use by another app.";
const MIC_LOST = "Your microphone stopped. End the session to save what was recorded.";
const RECORDING_STOPPED = "The recording stopped unexpectedly. End the session to save what was recorded.";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * - `idle`: nothing started.
 * - `starting`: begin() is getting the mic and starting the recorder.
 * - `live`: the session is running.
 * - `ending`: end() is stopping captions and the recorder.
 * - `saving`: the last parts are going up and the session is being finished.
 * - `done`: finished, discarded, or closed with the tab.
 * - `failed`: begin() could not start; `error` says why.
 */
export type CaptureStatus = "idle" | "starting" | "live" | "ending" | "saving" | "done" | "failed";

/** `unavailable` covers no microphone, one another app holds, and a track that ended mid-session. */
export type CaptureMicStatus = "idle" | "requesting" | "live" | "denied" | "unavailable";

/** Whether anything is writing captions right now. `none` is Firefox without a gateway, or a recognizer that could not run. */
export type CaptionState = "live" | "none";

export type CapEndReason = Extract<EndReason, "credit-limit" | "time-limit">;

/** A turn as the page knows it; the hook adds the times it recorded. */
export interface CaptureTurn {
  id: string;
  who: TurnSpeaker;
  text: string;
  questionId?: string;
  /** The captions as shown for this answer, before any edit. */
  liveText?: string;
  source: TurnSource;
}

export interface CaptureTurnTimes {
  startMs?: number;
  endMs?: number;
  bargedIn?: boolean;
}

/** A finished caption. Times are on the session clock; null from the browser's recognizer, which has none. */
export interface CaptureCaption {
  text: string;
  startMs: number | null;
  endMs: number | null;
}

export interface CaptureUpload {
  sent: number;
  pending: number;
  failed: number;
}

export interface CaptureWarning {
  reason: CapReason;
  /** "1 minute left — recording stops at 13:00, your credit limit." */
  message: string;
  stopsAtMs: number;
}

export interface CaptureEndResult {
  sessionId: string;
  /** The service's answer; null when no finish call got through (the abandon sweep then finishes it). */
  status: PrepSessionStatus | null;
  missingParts: number[];
  /** A finish call was answered. */
  saved: boolean;
}

export type BeginResult = { ok: true } | { ok: false; error: string };

export interface AiEndOptions {
  /** The user spoke over the interviewer, which cut its speech short. */
  bargedIn?: boolean;
  /** When it ended on the session clock, if not now; never later than now or earlier than its start. */
  atMs?: number;
}

export interface InterviewCaptureOptions {
  /** Each finished caption, in order. Called for AWS and browser captions alike. */
  onFinal?: (caption: CaptureCaption) => void;
  /**
   * Sustained speech on the mic (a voice session only). Repeats while it lasts;
   * the page decides whether it interrupts the interviewer.
   */
  onBargeIn?: () => void;
  /** Recording stopped at the cap. The page closes the interview and calls `end` with this reason. */
  onCap?: (reason: CapEndReason) => void;
  /** The turns as they stand, for a finish the page cannot run itself (tab closing, unmount). */
  getTurns?: () => CaptureTurn[];
  /** Sends the finish; defaults to the plain API call. The page passes its mutation so caches refresh. */
  finish?: (sessionId: string, body: FinishPrepSessionInput) => Promise<FinishPrepSessionResult>;
  /** Deletes a session that ended with nothing to keep; defaults to the plain API call. */
  remove?: (sessionId: string) => Promise<unknown>;
}

export interface BeginInput {
  config: CreatePrepSessionResult;
}

export interface CaptureSnapshot {
  status: CaptureStatus;
  mode: PrepSessionMode | null;
  sessionId: string | null;
  micStatus: CaptureMicStatus;
  /** Who writes the captions now: it moves from `aws-transcribe` to `web-speech` on a fallback. Null before begin and for typed sessions. */
  liveProvider: LiveSttProvider | null;
  captions: CaptionState;
  /** The caption still being recognised; empty once final. */
  interim: string;
  upload: CaptureUpload;
  /** Whole seconds, in ms, on the session clock. */
  elapsedMs: number;
  capMs: number | null;
  capReason: CapReason | null;
  warning: CaptureWarning | null;
  /** Set once recording stopped at the cap. */
  capReached: CapEndReason | null;
  /** The tab was hidden for good and the session was finished by beacon. */
  interrupted: boolean;
  /** A sentence for the person, or null. */
  error: string | null;
}

export interface InterviewCapture extends CaptureSnapshot {
  /** True while an answer is still being recognised, so a send-on-silence waits. */
  finalizing: boolean;
  /** Mic level 0-1 on every animation frame; returns an unsubscribe. Works before begin (it hears 0 until then). */
  onLevel: (listener: (level: number) => void) => () => void;
  /** Asks for the mic ahead of creating a session, so a refusal costs no session. */
  requestMic: () => Promise<boolean>;
  /** Releases a mic taken by requestMic when no session follows. */
  releaseMic: () => void;
  begin: (input: BeginInput) => Promise<BeginResult>;
  /** The session clock now, in ms (0 before it starts). */
  now: () => number;
  /**
   * The interviewer's turn begins: now (its speech's `start`), or at `atMs` on
   * the session clock for a question that went up before any speech did. First
   * call per turn wins.
   */
  markAiStart: (turnId: string, atMs?: number) => void;
  /** The interviewer's turn ends: now, or at an earlier `atMs`. First call per turn wins. */
  markAiEnd: (turnId: string, options?: AiEndOptions) => void;
  /** Closes an answer window: from the interviewer's last turn ending to now. First call per turn wins. */
  markAnswer: (turnId: string) => void;
  timesOf: (turnId: string) => CaptureTurnTimes | undefined;
  end: (reason: EndReason, turns: CaptureTurn[]) => Promise<CaptureEndResult>;
  /** Stops everything and deletes the session: for a session that ended before anything worth keeping. */
  discard: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// The snapshot store
// ---------------------------------------------------------------------------

const INITIAL_SNAPSHOT: CaptureSnapshot = {
  status: "idle",
  mode: null,
  sessionId: null,
  micStatus: "idle",
  liveProvider: null,
  captions: "none",
  interim: "",
  upload: { sent: 0, pending: 0, failed: 0 },
  elapsedMs: 0,
  capMs: null,
  capReason: null,
  warning: null,
  capReached: null,
  interrupted: false,
  error: null,
};

export interface CaptureStore {
  get: () => CaptureSnapshot;
  set: (patch: Partial<CaptureSnapshot>) => void;
  subscribe: (listener: () => void) => () => void;
}

function sameUpload(a: CaptureUpload, b: CaptureUpload): boolean {
  return a.sent === b.sent && a.pending === b.pending && a.failed === b.failed;
}

export function createCaptureStore(): CaptureStore {
  let snapshot = INITIAL_SNAPSHOT;
  const listeners = new Set<() => void>();
  return {
    get: () => snapshot,
    set(patch) {
      let changed = false;
      for (const key of Object.keys(patch) as Array<keyof CaptureSnapshot>) {
        const next = patch[key];
        const current = snapshot[key];
        if (key === "upload" ? !sameUpload(current as CaptureUpload, next as CaptureUpload) : !Object.is(current, next)) {
          changed = true;
          break;
        }
      }
      // A new object only on a real change, as useSyncExternalStore requires.
      if (!changed) return;
      snapshot = { ...snapshot, ...patch };
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Browser speech recognition, the caption fallback
// ---------------------------------------------------------------------------

// TypeScript's DOM lib does not ship the Web Speech recognition types.
interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: RecognitionResultLike };
}
interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Errors a fresh recognizer would only meet again. */
const RECOGNITION_FATAL: ReadonlySet<string> = new Set(["not-allowed", "service-not-allowed", "language-not-supported", "audio-capture"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPermissionError(error: unknown): boolean {
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError";
}

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Already stopped.
    }
  });
}

function newAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A 4xx the service will answer the same way again (a timeout or a rate limit may pass). */
function isFinalRefusal(error: unknown): boolean {
  return error instanceof BackendError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}

const hasAnswer = (turns: readonly CaptureTurn[]): boolean => turns.some((turn) => turn.who === "user");

function withoutTimes(turn: PrepTurnInput): PrepTurnInput {
  const copy = { ...turn };
  delete copy.startMs;
  delete copy.endMs;
  return copy;
}

/**
 * Deletes from `pagehide`, where an ordinary request is cancelled with the
 * page. `keepalive` lets it outlive the document; the proxy forwards DELETE
 * without a body.
 */
function deleteOnUnload(sessionId: string) {
  try {
    void fetch(`${PREP_PATH}/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      keepalive: true,
      credentials: "same-origin",
      headers: { accept: "application/json" },
    }).catch(() => {});
  } catch {
    // Nothing more to try; the abandon sweep finishes the session instead.
  }
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

export interface EngineEnv {
  store: CaptureStore;
  options: () => InterviewCaptureOptions;
  publishLevel: (level: number) => void;
}

export interface CaptureEngine {
  requestMic: () => Promise<boolean>;
  releaseMic: () => void;
  begin: (input: BeginInput) => Promise<BeginResult>;
  now: () => number;
  markAiStart: (turnId: string, atMs?: number) => void;
  markAiEnd: (turnId: string, options?: AiEndOptions) => void;
  markAnswer: (turnId: string) => void;
  timesOf: (turnId: string) => CaptureTurnTimes | undefined;
  end: (reason: EndReason, turns: CaptureTurn[]) => Promise<CaptureEndResult>;
  discard: () => Promise<void>;
  /** The component is gone: finish or delete in the background, release everything, go quiet. */
  dispose: () => void;
}

/**
 * The engine behind the hook, exported so it can be exercised without React
 * (the frontend has no test runner; a scratch harness drives it with a fake
 * MediaRecorder and API).
 */
export function createCaptureEngine(env: EngineEnv): CaptureEngine {
  // Once disposed, the engine keeps working in the background (a finish may
  // still be running) but no longer writes to a snapshot nobody reads.
  let muted = false;
  const set = (patch: Partial<CaptureSnapshot>) => {
    if (!muted) env.store.set(patch);
  };

  const clock: SessionClock = createSessionClock();
  let begun = false;
  /** Finished, discarded or closed with the tab: nothing more goes to the service. */
  let closed = false;
  let ending: Promise<CaptureEndResult> | null = null;

  let sessionId: string | null = null;
  let mode: PrepSessionMode | null = null;
  let capMs: number | null = null;
  let capReason: CapReason | null = null;
  let startedAtWall: number | null = null;
  let capHit = false;
  let warned = false;

  let stream: MediaStream | null = null;
  let requesting: Promise<boolean> | null = null;
  let audioCtx: AudioContext | null = null;
  let recorder: Recorder | null = null;
  let queue: PartQueue | null = null;
  let unsubscribeQueue: (() => void) | null = null;
  let meter: MicLevel | null = null;
  let tap: PcmTap | null = null;
  let tapAbort: AbortController | null = null;
  let relay: Relay | null = null;
  let recognition: RecognitionLike | null = null;
  let recognitionWanted = false;

  let ticker: ReturnType<typeof setInterval> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let partRetry: ReturnType<typeof setInterval> | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let pageHooks: (() => void) | null = null;

  const times = new Map<string, CaptureTurnTimes>();
  let lastAiTurn: string | null = null;
  let lastAnswerEnd = 0;
  /** What `end` was called with, for a beacon while that finish is still out. */
  let endingWith: { reason: EndReason; turns: CaptureTurn[] } | null = null;
  /** The last body a finish call sent. */
  let lastBody: FinishPrepSessionInput | null = null;

  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, Math.max(0, ms));
    timers.add(timer);
  };

  function clearTimers() {
    if (ticker !== null) clearInterval(ticker);
    if (heartbeat !== null) clearInterval(heartbeat);
    if (partRetry !== null) clearInterval(partRetry);
    ticker = null;
    heartbeat = null;
    partRetry = null;
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  }

  // --- the mic ---------------------------------------------------------------

  function watchTracks(media: MediaStream) {
    media.getAudioTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (closed || stream !== media) return;
        set({ micStatus: "unavailable", error: MIC_LOST });
      });
    });
  }

  function requestMic(): Promise<boolean> {
    if (stream && stream.getAudioTracks().some((track) => track.readyState === "live")) return Promise.resolve(true);
    if (requesting) return requesting;
    const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!media || typeof media.getUserMedia !== "function") {
      set({ micStatus: "unavailable", error: MIC_UNAVAILABLE });
      return Promise.resolve(false);
    }
    set({ micStatus: "requesting", error: null });
    const pending = media.getUserMedia({ audio: INTERVIEW_MIC_CONSTRAINTS }).then(
      (got) => {
        if (muted || closed) {
          stopTracks(got);
          return false;
        }
        stream = got;
        watchTracks(got);
        set({ micStatus: "live" });
        return true;
      },
      (error: unknown) => {
        const denied = isPermissionError(error);
        set({ micStatus: denied ? "denied" : "unavailable", error: denied ? MIC_DENIED : MIC_UNAVAILABLE });
        return false;
      },
    );
    requesting = pending.finally(() => {
      requesting = null;
    });
    return requesting;
  }

  function releaseMedia() {
    meter?.stop();
    meter = null;
    if (stream) stopTracks(stream);
    stream = null;
    if (audioCtx) void audioCtx.close().catch(() => {});
    audioCtx = null;
    env.publishLevel(0);
  }

  function releaseMic() {
    if (begun) return;
    releaseMedia();
    set({ micStatus: "idle" });
  }

  // --- the clock, the cap and the warning -------------------------------------

  function startClock() {
    if (!clock.started) clock.start();
    if (startedAtWall !== null) return;
    startedAtWall = Date.now();
    if (capMs === null) return;
    const at = clock.now();
    later(warn, capMs - CAP_WARNING_MS - at);
    later(reachCap, capMs - at);
  }

  function warn() {
    if (warned || closed || ending || capMs === null) return;
    warned = true;
    const reason = capReason ?? "length";
    const why = reason === "credits" ? "your credit limit" : "the session limit";
    set({ warning: { reason, stopsAtMs: capMs, message: `1 minute left — recording stops at ${formatClock(capMs)}, ${why}.` } });
  }

  function reachCap() {
    if (capHit || closed || ending) return;
    capHit = true;
    const reason: CapEndReason = capReason === "credits" ? "credit-limit" : "time-limit";
    // Nothing past the cap is recorded, whatever the page does next; the
    // service trims to the cap as well, so a late stop costs nothing.
    void stopCaptions(false);
    void recorder?.stop();
    set({ capReached: reason, warning: null });
    env.options().onCap?.(reason);
  }

  function startTicker() {
    if (ticker !== null) return;
    ticker = setInterval(() => {
      if (!clock.started) return;
      const at = clock.now();
      set({ elapsedMs: Math.floor(at / 1000) * 1000 });
      // Backstops for timers a background tab throttled.
      if (capMs !== null && !capHit) {
        if (at >= capMs) reachCap();
        else if (at >= capMs - CAP_WARNING_MS) warn();
      }
    }, TICK_MS);
  }

  // --- captions -----------------------------------------------------------------

  function emitFinal(caption: CaptureCaption) {
    if (!caption.text.trim() || closed) return;
    try {
      env.options().onFinal?.(caption);
    } catch {
      // The page's problem; captions carry on.
    }
  }

  function startWebSpeech() {
    const Ctor = recognitionCtor();
    set({ liveProvider: "web-speech", interim: "" });
    if (!Ctor || closed || capHit || ending) {
      set({ captions: "none" });
      return;
    }
    recognitionWanted = true;
    let quickEnds = 0;

    const run = (): boolean => {
      const rec = new Ctor();
      const startedAt = performance.now();
      let fatal = false;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (event) => {
        if (recognition !== rec) return;
        let finalText = "";
        let partial = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else partial += result[0].transcript;
        }
        set({ interim: partial });
        if (finalText.trim()) emitFinal({ text: finalText, startMs: null, endMs: null });
      };
      rec.onerror = (event) => {
        if (RECOGNITION_FATAL.has(event.error ?? "")) fatal = true;
      };
      // A continuous recognizer still ends whenever the browser decides (a
      // pause, a network blip, Safari after each utterance). A fresh one takes
      // over while captions are wanted, within bounds, so one that can never
      // run does not spin.
      rec.onend = () => {
        if (recognition !== rec) return;
        recognition = null;
        set({ interim: "" });
        quickEnds = performance.now() - startedAt < RECOGNITION_QUICK_END_MS ? quickEnds + 1 : 0;
        if (recognitionWanted && !fatal && quickEnds < RECOGNITION_MAX_QUICK_ENDS && run()) return;
        recognitionWanted = false;
        set({ captions: "none" });
      };
      recognition = rec;
      try {
        rec.start();
      } catch {
        recognition = null;
        return false;
      }
      return true;
    };

    const running = run();
    if (!running) recognitionWanted = false;
    set({ captions: running ? "live" : "none" });
  }

  async function startRelay(media: MediaStream, gatewayUrl: string, ticket: string) {
    const id = sessionId as string;
    let fellBack = false;
    let interimText = "";

    const fallBack = () => {
      if (fellBack) return;
      fellBack = true;
      tapAbort?.abort();
      tap = null;
      const current = relay;
      relay = null;
      current?.close();
      set({ interim: "" });
      startWebSpeech();
    };

    set({ liveProvider: "aws-transcribe", captions: "live" });
    const current = connectRelay({
      gatewayUrl,
      ticket,
      getTicket: () => getStreamTicket(id),
      onPartial: (caption) => {
        interimText = caption.text;
        set({ interim: caption.text });
      },
      onFinal: (caption) => {
        interimText = "";
        set({ interim: "" });
        emitFinal({ text: caption.text, startMs: caption.startMs, endMs: caption.endMs });
      },
      // Partials from the dropped socket will never be finalised.
      onReconnect: () => {
        if (interimText.trim()) emitFinal({ text: interimText, startMs: null, endMs: null });
        interimText = "";
        set({ interim: "" });
      },
      onError: (error) => {
        if (!error.fatal || relay !== current) return;
        if (error.code === "cap") reachCap();
        else fallBack();
      },
    });
    relay = current;

    const abort = new AbortController();
    tapAbort = abort;
    const started = await pcmTap(media, {
      clock,
      context: audioCtx ?? undefined,
      signal: abort.signal,
      onFrame: (frame, atMs) => relay?.send(frame, atMs),
      onError: () => {
        if (relay === current) fallBack();
      },
    });
    if (abort.signal.aborted) {
      started?.stop();
      return;
    }
    if (!started) {
      // No AudioWorklet here (an old browser, an insecure page): the socket has nothing to carry.
      fallBack();
      return;
    }
    tap = started;
  }

  /** Stops whichever captions run. `graceful` asks the gateway for its last finals and resolves when they are in. */
  function stopCaptions(graceful: boolean): Promise<void> {
    recognitionWanted = false;
    const rec = recognition;
    recognition = null;
    try {
      rec?.abort();
    } catch {
      // Already ended.
    }
    // The tap first: stopping it hands its padded last frame to the relay.
    tapAbort?.abort();
    tap?.stop();
    tap = null;
    const current = relay;
    relay = null;
    set({ interim: "" });
    if (!current) return Promise.resolve();
    if (!graceful) {
      current.close();
      return Promise.resolve();
    }
    return current.stop().then(
      () => undefined,
      () => undefined,
    );
  }

  // --- the page going away ---------------------------------------------------

  function currentTurns(): CaptureTurn[] {
    try {
      return env.options().getTurns?.() ?? [];
    } catch {
      return [];
    }
  }

  function onPageHide() {
    if (!begun || !sessionId || closed) return;
    if (ending) {
      // A finish is under way and may not land before the page goes: send
      // what it would send, with the parts cut so far.
      const body = lastBody ?? (endingWith ? buildBody(endingWith.reason, endingWith.turns) : null);
      if (body) beaconFinish(sessionId, queue ? { ...body, parts: queue.manifest() } : body);
      return;
    }
    const turns = currentTurns();
    closed = true;
    if (!hasAnswer(turns)) {
      deleteOnUnload(sessionId);
    } else {
      const body = buildBody("pagehide", turns);
      beaconFinish(sessionId, queue ? { ...body, parts: queue.manifest() } : body);
    }
    void stopCaptions(false);
    void recorder?.stop();
    releaseMedia();
    clearTimers();
    set({ status: "done", interrupted: true, interim: "" });
  }

  // Engine state rather than the snapshot: a finish running on after the page
  // unmounted no longer writes one. A live voice session always has audio on
  // its way up (a part is cut every few seconds), and a finish in progress
  // may still be sending the last of it.
  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!begun || closed) return;
    if (mode !== "voice" && !ending) return;
    event.preventDefault();
    // Older engines (Chrome and Edge before 119) only prompt when this is
    // truthy; an empty string counts as "no prompt".
    event.returnValue = true;
  }

  function onVisibility() {
    // Whatever is buffered starts uploading before the tab is throttled or closed.
    if (document.visibilityState === "hidden") queue?.flush();
  }

  /** Parts that failed for good go again. Not once the queue is past the cap: those would only be refused again. */
  function retryFailedParts() {
    if (!queue || closed || ending) return;
    const state = queue.getState();
    if (state.failed > 0 && !state.capped) queue.retry();
  }

  function installPageHooks() {
    if (pageHooks || typeof window === "undefined") return;
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", retryFailedParts);
    document.addEventListener("visibilitychange", onVisibility);
    pageHooks = () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", retryFailedParts);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }

  function removePageHooks() {
    pageHooks?.();
    pageHooks = null;
  }

  // --- begin ------------------------------------------------------------------

  // The service session still exists after this, so it is not `closed`: the
  // page discards it (or the unmount does).
  function failBegin(error: string): BeginResult {
    void stopCaptions(false);
    void recorder?.stop();
    queue?.abort();
    releaseMedia();
    clearTimers();
    removePageHooks();
    set({ status: "failed", error, interim: "" });
    return { ok: false, error };
  }

  async function begin({ config }: BeginInput): Promise<BeginResult> {
    if (begun) return { ok: false, error: "This session has already started." };
    begun = true;
    const id = config.session.id;
    sessionId = id;
    mode = config.session.mode;
    capMs = mode === "voice" ? config.capMs : null;
    capReason = mode === "voice" ? config.capReason : null;
    set({
      sessionId: id,
      mode,
      capMs,
      capReason,
      status: "starting",
      error: null,
      liveProvider: mode === "voice" ? config.liveProvider : null,
      captions: "none",
      warning: null,
      capReached: null,
    });

    if (mode === "text") {
      startClock();
      installPageHooks();
      startTicker();
      set({ status: "live" });
      return { ok: true };
    }

    if (capMs === null || capMs <= 0) return failBegin("This session has no recording time left.");
    if (!recorderSupported()) return failBegin("This browser can't record audio. A typed session works everywhere.");
    if (!(await requestMic()) || !stream) {
      const error = env.store.get().error ?? MIC_UNAVAILABLE;
      return failBegin(error);
    }
    if (muted || closed) return failBegin("The session was closed before it started.");
    const media = stream;

    audioCtx = newAudioContext();
    const partQueue = createPartQueue({
      maxParts: config.maxParts,
      partMaxBytes: config.partMaxBytes > 0 ? config.partMaxBytes : undefined,
      urls: config.partUrls,
      getUrls: (from) => getPartUrls(id, from),
      upload: postPart,
    });
    queue = partQueue;
    unsubscribeQueue = partQueue.subscribe(() => {
      const state = partQueue.getState();
      set({ upload: { sent: state.sent, pending: state.pending, failed: state.failed } });
    });

    try {
      recorder = createRecorder(media, {
        clock,
        onChunk: (blob, atMs) => partQueue.push(blob, atMs),
        onStart: () => startClock(),
        onError: () => {
          if (!closed) set({ error: RECORDING_STOPPED });
        },
      });
      recorder.start();
    } catch {
      return failBegin("The recording couldn't start. Try again, or start a typed session.");
    }
    // An engine that never fires `start` still needs a clock, a little late rather than never.
    later(() => startClock(), CLOCK_FALLBACK_MS);

    meter = createMicLevel(media, {
      context: audioCtx ?? undefined,
      onSustained: () => {
        if (!closed && !ending) env.options().onBargeIn?.();
      },
    });
    meter?.onLevel(env.publishLevel);

    installPageHooks();
    startTicker();
    heartbeat = setInterval(() => void partQueue.heartbeat(), HEARTBEAT_MS);
    partRetry = setInterval(retryFailedParts, PART_RETRY_MS);
    set({ status: "live", micStatus: "live" });

    // Without an AudioWorklet the socket would have nothing to carry, and
    // opening it would still spend the single-use ticket and a stream slot.
    if (config.liveProvider === "aws-transcribe" && config.gatewayUrl && config.streamTicket && pcmTapSupported()) {
      void startRelay(media, config.gatewayUrl, config.streamTicket);
    } else {
      startWebSpeech();
    }
    return { ok: true };
  }

  // --- turn times -----------------------------------------------------------

  /** `atMs` when it is a usable time no later than now; now otherwise. */
  function timeOrNow(atMs: number | undefined): number {
    const at = clock.now();
    return atMs !== undefined && Number.isFinite(atMs) ? Math.min(at, Math.max(0, atMs)) : at;
  }

  function markAiStart(turnId: string, atMs?: number) {
    if (!begun || times.has(turnId)) return;
    times.set(turnId, { startMs: timeOrNow(atMs) });
    lastAiTurn = turnId;
  }

  function markAiEnd(turnId: string, options?: AiEndOptions) {
    const entry = times.get(turnId);
    if (!entry || entry.endMs !== undefined) return;
    entry.endMs = Math.max(entry.startMs ?? 0, timeOrNow(options?.atMs));
    if (options?.bargedIn) entry.bargedIn = true;
  }

  function markAnswer(turnId: string) {
    if (!begun || times.has(turnId)) return;
    const ai = lastAiTurn ? times.get(lastAiTurn) : undefined;
    // The window opens when the interviewer stopped talking; a question still
    // being read when the answer was sent opens it when the question began.
    const startMs = Math.max(lastAnswerEnd, ai?.endMs ?? ai?.startMs ?? lastAnswerEnd);
    const endMs = Math.max(startMs, clock.now());
    times.set(turnId, { startMs, endMs });
    lastAnswerEnd = endMs;
  }

  function timesOf(turnId: string): CaptureTurnTimes | undefined {
    const entry = times.get(turnId);
    return entry ? { ...entry } : undefined;
  }

  // --- end ------------------------------------------------------------------

  function buildBody(reason: EndReason, turns: readonly CaptureTurn[]): FinishPrepSessionInput {
    const limit = mode === "voice" && capMs !== null ? capMs + VOICE_TURN_GRACE_MS : TEXT_TURN_MAX_MS;
    const clamp = (value: number | undefined): number | undefined =>
      value === undefined || !Number.isFinite(value) ? undefined : Math.min(limit, Math.max(0, Math.round(value)));

    const out = turns.slice(0, PREP_LIMITS.turnsMax).map((turn): PrepTurnInput => {
      const recorded = times.get(turn.id);
      const startMs = clamp(recorded?.startMs);
      let endMs = clamp(recorded?.endMs);
      if (startMs !== undefined && endMs !== undefined && endMs < startMs) endMs = startMs;
      const entry: PrepTurnInput = { id: turn.id, who: turn.who, text: turn.text.slice(0, PREP_LIMITS.turnTextMax), source: turn.source };
      if (turn.questionId) entry.questionId = turn.questionId;
      if (turn.liveText) entry.liveText = turn.liveText.slice(0, PREP_LIMITS.turnTextMax);
      if (startMs !== undefined) entry.startMs = startMs;
      if (endMs !== undefined) entry.endMs = endMs;
      if (recorded?.bargedIn) entry.bargedIn = true;
      return entry;
    });

    const endedAt = Date.now();
    const startedAt = Math.min(startedAtWall ?? endedAt, endedAt);
    return {
      turns: out,
      endReason: reason,
      clock: { startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString() },
    };
  }

  async function sendFinish(id: string, body: FinishPrepSessionInput): Promise<FinishPrepSessionResult | null> {
    const finish = env.options().finish ?? finishPrepSession;
    let payload = body;
    let strippedTimes = false;
    for (let attempt = 0; attempt < FINISH_ATTEMPTS; attempt++) {
      lastBody = payload;
      try {
        return await finish(id, payload);
      } catch (error) {
        if (error instanceof BackendError && error.status === 400 && !strippedTimes) {
          // A clock that disagrees with the service's bounds must not lose the
          // answers: send them once more without their times.
          strippedTimes = true;
          payload = { ...payload, turns: payload.turns.map(withoutTimes) };
          continue;
        }
        if (isFinalRefusal(error)) return null;
        if (attempt < FINISH_ATTEMPTS - 1) await sleep(FINISH_BACKOFF_MS[attempt] ?? 3_000);
      }
    }
    // The page may be about to go too; a beacon is the last word, the sweep the backstop.
    beaconFinish(id, payload);
    return null;
  }

  async function runEnd(reason: EndReason, turns: CaptureTurn[]): Promise<CaptureEndResult> {
    const id = sessionId;
    if (!begun || !id || closed) return { sessionId: id ?? "", status: null, missingParts: [], saved: false };
    set({ status: "ending", warning: null });

    // Captions first, so the tap stops feeding the socket; the gateway's last
    // finals are not waited for (the report transcript is batch) but the
    // socket still gets its clean stop in the background.
    void stopCaptions(true);
    if (recorder) await recorder.stop();
    releaseMedia();
    clearTimers();
    set({ status: "saving", elapsedMs: Math.floor(clock.now() / 1000) * 1000 });

    const body = buildBody(reason, turns);
    let result: FinishPrepSessionResult | null;
    if (!queue) {
      result = await sendFinish(id, body);
    } else {
      let parts = await queue.finish();
      result = await sendFinish(id, { ...body, parts: parts.manifest });
      for (let round = 0; round < FINISH_ROUNDS_MAX && result?.status === "uploading" && result.missingParts.length > 0; round++) {
        queue.retry(result.missingParts);
        parts = await queue.finish();
        result = await sendFinish(id, { ...body, parts: parts.manifest });
      }
    }

    closed = true;
    removePageHooks();
    unsubscribeQueue?.();
    unsubscribeQueue = null;
    set({ status: "done" });
    return { sessionId: id, status: result?.status ?? null, missingParts: result?.missingParts ?? [], saved: result !== null };
  }

  function end(reason: EndReason, turns: CaptureTurn[]): Promise<CaptureEndResult> {
    if (!ending) {
      endingWith = { reason, turns };
      ending = runEnd(reason, turns);
    }
    return ending;
  }

  async function discard(): Promise<void> {
    const id = sessionId;
    const wasOpen = begun && !closed && !ending;
    closed = true;
    capHit = true;
    void stopCaptions(false);
    void recorder?.stop();
    queue?.abort();
    unsubscribeQueue?.();
    unsubscribeQueue = null;
    releaseMedia();
    clearTimers();
    removePageHooks();
    set({ status: "done", interim: "" });
    if (!id || !wasOpen) return;
    const remove = env.options().remove ?? deletePrepSession;
    try {
      await remove(id);
    } catch {
      // A session that could not be deleted is finished by the abandon sweep.
    }
  }

  function dispose() {
    if (begun && sessionId && !closed && !ending) {
      const turns = currentTurns();
      if (hasAnswer(turns)) void end("ended-early", turns);
      else void discard();
    } else if (!begun) {
      releaseMedia();
      removePageHooks();
    }
    // A finish running on in the background keeps its page hooks (the tab may
    // still close before it lands) and removes them itself when it is done.
    muted = true;
  }

  return {
    requestMic,
    releaseMic,
    begin,
    now: () => clock.now(),
    markAiStart,
    markAiEnd,
    markAnswer,
    timesOf,
    end,
    discard,
    dispose,
  };
}

const CLOSED_ERROR = "This interview screen has closed.";

/** What a call gets once the page has gone: nothing starts, nothing is sent. */
const INERT_ENGINE: CaptureEngine = {
  requestMic: () => Promise.resolve(false),
  releaseMic: () => {},
  begin: () => Promise.resolve({ ok: false, error: CLOSED_ERROR }),
  now: () => 0,
  markAiStart: () => {},
  markAiEnd: () => {},
  markAnswer: () => {},
  timesOf: () => undefined,
  end: () => Promise.resolve({ sessionId: "", status: null, missingParts: [], saved: false }),
  discard: () => Promise.resolve(),
  dispose: () => {},
};

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

export function useInterviewCapture(options: InterviewCaptureOptions = {}): InterviewCapture {
  const [store] = useState(createCaptureStore);
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [levels] = useState(() => new Set<(level: number) => void>());

  // The engine reads the latest callbacks at call time, so a page can pass
  // fresh closures every render without restarting anything.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // Created on first use, after mount. Unmount disposes it; StrictMode's
  // second mount makes a fresh one on the same store when first used. A call
  // that arrives after the real unmount (a promise the page started earlier)
  // gets an inert engine, so nothing can start recording on a page that is gone.
  const engineRef = useRef<CaptureEngine | null>(null);
  const mountedRef = useRef(false);
  const engine = useCallback((): CaptureEngine => {
    if (!engineRef.current) {
      if (!mountedRef.current) return INERT_ENGINE;
      engineRef.current = createCaptureEngine({
        store,
        options: () => optionsRef.current,
        publishLevel: (level) =>
          levels.forEach((listener) => {
            try {
              listener(level);
            } catch {
              // One bad subscriber must not stop the meter for the others.
            }
          }),
      });
    }
    return engineRef.current;
  }, [store, levels]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Disposed while still reachable: its finish asks the page for the turns,
      // and the page marks the answer in progress through this hook.
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const onLevel = useCallback(
    (listener: (level: number) => void) => {
      levels.add(listener);
      return () => {
        levels.delete(listener);
      };
    },
    [levels],
  );

  const requestMic = useCallback(() => engine().requestMic(), [engine]);
  const releaseMic = useCallback(() => engine().releaseMic(), [engine]);
  const begin = useCallback((input: BeginInput) => engine().begin(input), [engine]);
  const now = useCallback(() => engine().now(), [engine]);
  const markAiStart = useCallback((turnId: string, atMs?: number) => engine().markAiStart(turnId, atMs), [engine]);
  const markAiEnd = useCallback((turnId: string, opts?: AiEndOptions) => engine().markAiEnd(turnId, opts), [engine]);
  const markAnswer = useCallback((turnId: string) => engine().markAnswer(turnId), [engine]);
  const timesOf = useCallback((turnId: string) => engine().timesOf(turnId), [engine]);
  const end = useCallback((reason: EndReason, turns: CaptureTurn[]) => engine().end(reason, turns), [engine]);
  const discard = useCallback(() => engine().discard(), [engine]);

  return useMemo(
    () => ({
      ...snapshot,
      finalizing: snapshot.interim.trim() !== "",
      onLevel,
      requestMic,
      releaseMic,
      begin,
      now,
      markAiStart,
      markAiEnd,
      markAnswer,
      timesOf,
      end,
      discard,
    }),
    [snapshot, onLevel, requestMic, releaseMic, begin, now, markAiStart, markAiEnd, markAnswer, timesOf, end, discard],
  );
}
