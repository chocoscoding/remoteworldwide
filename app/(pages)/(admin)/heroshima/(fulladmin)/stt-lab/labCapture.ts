// The STT lab's capture engine: one clip, three engines.
//
// The same primitives as a voice interview (app/lib/voice/capture), on one
// MediaStream:
//   - MediaRecorder -> the whole clip, kept in memory (at most 10 minutes of
//     24 kbps Opus, under 2 MB) -> ONE presigned POST to S3 when it stops ->
//     `finish` -> scored from what both engines already heard.
//   - the PCM tap -> the voice gateway on the run's `lab` ticket -> AWS
//     streaming captions (channel 1).
//   - the browser's SpeechRecognition on the same microphone (channel 2).
// Both live channels are timed on the session clock whose zero is the
// recorder's start, so their "first result" figures are comparable.
//
// A plain closure behind useSyncExternalStore, as useInterviewCapture is: the
// recorder, the socket and the timers must outlive re-renders, and the mic
// level goes to subscribers directly so nothing re-renders at 60 fps.
//
// Nothing here logs; the ticket and the upload policy go only where they are
// used.

import { apiMessage, BackendError } from "@/app/lib/api/core";
import { INTERVIEW_MIC_CONSTRAINTS } from "@/app/components/dashboard/voice/useInterviewCapture";
import { createSessionClock, type SessionClock } from "@/app/lib/voice/capture/clock";
import { createMicLevel, type MicLevel } from "@/app/lib/voice/capture/micLevel";
import { pcmTap, pcmTapSupported, type PcmTap } from "@/app/lib/voice/capture/pcmTap";
import { createRecorder, pickRecorderMime, recorderSupported, type Recorder } from "@/app/lib/voice/capture/recorder";
import { connectRelay, type Relay, type RelayErrorCode } from "@/app/lib/voice/capture/relayStream";
import { putPart, S3UploadError } from "@/app/lib/voice/capture/s3Upload";
import { createLabRun, finishLabRun } from "@/app/lib/voice/labApi";
import type { LabLiveResult, LabRun, LabRunCreateResult } from "@/app/lib/voice/types";
import { startWebSpeech, webSpeechSupported, type WebSpeechSession } from "./webSpeech";

/**
 * - `starting`: asking for the mic and the run.
 * - `recording`: both channels live (or explained).
 * - `stopping` / `uploading`: collecting the last captions, then sending the clip.
 * - `done` / `failed`: `run` (and `error`) say how it went.
 */
export type LabPhase = "idle" | "starting" | "recording" | "stopping" | "uploading" | "done" | "failed";

/**
 * - `off`: not attempted (no gateway configured).
 * - `connecting` / `live`: running.
 * - `ended`: ran and finished.
 * - `unavailable`: could not run, or stopped early; `note` says why.
 */
export type ChannelStatus = "off" | "connecting" | "live" | "ended" | "unavailable";

export interface LiveChannelState {
  status: ChannelStatus;
  text: string;
  interim: string;
  /** Session ms (recorder start = 0) of the first result. */
  firstResultMs: number | null;
  note: string | null;
  /** Whether it ever produced or accepted audio, which decides whether it is scored. */
  engaged: boolean;
}

export interface LabCaptureSnapshot {
  phase: LabPhase;
  elapsedMs: number;
  maxMs: number | null;
  minutesLeft: number | null;
  stream: LiveChannelState;
  webSpeech: LiveChannelState;
  run: LabRun | null;
  error: string | null;
  clipBytes: number | null;
}

export interface LabStartOptions {
  /** The Web Speech channel's language. */
  speechLang: string;
  /** Read when the clip stops, including when it stops itself at the limit. */
  getFinishOptions: () => LabFinishOptions;
  /** A stopped clip has reached `done` or `failed` (after its upload, if any): a moment to reload the runs. */
  onSettled?: () => void;
}

export interface LabFinishOptions {
  reference: string;
  keepAudio: boolean;
}

export interface LabCapture {
  subscribe(listener: () => void): () => void;
  getSnapshot(): LabCaptureSnapshot;
  start(options: LabStartOptions): Promise<void>;
  /** Stops recording, uploads the clip and finishes the run, which comes back scored. */
  stop(): Promise<void>;
  /** Drops the clip without uploading. */
  cancel(): void;
  /** Back to idle after a finished or failed run. */
  reset(): void;
  onLevel(listener: (level: number) => void): () => void;
  /** Stops anything running. The engine stays usable (React may mount it again). */
  dispose(): void;
}

