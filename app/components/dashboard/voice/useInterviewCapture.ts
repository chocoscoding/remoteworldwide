"use client";

// The capture side of an interview-prep session, voice or typed, as one hook.
//
// A voice interview is one MediaStream with these taps (see app/lib/voice/capture):
//   - MediaRecorder (Opus, 24 kbps, 250 ms chunks) -> the part queue -> S3 by
//     presigned PUT. This is the record: the report is built from it.
//   - a second MediaRecorder on a mix of the same track and the interviewer as
//     the browser played it -> its own part queue (`mix` parts). Playback only:
//     it becomes the report's recording so both voices are heard, and nothing
//     is measured from it. Anything that stops it (no tap on the engine's
//     audio, a stall, a part that did not arrive) leaves the playback the
//     candidate's own track, as before it existed (startMix).
//   - live captions: the browser's SpeechRecognition on a `web-speech`
//     session. A browser without one (Firefox) gets no captions; the page
//     then sends answers on mic-level silence.
//   - or, on an `elevenlabs` session, the speech engine is the interviewer and
//     the captions (engineInterview.ts). Without one there is no interview.
// Captions are a convenience and fail cheaply. Nothing about them can stop the
// recording, and the report transcript always comes from ElevenLabs Scribe.
//
// Every time here is on one session clock whose zero is the recorder's `start`
// event, because that is where the stored audio begins: the interviewer's
// turns, the answer windows and the caption times all have to point at the
// right second of the recording for the report's "▶ 3:42" chips to work.
// A typed session has no recording, so its zero is simply when it began; its
// turn times are kept for the same report, minus the audio. The candidate's
// mute keeps that timeline whole too: it disables the track, so the recording
// holds silence where they were muted rather than skipping it (setSelfMuted),
// and the finish sends those stretches (`mutedSpans`) so the delivery analysis
// does not count them as pauses.
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
//    the recorder and the call.
//
// Nothing here logs. The part URLs and the engine's signed URL are credentials.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BackendError } from "@/app/lib/api/core";
import { beaconFinish, deletePrepSession, finishPrepSession, getPartUrls, PREP_PATH } from "@/app/lib/voice/api";
import { createSessionClock, type SessionClock } from "@/app/lib/voice/capture/clock";
import {
  createInterviewerTurns,
  engineFinishTurns,
  engineProblemMessage,
  engineProblemOfRefusal,
  engineProblemOfStart,
  hasEngineAnswer,
  recordingTrackFacts,
  type EngineProblem,
  type EngineTurn,
  type InterviewerTurns,
} from "@/app/lib/voice/capture/engineInterview";
import { ENGINE_CONNECT_TIMEOUT_MS, startEngine, type EngineDeps, type EngineErrorCode, type EngineSession } from "@/app/lib/voice/capture/engineSession";
import { takeInterviewerAudio } from "@/app/lib/voice/capture/interviewerAudio";
import { createMicLevel, type MicLevel } from "@/app/lib/voice/capture/micLevel";
import { createPartQueue, type PartQueue } from "@/app/lib/voice/capture/partQueue";
import { canCaptureElements, createPlaybackMix, type PlaybackMix } from "@/app/lib/voice/capture/playbackMix";
import { createRecorder, recorderSupported, type Recorder } from "@/app/lib/voice/capture/recorder";
import { putPart } from "@/app/lib/voice/capture/s3Upload";
import type { InterviewOpening, MintVoiceConversationInput, MintVoiceConversationResult } from "@/app/lib/voice/conversation";
import { beaconRelease, mintConversation, mintRefusalOf, releaseConversation } from "@/app/lib/voice/conversations";
import { formatClock } from "@/app/lib/voice/format";
import {
  PREP_LIMITS,
  type CapReason,
  type CreatePrepSessionResult,
  type EndReason,
  type FinishPrepSessionInput,
  type FinishPrepSessionResult,
  type LiveSttProvider,
  type MutedSpan,
  type PartManifestEntry,
  type PlaybackMixInput,
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
/**
 * How long a finish waits for the playback mix's last parts, alongside the
 * recording's own. The mix is only ever played: a slow one is dropped (the
 * playback is then the candidate's track) rather than holding up the save.
 */
const MIX_DRAIN_MS = 15_000;
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
/**
 * How often a muted candidate is reported active to the engine interviewer.
 * Each report holds it off speaking for about two seconds (the typing signal,
 * as ElevenLabs describe it), so once a second keeps it held with a beat to
 * spare, and a background tab's one-second timer floor still makes it.
 */
const MUTE_HOLD_MS = 1_000;

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

/** Whether anything is writing captions right now. `none` is a browser without a recognizer (Firefox), or one that could not run. */
export type CaptionState = "live" | "none";

/** Who interviews and captions a voice session: the speech engine, or the page with browser captions. */
export type LiveMode = "engine" | "web-speech";

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

/**
 * A stretch the candidate had themselves muted, on the session clock; `endMs`
 * is null while it lasts. The recording holds silence there, which the
 * delivery analysis would read as long pauses and a slow start, so the finish
 * sends them (`mutedSpans`, see mutedSpansFor) for it to leave out.
 */
export interface MuteSpan {
  startMs: number;
  endMs: number | null;
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

export type BeginResult = { ok: true } | { ok: false; error: string; problem?: EngineProblem };

export interface AiEndOptions {
  /** The user spoke over the interviewer, which cut its speech short. */
  bargedIn?: boolean;
  /** When it ended on the session clock, if not now; never later than now or earlier than its start. */
  atMs?: number;
}

export interface InterviewCaptureOptions {
  /** Each finished browser caption, in order. */
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
  /** The engine interviewer dropped mid-interview. Unless the page ends the session here, the capture finishes it (or deletes it, with nothing answered). */
  onInterviewerLost?: () => void;
}

export interface BeginInput {
  config: CreatePrepSessionResult;
  /** The recording consent the session was created with; an engine interview's mint repeats it. */
  consent?: MintVoiceConversationInput["consent"];
  /** How an engine interview opens (the voice config's `interviewOpening`); a `greeting`'s reply is not an answer. */
  opening?: InterviewOpening | null;
}

export interface CaptureSnapshot {
  status: CaptureStatus;
  mode: PrepSessionMode | null;
  sessionId: string | null;
  micStatus: CaptureMicStatus;
  /** Who writes the captions: `elevenlabs` or `web-speech`. Null before begin and for typed sessions. */
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
  /** Null before begin and for typed sessions. */
  liveMode: LiveMode | null;
  /** The engine interview's conversation, once minted. */
  conversationId: string | null;
  /** The engine interviewer is speaking (its turn, settled over playback gaps). */
  agentSpeaking: boolean;
  /** The engine interviewer's latest line. */
  aiText: string;
  /** The engine conversation so far, for the screen; the service keeps the words for the report. */
  engineTurns: readonly EngineTurn[];
  /** Why the engine interviewer could not start, or dropped. */
  engineProblem: EngineProblem | null;
  /** How the engine interview opens, as begin was told; null otherwise. */
  opening: InterviewOpening | null;
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
  /** The engine interviewer's levels, 0-1; 0 without one. */
  getInputVolume: () => number;
  getOutputVolume: () => number;
  /** The recording mic's byte spectrum over 0-8000 Hz, for VoiceFrequencyBars; null before begin and once stopped. Stable. */
  getMicFrequencyData: () => Uint8Array | null;
  /** Sends a typed answer to the engine interviewer, as a typed turn. False when there is no call to send it on. */
  sendTypedAnswer: (text: string) => boolean;
  /** The user is typing: the engine interviewer holds off. */
  signalTyping: () => void;
  /**
   * Holds the engine interviewer's own mic shut (the recording carries on):
   * while the page plays audio it must not hear. Held OR the candidate's own
   * mute, so releasing this never unmutes a candidate who muted themselves.
   */
  setMicMuted: (muted: boolean) => void;
  /**
   * The candidate's own mute, for every mic the session has: the recording
   * (silence, still recorded), the engine interviewer's capture, the browser's
   * captions. Kept and applied to each as it starts, so it may come before begin.
   */
  setSelfMuted: (muted: boolean) => void;
  /** Where the candidate was muted so far, on the session clock. */
  mutedSpans: () => MuteSpan[];
  /**
   * Resumes the recording's AudioContext if it started suspended. A session
   * that starts itself on a page with no user gesture yet (a hard reload)
   * gets one, and it reads silence: the level, the candidate's bars, barge-in
   * and the send on silence are all dead until a press calls this.
   */
  resumeAudio: () => void;
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
  liveMode: null,
  conversationId: null,
  agentSpeaking: false,
  aiText: "",
  engineTurns: [],
  engineProblem: null,
  opening: null,
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
  /** Stops listening and still hands over, as finals, what it heard. */
  stop: () => void;
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

/** The fields a finish can do without: the report is today's report without them. */
const hasExtras = (body: FinishPrepSessionInput): boolean => body.mix !== undefined || body.mutedSpans !== undefined;

function withoutExtras(body: FinishPrepSessionInput): FinishPrepSessionInput {
  const copy = { ...body };
  delete copy.mix;
  delete copy.mutedSpans;
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
  /** How the speech engine's client is loaded; the default imports it on demand. */
  speechEngine?: EngineDeps;
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
  getInputVolume: () => number;
  getOutputVolume: () => number;
  getMicFrequencyData: () => Uint8Array | null;
  sendTypedAnswer: (text: string) => boolean;
  signalTyping: () => void;
  setMicMuted: (muted: boolean) => void;
  setSelfMuted: (muted: boolean) => void;
  mutedSpans: () => MuteSpan[];
  resumeAudio: () => void;
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
  /** The playback-only mix and its parts; null when there is none, or it was dropped. */
  let mix: PlaybackMix | null = null;
  let mixQueue: PartQueue | null = null;
  /** Stops taking the browser-voice path's question elements for the mix. */
  let untakeElements: (() => void) | null = null;
  let unsubscribeQueue: (() => void) | null = null;
  let meter: MicLevel | null = null;
  let recognition: RecognitionLike | null = null;
  let recognitionWanted = false;
  /** Starts a fresh recognizer on the captions' own terms; set once they begin, for an unmute to call. */
  let runRecognition: (() => boolean) | null = null;
  /** A recognizer stopped by a mute, still handing over the words said before it. */
  let draining: RecognitionLike | null = null;
  /**
   * The candidate's own mute. Not `muted`, which is this engine being disposed.
   * A wanted state rather than an action: the track, the engine's call and the
   * captions each start at their own moment, and the engine's client drops a
   * mute sent before its call is open and starts every call unmuted.
   */
  let selfMuted = false;
  /** The page holds the engine interviewer's mic shut (setMicMuted); it hears nothing while this or selfMuted. */
  let engineHeld = false;
  let muteHold: ReturnType<typeof setInterval> | null = null;
  const muteSpans: MuteSpan[] = [];
  let interviewer: EngineSession | null = null;
  let interviewerTurns: InterviewerTurns | null = null;
  let conversationId: string | null = null;
  /** Hung up, or never to be dialled: a disconnect after this is ours, not a drop. */
  let interviewerStopped = false;
  let conversationReleased = false;
  let opening: InterviewOpening | null = null;
  let recordingTrack: MediaStreamTrack | undefined;
  let agcOff: boolean | undefined;

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
    if (muteHold !== null) clearInterval(muteHold);
    ticker = null;
    heartbeat = null;
    partRetry = null;
    muteHold = null;
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
        // Muted while the prompt was up: the stream opens silenced.
        if (selfMuted) silenceTrack();
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
    untakeElements?.();
    untakeElements = null;
    // The graph only: whether the mix is worth sending is already known.
    mix?.dispose();
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

  /**
   * Our track disabled rather than the recorder paused or stopped: a disabled
   * track records silence, so the recorder keeps cutting its 250 ms parts and
   * the file stays one timeline with the session clock, which every time in
   * the report seeks into. The meter on the same stream reads 0 with it.
   */
  function silenceTrack() {
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !selfMuted;
    });
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
    stopCaptions();
    stopInterviewer(false);
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
    set({ liveProvider: "web-speech", liveMode: "web-speech", interim: "" });
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
        const current = recognition === rec;
        if (!current && draining !== rec) return;
        let finalText = "";
        let partial = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else partial += result[0].transcript;
        }
        // A recognizer stopped by a mute hands over what was said before it, and no partials.
        if (current) set({ interim: partial });
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
        if (draining === rec) draining = null;
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

    runRecognition = run;
    // Muted before the captions began: the first recognizer waits for the unmute (resumeCaptions).
    const running = selfMuted || run();
    if (!running) recognitionWanted = false;
    set({ captions: running ? "live" : "none" });
  }

  /** Stops the browser's captions, if they run. */
  function stopCaptions() {
    recognitionWanted = false;
    const rec = recognition;
    const stopping = draining;
    recognition = null;
    draining = null;
    for (const each of [rec, stopping]) {
      try {
        each?.abort();
      } catch {
        // Already ended.
      }
    }
    set({ interim: "" });
  }

  /**
   * The candidate muted. The browser's recognizer opens a mic of its own, which
   * our disabled track does not silence, and Chrome sends what it hears to its
   * speech service: so it stops. Stopped rather than aborted, so the words
   * said before the press still arrive (`draining`); `captions` stays as it
   * is, because they come back on the unmute and the page judges its send by it.
   */
  function pauseCaptions() {
    const rec = recognition;
    if (!rec) return;
    recognition = null;
    draining = rec;
    try {
      rec.stop();
    } catch {
      // Still listening otherwise: its last words are not worth the mic staying open.
      draining = null;
      try {
        rec.abort();
      } catch {
        // Already ended.
      }
    }
    set({ interim: "" });
  }

  /** Unmuted: a fresh recognizer, while captions are still wanted. One that will not start ends them, as a failed restart does. */
  function resumeCaptions() {
    if (!recognitionWanted || recognition || !runRecognition || closed || capHit || ending) return;
    if (runRecognition()) return;
    recognitionWanted = false;
    set({ captions: "none" });
  }

  // --- the engine interviewer ---------------------------------------------------

  function publishInterviewer() {
    if (!interviewerTurns) return;
    set({ engineTurns: interviewerTurns.turns, agentSpeaking: interviewerTurns.speaking, aiText: interviewerTurns.aiText });
  }

  /** On an engine session the service keeps the words; the finish sends only its turns' ids and times. */
  function turnsToSend(turns: readonly CaptureTurn[]): readonly CaptureTurn[] {
    return interviewerTurns && conversationId ? engineFinishTurns(conversationId, interviewerTurns.turns, turns) : turns;
  }

  /** Anything worth keeping: on an engine session with a `greeting` opening, the reply to the greeting is not an answer. */
  function answered(turns: readonly CaptureTurn[]): boolean {
    const sent = turnsToSend(turns);
    return interviewerTurns ? hasEngineAnswer(sent, opening) : hasAnswer(sent);
  }

  /** The engine's own capture of the same device can turn automatic gain back on (P8): agcOff only ever goes from true to false. */
  function rereadAgc() {
    if (agcOff === true && recordingTrack?.readyState === "live" && recordingTrackFacts(recordingTrack).agcOff === false) agcOff = false;
  }

  async function startInterviewer(id: string, inputDeviceId: string | undefined, consent: BeginInput["consent"]): Promise<BeginResult> {
    set({ liveMode: "engine", opening });
    let minted: MintVoiceConversationResult;
    try {
      minted = await mintConversation({ feature: "interview", targetId: id, consent: consent ?? null });
    } catch (error) {
      const problem = engineProblemOfRefusal(mintRefusalOf(error), error instanceof BackendError ? error.status : null);
      return failBegin(engineProblemMessage(problem), problem);
    }
    conversationId = minted.conversationId;
    // The mint's opening chose its first message, so it outranks the one read from the voice config (unknown if that read failed).
    if (minted.opening) opening = minted.opening;
    if (muted || closed || interviewerStopped) return failBegin("The session was closed before it started.");

    const turns = createInterviewerTurns(minted.conversationId, {
      aiStart: (turnId, atMs) => {
        const entry = times.get(turnId);
        // The same turn resuming after a pause: it ends at its last audio.
        if (entry) delete entry.endMs;
        else markAiStart(turnId, atMs);
      },
      aiEnd: (turnId, atMs, bargedIn) => markAiEnd(turnId, { atMs, bargedIn }),
      answer: (turnId) => markAnswer(turnId),
    });
    interviewerTurns = turns;
    set({ conversationId: minted.conversationId, opening });

    let startFailure: EngineErrorCode | null = null;
    let startUnsupported = false;
    const starting = startEngine(
      {
        signedUrl: minted.signedUrl,
        clock,
        inputDeviceId,
        firstMessage: minted.firstMessage,
        onAgentSpeakStart: (atMs) => {
          if (closed) return;
          turns.speakStart(atMs);
          publishInterviewer();
        },
        onAgentSpeakEnd: (atMs) => {
          turns.speakEnd(atMs);
          publishInterviewer();
        },
        onAgentText: (text) => {
          if (closed) return;
          turns.agentText(text);
          publishInterviewer();
        },
        onUserText: (text, _atMs, eventId) => {
          if (closed) return;
          turns.userText(text, "voice", eventId);
          publishInterviewer();
        },
        onInterrupted: () => turns.interrupted(),
        onStatus: (status) => {
          if (status === "disconnected") interviewerLost();
        },
        onError: ({ code, fatal, unsupported }) => {
          if (!fatal) return;
          startFailure ??= code;
          if (unsupported) startUnsupported = true;
          interviewerLost();
        },
      },
      env.speechEngine,
    );
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      starting,
      new Promise<"timeout">((resolve) => {
        connectTimer = setTimeout(() => resolve("timeout"), ENGINE_CONNECT_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(connectTimer);
    // Past the deadline: a call that connects later is hung up at once.
    if (outcome === "timeout") void starting.then((late) => late?.end());
    const session = outcome === "timeout" ? null : outcome;
    if (muted || closed || interviewerStopped) {
      void session?.end();
      return failBegin("The session was closed before it started.");
    }
    if (!session || !session.isOpen()) {
      void session?.end();
      const problem = engineProblemOfStart(startFailure, startUnsupported);
      return failBegin(engineProblemMessage(problem), problem);
    }
    interviewer = session;
    // The interviewer as the candidate hears it, into the playback mix. A client
    // whose playback cannot be tapped leaves the mix with no interviewer in it,
    // and so no reason to upload it: the playback stays the candidate's track.
    if (mix) {
      const played = session.playedAudio();
      if (!played || !mix.addInterviewer(played)) dropMix();
    }
    // A mute from before the call: the client dropped it, and began unmuted. Only
    // when wanted, so a call nobody muted sees no mute calls at all.
    if (engineHeld || selfMuted) session.setMicMuted(true);
    syncMuteHold();
    rereadAgc();
    set({ status: "live", micStatus: "live", captions: "live" });
    return { ok: true };
  }

  /** Hangs up and releases the conversation. On `pagehide` the release goes by beacon. */
  function stopInterviewer(viaBeacon: boolean) {
    interviewerStopped = true;
    const session = interviewer;
    interviewer = null;
    syncMuteHold();
    if (session) void session.end();
    if (conversationId && !conversationReleased) {
      conversationReleased = true;
      if (viaBeacon) beaconRelease(conversationId);
      else void releaseConversation(conversationId).catch(() => {});
    }
    if (interviewerTurns) set({ agentSpeaking: false, captions: "none" });
  }

  /** The call dropped mid-interview. What was recorded is finished as usual; nothing more is recorded without an interviewer. */
  function interviewerLost() {
    if (!interviewer || interviewerStopped || closed || ending) return;
    stopInterviewer(false);
    const problem: EngineProblem = { kind: "disconnected" };
    set({ engineProblem: problem, error: engineProblemMessage(problem) });
    try {
      env.options().onInterviewerLost?.();
    } catch {
      // The page's problem; the session still has to finish.
    }
    if (closed || ending) return;
    const turns = currentTurns();
    if (answered(turns)) void end("ended-early", turns);
    else void discard();
  }

  function sendTypedAnswer(text: string): boolean {
    const said = text.trim();
    if (!said || !interviewer || !interviewerTurns || closed || ending) return false;
    if (!interviewer.sendUserMessage(said)) return false;
    interviewerTurns.userText(said, "typed");
    publishInterviewer();
    return true;
  }

  // --- the candidate's mute ---------------------------------------------------

  /**
   * Muted, the engine hears the silence its client streams in the candidate's
   * place, and silence after an answer is what ends a turn: it would take a
   * mute mid-answer as the answer being over and ask the next question of
   * someone who cannot reply. So it is told the user is active, the signal a
   * typed answer uses, every MUTE_HOLD_MS until the unmute. A hold on its
   * speaking, not a pause: a line already playing plays on, and the recording
   * clock runs throughout.
   */
  function syncMuteHold() {
    const wanted = selfMuted && interviewer !== null && !closed && !ending;
    if (wanted === (muteHold !== null)) return;
    if (muteHold !== null) {
      clearInterval(muteHold);
      muteHold = null;
      return;
    }
    interviewer?.sendUserActivity();
    muteHold = setInterval(() => interviewer?.sendUserActivity(), MUTE_HOLD_MS);
  }

  /** The open span ends here; one that ended where it began (before the clock started, say) is dropped. */
  function closeMuteSpan(atMs: number) {
    const open = muteSpans[muteSpans.length - 1];
    if (!open || open.endMs !== null) return;
    if (atMs > open.startMs) open.endMs = atMs;
    else muteSpans.pop();
  }

  function setSelfMuted(next: boolean) {
    if (next === selfMuted || closed || ending) return;
    selfMuted = next;
    if (next) muteSpans.push({ startMs: clock.now(), endMs: null });
    else closeMuteSpan(clock.now());
    silenceTrack();
    interviewer?.setMicMuted(engineHeld || selfMuted);
    syncMuteHold();
    if (next) pauseCaptions();
    else resumeCaptions();
  }

  /** The page's hold, ORed with the candidate's mute: the page releasing its hold (an opening line ending) must not unmute them. */
  function setMicMuted(held: boolean) {
    engineHeld = held;
    interviewer?.setMicMuted(engineHeld || selfMuted);
  }

  // --- the playback mix ------------------------------------------------------

  /**
   * Starts the playback-only mix (playbackMix.ts): a second recorder in the
   * same tick as the first, and its own part queue under the `mix` track. Only
   * where there will be an interviewer to hear: an engine session (tapped when
   * it connects), or a browser-voice session in a browser that can capture
   * the question's <audio> element. Anything missing, and there is no mix.
   */
  function startMix(id: string, config: CreatePrepSessionResult, media: MediaStream) {
    if (!audioCtx) return;
    const engine = config.liveProvider === "elevenlabs";
    if (!engine && !canCaptureElements()) return;
    const parts = createPartQueue({
      maxParts: config.maxParts,
      partMaxBytes: config.partMaxBytes > 0 ? config.partMaxBytes : undefined,
      getUrls: (from) => getPartUrls(id, from, "mix"),
      upload: putPart,
    });
    const made = createPlaybackMix({
      context: audioCtx,
      mic: media,
      onChunk: (blob, atMs) => parts.push(blob, atMs),
      sessionStart: () => clock.t0,
      onBroken: () => dropMix(),
    });
    if (!made) {
      parts.abort();
      return;
    }
    mix = made;
    mixQueue = parts;
    if (!engine) untakeElements = takeInterviewerAudio((element) => mix?.addElement(element));
  }

  /** No mix after all (no tap, a stall, a session closing without it): nothing more is recorded or sent for it. */
  function dropMix() {
    const dropped = mix;
    mix = null;
    untakeElements?.();
    untakeElements = null;
    mixQueue?.abort();
    mixQueue = null;
    if (dropped) void dropped.stop().finally(() => dropped.dispose());
  }

  /**
   * The mix as a finish sends it, or nothing: only a mix that started, stayed
   * in step, has the interviewer in it, and has parts. `offsetMs` is where its
   * first sample sits on the session clock; the service lines it up by that.
   */
  function mixBody(parts: PartManifestEntry[]): { mix?: PlaybackMixInput } {
    if (!mix || !mix.usable || !mix.hasInterviewer || mix.t0 === null || clock.t0 === null || parts.length === 0) return {};
    const offsetMs = Math.round(mix.t0 - clock.t0);
    if (Math.abs(offsetMs) > PREP_LIMITS.mixOffsetMaxMs) return {};
    return { mix: { parts, offsetMs } };
  }

  /** The mix's parts once every one is stored, within MIX_DRAIN_MS; otherwise it is dropped and nothing is sent. */
  async function settleMix(): Promise<{ mix?: PlaybackMixInput }> {
    const parts = mixQueue;
    if (!parts || !mix?.usable || !mix.hasInterviewer) {
      dropMix();
      return {};
    }
    const settled = await Promise.race([parts.finish(), sleep(MIX_DRAIN_MS).then(() => null)]);
    const body = settled && settled.missing.length === 0 ? mixBody(settled.manifest) : {};
    if (!body.mix) dropMix();
    return body;
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
      if (body) beaconFinish(sessionId, queue ? { ...body, parts: queue.manifest(), ...mixBody(mixQueue?.manifest() ?? []) } : body);
      return;
    }
    // Hung up first, so an interviewer turn in progress ends in the body.
    stopInterviewer(true);
    const turns = currentTurns();
    closed = true;
    if (!answered(turns)) {
      deleteOnUnload(sessionId);
    } else {
      // The mix's parts as they stand: any still on their way make the service
      // play the candidate's track instead, which is what a closed tab costs.
      const body = buildBody("pagehide", turns);
      beaconFinish(sessionId, queue ? { ...body, parts: queue.manifest(), ...mixBody(mixQueue?.manifest() ?? []) } : body);
    }
    stopCaptions();
    void recorder?.stop();
    void mix?.stop();
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
    if (document.visibilityState === "hidden") {
      queue?.flush();
      mixQueue?.flush();
    }
  }

  /** Parts that failed for good go again. Not once the queue is past the cap: those would only be refused again. */
  function retryFailedParts() {
    if (closed || ending) return;
    for (const parts of [queue, mixQueue]) {
      const state = parts?.getState();
      if (parts && state && state.failed > 0 && !state.capped) parts.retry();
    }
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
  function failBegin(error: string, problem?: EngineProblem): BeginResult {
    stopCaptions();
    stopInterviewer(false);
    void recorder?.stop();
    queue?.abort();
    dropMix();
    releaseMedia();
    clearTimers();
    removePageHooks();
    set({ status: "failed", error, interim: "", ...(problem ? { engineProblem: problem } : {}) });
    return problem ? { ok: false, error, problem } : { ok: false, error };
  }

  async function begin({ config, consent, opening: openedWith }: BeginInput): Promise<BeginResult> {
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
    if (!recorderSupported()) return failBegin("This browser can't record audio. Try Chrome, Edge or Safari.");
    if (!(await requestMic()) || !stream) {
      const error = env.store.get().error ?? MIC_UNAVAILABLE;
      return failBegin(error);
    }
    if (muted || closed) return failBegin("The session was closed before it started.");
    const media = stream;
    recordingTrack = media.getAudioTracks()[0];
    const track = recordingTrackFacts(recordingTrack);
    agcOff = track.agcOff;

    audioCtx = newAudioContext();
    const partQueue = createPartQueue({
      maxParts: config.maxParts,
      partMaxBytes: config.partMaxBytes > 0 ? config.partMaxBytes : undefined,
      urls: config.partUrls,
      getUrls: (from) => getPartUrls(id, from),
      upload: putPart,
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
      return failBegin("The recording couldn't start. Please try again.");
    }
    // In the same tick, so the mix's first sample sits a few milliseconds from the recording's.
    startMix(id, config, media);
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
    if (config.liveProvider === "elevenlabs") {
      opening = openedWith ?? null;
      return startInterviewer(id, track.deviceId, consent);
    }
    set({ status: "live", micStatus: "live" });
    startWebSpeech();
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
    rereadAgc();
    const limit = mode === "voice" && capMs !== null ? capMs + VOICE_TURN_GRACE_MS : TEXT_TURN_MAX_MS;
    const clamp = (value: number | undefined): number | undefined =>
      value === undefined || !Number.isFinite(value) ? undefined : Math.min(limit, Math.max(0, Math.round(value)));

    const out = turnsToSend(turns).slice(0, PREP_LIMITS.turnsMax).map((turn): PrepTurnInput => {
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
    const muted = mode === "voice" ? mutedSpansFor(limit) : [];
    return {
      turns: out,
      endReason: reason,
      clock: { startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString() },
      ...(agcOff !== undefined ? { agcOff } : {}),
      ...(muted.length > 0 ? { mutedSpans: muted } : {}),
    };
  }

  /**
   * The candidate's mutes as the finish sends them: whole ms, inside the
   * session's bound (the turns' own), joined where they touch, one still open
   * ending now, at most `PREP_LIMITS.mutedSpansMax`. They are pushed in time
   * order, so they are already sorted.
   */
  function mutedSpansFor(limit: number): MutedSpan[] {
    const at = clock.now();
    const out: MutedSpan[] = [];
    for (const span of muteSpans) {
      const startMs = Math.min(limit, Math.max(0, Math.round(span.startMs)));
      const endMs = Math.min(limit, Math.max(0, Math.round(span.endMs ?? at)));
      if (endMs <= startMs) continue;
      const last = out[out.length - 1];
      if (last && startMs <= last.endMs) last.endMs = Math.max(last.endMs, endMs);
      else out.push({ startMs, endMs });
    }
    return out.slice(0, PREP_LIMITS.mutedSpansMax);
  }

  async function sendFinish(id: string, body: FinishPrepSessionInput): Promise<FinishPrepSessionResult | null> {
    const finish = env.options().finish ?? finishPrepSession;
    let payload = body;
    let strippedExtras = false;
    let strippedTimes = false;
    for (let attempt = 0; attempt < FINISH_ATTEMPTS; attempt++) {
      lastBody = payload;
      try {
        return await finish(id, payload);
      } catch (error) {
        if (error instanceof BackendError && error.status === 400) {
          // A body the service will not take must not lose the answers. First
          // what is only ever extra (the playback mix, the muted stretches: the
          // report is today's report without them), then, as ever, the answers'
          // times, for a clock that disagrees with the service's bounds. A
          // strip is not a failed attempt: the network has not failed.
          if (!strippedExtras && hasExtras(payload)) {
            strippedExtras = true;
            payload = withoutExtras(payload);
            attempt--;
            continue;
          }
          if (!strippedTimes) {
            strippedTimes = true;
            strippedExtras = true;
            payload = { ...withoutExtras(payload), turns: payload.turns.map(withoutTimes) };
            attempt--;
            continue;
          }
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
    // While the engine's capture and our track are still live: a stopped track's settings say nothing.
    rereadAgc();

    // Nothing waits for the captions' last words: the report transcript comes from the recording.
    stopCaptions();
    stopInterviewer(false);
    // Together, so the mix ends where the recording does.
    await Promise.all([recorder?.stop(), mix?.stop()]);
    // Ended muted: the last span ends with the recording.
    closeMuteSpan(clock.now());
    releaseMedia();
    clearTimers();
    set({ status: "saving", elapsedMs: Math.floor(clock.now() / 1000) * 1000 });

    const body = buildBody(reason, turns);
    let result: FinishPrepSessionResult | null;
    if (!queue) {
      result = await sendFinish(id, body);
    } else {
      // The service only waits for the recording's own parts; the mix goes
      // along once all of its are stored, or not at all.
      const settled = await Promise.all([queue.finish(), settleMix()]);
      let parts = settled[0];
      const mixed = settled[1];
      result = await sendFinish(id, { ...body, parts: parts.manifest, ...mixed });
      for (let round = 0; round < FINISH_ROUNDS_MAX && result?.status === "uploading" && result.missingParts.length > 0; round++) {
        queue.retry(result.missingParts);
        parts = await queue.finish();
        result = await sendFinish(id, { ...body, parts: parts.manifest, ...mixed });
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
    stopCaptions();
    stopInterviewer(false);
    void recorder?.stop();
    queue?.abort();
    dropMix();
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
      if (answered(turns)) void end("ended-early", turns);
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
    getInputVolume: () => interviewer?.getInputVolume() ?? 0,
    getOutputVolume: () => interviewer?.getOutputVolume() ?? 0,
    getMicFrequencyData: () => meter?.frequencyData() ?? null,
    sendTypedAnswer,
    signalTyping: () => interviewer?.sendUserActivity(),
    setMicMuted,
    setSelfMuted,
    mutedSpans: () => muteSpans.map((span) => ({ ...span })),
    resumeAudio: () => {
      if (audioCtx?.state === "suspended") void audioCtx.resume().catch(() => {});
      // The meter's own context, where it could not share this one.
      meter?.resume();
    },
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
  getInputVolume: () => 0,
  getOutputVolume: () => 0,
  getMicFrequencyData: () => null,
  sendTypedAnswer: () => false,
  signalTyping: () => {},
  setMicMuted: () => {},
  setSelfMuted: () => {},
  mutedSpans: () => [],
  resumeAudio: () => {},
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
  const getInputVolume = useCallback(() => engine().getInputVolume(), [engine]);
  const getOutputVolume = useCallback(() => engine().getOutputVolume(), [engine]);
  const getMicFrequencyData = useCallback(() => engine().getMicFrequencyData(), [engine]);
  const sendTypedAnswer = useCallback((text: string) => engine().sendTypedAnswer(text), [engine]);
  const signalTyping = useCallback(() => engine().signalTyping(), [engine]);
  const setMicMuted = useCallback((muted: boolean) => engine().setMicMuted(muted), [engine]);
  const setSelfMuted = useCallback((muted: boolean) => engine().setSelfMuted(muted), [engine]);
  const mutedSpans = useCallback(() => engine().mutedSpans(), [engine]);
  const resumeAudio = useCallback(() => engine().resumeAudio(), [engine]);

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
      getInputVolume,
      getOutputVolume,
      getMicFrequencyData,
      sendTypedAnswer,
      signalTyping,
      setMicMuted,
      setSelfMuted,
      mutedSpans,
      resumeAudio,
    }),
    [snapshot, onLevel, requestMic, releaseMic, begin, now, markAiStart, markAiEnd, markAnswer, timesOf, end, discard, getInputVolume, getOutputVolume, getMicFrequencyData, sendTypedAnswer, signalTyping, setMicMuted, setSelfMuted, mutedSpans, resumeAudio],
  );
}
