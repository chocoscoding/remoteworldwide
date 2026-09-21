// The recording tap: MediaRecorder on the interview's one MediaStream.
//
// What it records is what the report is built from. The AI service stitches
// the chunks back into one file, Scribe transcribes it after the interview, and
// the prosody service measures it, so the container has to be one both accept.
// Chrome and Firefox record WebM/Opus; Safari only MP4 (AAC or Opus inside).
// Scribe takes both, and the playback copy is transcoded to AAC either way.
//
// 24 kbps Opus is plenty for a single voice (Opus is transparent for speech
// well below that) and keeps a 40-minute interview near 7 MB, which matters
// because every part goes up the user's connection while they are talking.
//
// Chunks come every 250 ms so a crash or a closed tab loses at most that much
// that the part queue has not already seen.

import { eventTime, type SessionClock } from "./clock";

/** Preferred first. An empty string lets the browser pick its own default. */
export const RECORDER_MIME_PREFERENCE = ["audio/webm;codecs=opus", "audio/mp4"] as const;

export const RECORDER_BITS_PER_SECOND = 24_000;
export const RECORDER_TIMESLICE_MS = 250;

/** How long `stop()` waits for the browser's `stop` event before resolving anyway. */
const STOP_TIMEOUT_MS = 3_000;

/**
 * The first container this browser can record, or "" when it supports none by
 * name (the recorder then uses its default, which `mimeType` reports once
 * started). Also "" without MediaRecorder at all.
 */
export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  for (const mime of RECORDER_MIME_PREFERENCE) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // Some engines throw on a MIME they cannot parse rather than answering false.
    }
  }
  return "";
}

/** Whether this browser can record at all. */
export function recorderSupported(): boolean {
  return typeof MediaRecorder !== "undefined";
}

export interface RecorderOptions {
  bitsPerSecond?: number;
  timesliceMs?: number;
  /**
   * Started at the recorder's `start` event, if not started already, so the
   * session's zero is the first recorded sample.
   */
  clock?: SessionClock;
  /** Each non-empty chunk, in order. `atMs` is when it was handed over, on the session clock. */
  onChunk: (blob: Blob, atMs: number) => void;
  /** The recorder's `start` event. `t0` is its time as a `performance.now()` value. */
  onStart?: (t0: number) => void;
  /** The recorder failed mid-way (the track ended, the encoder died). Chunks already handed over are still good. */
  onError?: (error: Error) => void;
}

export interface Recorder {
  /** The container actually recorded; known once started (the browser may refine an empty request). */
  readonly mime: string;
  readonly state: RecordingState;
  start(): void;
  /** Stops and resolves after the final chunk has been handed to `onChunk`. Safe to call twice. */
  stop(): Promise<void>;
}

/** Throws when MediaRecorder is missing or refuses the stream; callers check `recorderSupported()` first. */
export function createRecorder(stream: MediaStream, options: RecorderOptions): Recorder {
  const mimeType = pickRecorderMime();
  const init: MediaRecorderOptions = { audioBitsPerSecond: options.bitsPerSecond ?? RECORDER_BITS_PER_SECOND };
  if (mimeType) init.mimeType = mimeType;

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, init);
  } catch (error) {
    // A browser can list a type as supported and still refuse it for this
    // stream; its default is better than no recording.
    if (!mimeType) throw error;
    recorder = new MediaRecorder(stream, { audioBitsPerSecond: init.audioBitsPerSecond });
  }

  let t0: number | null = null;
  let stopping: Promise<void> | null = null;

  const chunkTime = (event: Event): number => {
    const at = eventTime(event);
    if (options.clock?.started) return Math.max(0, options.clock.toSession(at));
    return t0 === null ? 0 : Math.max(0, at - t0);
  };

  recorder.addEventListener("start", (event) => {
    t0 = eventTime(event);
    options.clock?.start(t0);
    options.onStart?.(t0);
  });

  recorder.addEventListener("dataavailable", (event) => {
    // The final event after stop() is often empty; nothing to upload.
    if (event.data && event.data.size > 0) options.onChunk(event.data, chunkTime(event));
  });

  recorder.addEventListener("error", (event) => {
    const detail = (event as Event & { error?: unknown }).error;
    options.onError?.(detail instanceof Error ? detail : new Error("The recording stopped unexpectedly."));
  });

  return {
    get mime() {
      return recorder.mimeType || mimeType;
    },
    get state() {
      return recorder.state;
    },
    start() {
      if (recorder.state !== "inactive") return;
      recorder.start(options.timesliceMs ?? RECORDER_TIMESLICE_MS);
    },
    stop() {
      if (stopping) return stopping;
      if (recorder.state === "inactive") return Promise.resolve();
      stopping = new Promise<void>((resolve) => {
        // `stop` fires after the last `dataavailable`, so by then every chunk
        // has been handed over. The timer covers engines that never fire it
        // after an error.
        const timer = setTimeout(resolve, STOP_TIMEOUT_MS);
        recorder.addEventListener(
          "stop",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        try {
          recorder.stop();
        } catch {
          clearTimeout(timer);
          resolve();
        }
      });
      return stopping;
    },
  };
}