/** Shorter than this is not worth scoring. */
export const LAB_MIN_CLIP_MS = 500;
/** The service allows this much past the run's limit, for a recorder that stops a beat late. */
const DURATION_GRACE_MS = 5_000;
const TICK_MS = 200;
const FINISH_RETRIES = 3;
const FINISH_RETRY_MS = 1_500;

const idleChannel = (): LiveChannelState => ({ status: "off", text: "", interim: "", firstResultMs: null, note: null, engaged: false });

const initial = (): LabCaptureSnapshot => ({
  phase: "idle",
  elapsedMs: 0,
  maxMs: null,
  minutesLeft: null,
  stream: idleChannel(),
  webSpeech: idleChannel(),
  run: null,
  error: null,
  clipBytes: null,
});

const RELAY_NOTES: Partial<Record<RelayErrorCode, string>> = {
  limited: "AWS stream slots or the lab's minutes are full, so live AWS captions stopped.",
  unavailable: "The voice gateway could not be reached or gave up.",
  "bad-audio": "AWS refused the audio stream.",
  internal: "The voice gateway had a problem.",
  cap: "The clip reached the lab's length limit.",
  busy: "You already have a live stream open (another tab?).",
  "bad-ticket": "The gateway refused the lab ticket.",
  "bad-origin": "The gateway does not accept this site's origin.",
  protocol: "The gateway closed the stream (protocol).",
  "too-large": "The gateway closed the stream (frame too large).",
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const joinText = (parts: readonly string[]) =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

export function createLabCapture(): LabCapture {
  let snapshot = initial();
  const listeners = new Set<() => void>();
  const levelListeners = new Set<(level: number) => void>();

  // One clip's resources. `generation` makes a late callback from an old clip harmless.
  let generation = 0;
  let media: MediaStream | null = null;
  let recorder: Recorder | null = null;
  let chunks: Blob[] = [];
  let clock: SessionClock | null = null;
  let level: MicLevel | null = null;
  let levelOff: (() => void) | null = null;
  let tap: PcmTap | null = null;
  let relay: Relay | null = null;
  let speech: WebSpeechSession | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;
  let run: LabRunCreateResult | null = null;
  let finishOptions: (() => LabFinishOptions) | null = null;
  let onSettled: (() => void) | null = null;
  const streamFinals: string[] = [];

  const set = (patch: Partial<LabCaptureSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  const setChannel = (which: "stream" | "webSpeech", patch: Partial<LiveChannelState>) => {
    const next = { ...snapshot[which], ...patch };
    set(which === "stream" ? { stream: next } : { webSpeech: next });
  };
  const markFirst = (which: "stream" | "webSpeech") => {
    if (snapshot[which].firstResultMs === null && clock?.started) setChannel(which, { firstResultMs: Math.round(clock.now()) });
  };

  const fail = (message: string) => set({ phase: "failed", error: message });

  /** Releases every capture resource of the current clip; the upload is not a resource. */
  const release = () => {
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
    speech?.abort();
    speech = null;
    tap?.stop();
    tap = null;
    relay?.close();
    relay = null;
    levelOff?.();
    levelOff = null;
    level?.stop();
    level = null;
    void recorder?.stop();
    recorder = null;
    media?.getTracks().forEach((track) => track.stop());
    media = null;
    levelListeners.forEach((listener) => listener(0));
  };

  const startStreamChannel = async (mine: number, stream: MediaStream, created: LabRunCreateResult, sessionClock: SessionClock) => {
    if (!created.streamTicket || !created.gatewayUrl) {
      setChannel("stream", { status: "off", note: "No voice gateway is configured, so there are no live AWS captions." });
      return;
    }
    if (!pcmTapSupported()) {
      setChannel("stream", { status: "unavailable", note: "This browser cannot run the audio worklet that feeds the gateway." });
      return;
    }
    setChannel("stream", { status: "connecting", note: null });
    const live = connectRelay({
      gatewayUrl: created.gatewayUrl,
      ticket: created.streamTicket,
      onReady: () => {
        if (mine === generation) setChannel("stream", { status: "live", engaged: true });
      },
      onPartial: (caption) => {
        if (mine !== generation) return;
        markFirst("stream");
        setChannel("stream", { interim: caption.text, engaged: true });
      },
      onFinal: (caption) => {
        if (mine !== generation) return;
        markFirst("stream");
        if (caption.text.trim()) streamFinals.push(caption.text);
        setChannel("stream", { text: joinText(streamFinals), interim: "", engaged: true });
      },
      onError: (error) => {
        if (mine !== generation || !error.fatal) return;
        setChannel("stream", { status: "unavailable", note: RELAY_NOTES[error.code] ?? "Live AWS captions stopped." });
      },
      onEnd: () => {
        if (mine === generation && (snapshot.stream.status === "live" || snapshot.stream.status === "connecting")) {
          setChannel("stream", { status: "ended" });
        }
      },
    });
    relay = live;
    const started = await pcmTap(stream, { clock: sessionClock, onFrame: (frame, atMs) => live.send(frame, atMs) });
    if (mine !== generation) {
      started?.stop();
      return;
    }
    if (!started) {
      live.close();
      relay = null;
      setChannel("stream", { status: "unavailable", note: "The audio worklet could not start." });
      return;
    }
    tap = started;
  };

  const startSpeechChannel = (mine: number, lang: string) => {
    if (!webSpeechSupported()) {
      setChannel("webSpeech", { status: "unavailable", note: "This browser has no Web Speech (Firefox, for one)." });
      return;
    }
    const session = startWebSpeech({
      lang,
      onText: (text, interim) => {
        if (mine === generation) setChannel("webSpeech", { text, interim, engaged: snapshot.webSpeech.engaged || Boolean(text || interim) });
      },
      onFirstResult: () => {
        if (mine === generation) markFirst("webSpeech");
      },
      onFailure: (message) => {
        if (mine === generation) setChannel("webSpeech", { status: "unavailable", note: message });
      },
    });
    if (!session) {
      setChannel("webSpeech", { status: "unavailable", note: "Speech recognition could not start." });
      return;
    }
    speech = session;
    setChannel("webSpeech", { status: "live" });
  };

  const liveResults = (): LabLiveResult[] => {
    const results: LabLiveResult[] = [];
    // A channel that never ran would score an empty transcript as all wrong,
    // which says nothing about the engine. One that ran to the end and heard
    // nothing is a result, and is scored.
    if (snapshot.stream.engaged) {
      results.push({ provider: "aws-transcribe", text: joinText([snapshot.stream.text, snapshot.stream.interim]), firstPartialMs: snapshot.stream.firstResultMs });
    }
    if (snapshot.webSpeech.engaged || snapshot.webSpeech.status === "ended") {
      results.push({ provider: "web-speech", text: joinText([snapshot.webSpeech.text, snapshot.webSpeech.interim]), firstPartialMs: snapshot.webSpeech.firstResultMs });
    }
    return results;
  };

  const upload = async (created: LabRunCreateResult, clip: Blob) => {
    for (let attempt = 0; ; attempt++) {
      try {
        await putPart(created.upload, clip);
        return;
      } catch (error) {
        const kind = error instanceof S3UploadError ? error.kind : "retryable";
        if (kind === "fatal") throw new Error("S3 refused the clip.");
        // There is no route for a fresh upload URL: an expired one means recording again.
        if (kind === "expired") throw new Error("The upload link expired. Record the clip again.");
        if (attempt >= 2) throw new Error("The clip could not be uploaded. Check the connection and record again.");
        await sleep(1_000 * (attempt + 1));
      }
    }
  };

  const finish = async (runId: string, body: Parameters<typeof finishLabRun>[1]) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await finishLabRun(runId, body);
      } catch (error) {
        // S3 can take a moment to show a fresh object.
        if (error instanceof BackendError && error.status === 409 && attempt < FINISH_RETRIES) {
          await sleep(FINISH_RETRY_MS);
          continue;
        }
        throw error;
      }
    }
  };


  const engine: LabCapture = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,

    async start(options) {
      if (snapshot.phase !== "idle" && snapshot.phase !== "done" && snapshot.phase !== "failed") return;
      const mine = ++generation;
      release();
      chunks = [];
      streamFinals.length = 0;
      run = null;
      finishOptions = options.getFinishOptions;
      onSettled = options.onSettled ?? null;
      snapshot = initial();
      set({ phase: "starting" });

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !recorderSupported()) {
        fail("This browser cannot record audio.");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: INTERVIEW_MIC_CONSTRAINTS });
      } catch (error) {
        const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
        fail(denied ? "Microphone access was refused." : "No microphone could be opened.");
        return;
      }
      if (mine !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      media = stream;

      // The run (and its single-use, short-lived ticket) is created only once the mic is granted.
      const mime = pickRecorderMime();
      let created: LabRunCreateResult;
      try {
        created = await createLabRun(mime ? { mime } : {});
      } catch (error) {
        if (mine !== generation) return;
        release();
        fail(apiMessage(error));
        return;
      }
      if (mine !== generation) return;
      run = created;

      const sessionClock = createSessionClock();
      clock = sessionClock;
      try {
        recorder = createRecorder(stream, { clock: sessionClock, onChunk: (blob) => chunks.push(blob) });
      } catch {
        release();
        fail("The browser refused to record this microphone.");
        return;
      }
      level = createMicLevel(stream);
      levelOff = level?.onLevel((value) => levelListeners.forEach((listener) => listener(value))) ?? null;
      recorder.start();
      set({ phase: "recording", maxMs: created.maxMs, minutesLeft: created.minutesLeft });

      startSpeechChannel(mine, options.speechLang);
      ticker = setInterval(() => {
        if (mine !== generation || !clock?.started) return;
        const elapsed = clock.now();
        set({ elapsedMs: elapsed });
        if (elapsed >= created.maxMs) void engine.stop();
      }, TICK_MS);
      await startStreamChannel(mine, stream, created, sessionClock);
    },

    async stop() {
      if (snapshot.phase !== "recording" || !run || !clock) return;
      const mine = generation;
      const created = run;
      const durationMs = Math.round(clock.now());
      set({ phase: "stopping", elapsedMs: durationMs });
      if (ticker !== null) clearInterval(ticker);
      ticker = null;

      // The live channels first, so their last finals land before the audio stops.
      const speechDone = speech?.stop() ?? Promise.resolve("");
      speech = null;
      tap?.stop();
      tap = null;
      const relayDone = relay?.stop() ?? Promise.resolve(null);
      relay = null;
      await Promise.all([speechDone, relayDone]);
      if (mine !== generation) return;
      for (const which of ["stream", "webSpeech"] as const) {
        const status = snapshot[which].status;
        if (status === "live" || status === "connecting") setChannel(which, { status: "ended" });
      }

      const active = recorder;
      recorder = null;
      await active?.stop();
      const mime = active?.mime || "audio/webm";
      release();
      if (mine !== generation) return;

      if (durationMs < LAB_MIN_CLIP_MS || chunks.length === 0) {
        fail("The clip is too short to transcribe.");
        onSettled?.();
        return;
      }
      const clip = new Blob(chunks, { type: mime });
      chunks = [];
      set({ phase: "uploading", clipBytes: clip.size });
      const { reference, keepAudio } = finishOptions?.() ?? { reference: "", keepAudio: false };
      try {
        await upload(created, clip);
        if (mine !== generation) return;
        const scored = await finish(created.runId, {
          durationMs: Math.max(LAB_MIN_CLIP_MS, Math.min(durationMs, created.maxMs + DURATION_GRACE_MS)),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          live: liveResults(),
          keepAudio,
        });
        if (mine !== generation) return;
        // Both engines transcribed the clip as it recorded, so `finish` comes
        // back scored: there is nothing to poll for.
        if (scored.status === "ready") set({ phase: "done", run: scored, error: scored.error });
        else set({ phase: "failed", run: scored, error: scored.error ?? "The run failed." });
      } catch (error) {
        if (mine === generation) fail(apiMessage(error));
      }
      if (mine === generation) onSettled?.();
    },

    cancel() {
      if (snapshot.phase !== "starting" && snapshot.phase !== "recording") return;
      generation++;
      release();
      chunks = [];
      run = null;
      snapshot = initial();
      set({});
    },

    reset() {
      if (snapshot.phase !== "done" && snapshot.phase !== "failed") return;
      generation++;
      release();
      snapshot = initial();
      set({});
    },

    onLevel(listener) {
      levelListeners.add(listener);
      return () => levelListeners.delete(listener);
    },

    dispose() {
      // A clip in flight is dropped; an upload already under way finishes on its own.
      if (snapshot.phase === "starting" || snapshot.phase === "recording") engine.cancel();
      else if (snapshot.phase === "stopping") release();
    },
  };

  return engine;
}
