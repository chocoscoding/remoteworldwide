// The live-caption tap: the interview's MediaStream -> AudioWorklet -> 100 ms
// frames of 16 kHz PCM, each stamped with where it starts on the session clock.
//
// It is the second tap on the one stream; MediaRecorder (recorder.ts) is the
// first. The two never share buffers: the recording is Opus for storage, and
// AWS streaming cannot take WebM, so captions get their own raw copy.
//
// Frame times come from counting samples, not from reading the clock per
// frame. Frame n starts n × 100 ms after the first, exactly, which is how AWS
// counts too; the relay reports caption times as the stream's own offset plus
// the first frame's session time, so any jitter here would show up as captions
// drifting against the recording. The one reading of the clock is the anchor:
// when the first block arrives, its first sample was captured one block ago.
//
// A suspended AudioContext (Safari's "interrupted" state during a call, or a
// suspend by the caller) stops the audio clock while the session clock runs on.
// On resume the gap is filled with silence, up to 5 s, so AWS's timeline keeps
// pace; a longer gap is reported through `onGap` and later frames carry the
// true time, but the stream itself is then behind by the rest.
//
// Anything missing (no AudioWorklet, which means an insecure page or an old
// browser; the worklet failing to load) resolves to null, and the interview
// goes on with Web Speech captions or none. Nothing here is needed for the
// recording.

import { PCM } from "@/app/lib/voice/types";
import type { SessionClock } from "./clock";
import { createPcmFramer, silenceFrames } from "./pcmFrames";

/** Served from public/worklets; see the Next.js public folder convention. */
export const PCM_WORKLET_URL = "/worklets/pcm-capture.worklet.js";
/** The name the worklet registers. */
export const PCM_WORKLET_NAME = "rww-pcm-capture";
/** The worklet's block length: 20 messages a second rather than one per 2.7 ms render quantum. */
const BLOCK_SECONDS = 0.05;
/** The longest suspension that is filled with silence; see the header. */
export const MAX_GAP_FILL_MS = 5_000;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Whether this browser can run the tap at all. */
export function pcmTapSupported(): boolean {
  return audioContextCtor() !== null && typeof AudioWorkletNode !== "undefined";
}

export interface PcmTapOptions {
  /** One 3,200-byte frame. `atMs` is where its first sample sits on the session clock (or, without a clock, ms since the tap's first sample). */
  onFrame: (frame: ArrayBuffer, atMs: number) => void;
  /**
   * The session clock. Blocks that arrive before it has started are dropped:
   * audio before the recording's zero is not in the recording, so a caption for
   * it would point at nothing.
   */
  clock?: SessionClock;
  /** An AudioContext to share (the mic-level meter's, say). The tap closes only a context it created. */
  context?: AudioContext;
  /** Aborting stops the tap, including while it is still being set up (then the promise resolves to null). */
  signal?: AbortSignal;
  /** A suspension longer than `MAX_GAP_FILL_MS` shifted later frames by this many ms. */
  onGap?: (ms: number) => void;
  /** The worklet failed while running; the tap has stopped. */
  onError?: (error: Error) => void;
}

export interface PcmTap {
  /** The AudioContext's rate, which the framer converts from. */
  readonly sampleRate: number;
  /** Frames handed to `onFrame` so far. */
  readonly framesSent: number;
  /** Stops capturing. The part-filled frame is padded and handed over first. Safe to call twice. */
  stop(): void;
}

interface BlockMessage {
  type: "block";
  samples: Float32Array;
  frame: number;
}

function isBlock(data: unknown): data is BlockMessage {
  return typeof data === "object" && data !== null && (data as { type?: unknown }).type === "block" && (data as { samples?: unknown }).samples instanceof Float32Array;
}

const perfNow = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * Starts the tap on `stream`. Resolves to null when the browser cannot run it,
 * the worklet cannot be loaded, or `signal` aborted first; the caller then
 * falls back to Web Speech captions.
 */
export async function pcmTap(stream: MediaStream, options: PcmTapOptions): Promise<PcmTap | null> {
  const Ctor = audioContextCtor();
  if (!Ctor || typeof AudioWorkletNode === "undefined" || options.signal?.aborted) return null;

  const owned = !options.context;
  let ctx: AudioContext;
  try {
    ctx = options.context ?? new Ctor();
  } catch {
    return null;
  }
  const release = () => {
    if (owned) void ctx.close().catch(() => {});
  };

  const worklet = (ctx as { audioWorklet?: AudioWorklet }).audioWorklet;
  if (!worklet) {
    release();
    return null;
  }

  let source: MediaStreamAudioSourceNode;
  let node: AudioWorkletNode;
  let sink: GainNode;
  try {
    await worklet.addModule(PCM_WORKLET_URL);
    if (options.signal?.aborted) {
      release();
      return null;
    }
    source = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, PCM_WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      // The engine mixes the source down to mono before the worklet sees it.
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      processorOptions: { blockSamples: Math.max(1, Math.round(ctx.sampleRate * BLOCK_SECONDS)) },
    });
    // A muted path to the destination: engines only promise to pull nodes that
    // reach it, and a gain of 0 keeps the user's own voice out of their speakers.
    sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(node);
    node.connect(sink);
    sink.connect(ctx.destination);
  } catch {
    release();
    return null;
  }

  const framer = createPcmFramer(ctx.sampleRate);
  const clock = options.clock;
  const tapStartedAt = perfNow();
  const toSession = (perfMs: number): number => (clock ? clock.toSession(perfMs) : perfMs - tapStartedAt);

  let stopped = false;
  let sent = 0;
  /** Session time of frame 0; set by the first block kept. */
  let anchorMs: number | null = null;
  /** Added to every later frame's time after a suspension silence could not fully cover. */
  let shiftMs = 0;
  let suspendedAt: number | null = null;
  let pendingGapMs = 0;

  const emit = (frame: ArrayBuffer) => {
    const atMs = (anchorMs ?? 0) + shiftMs + sent * PCM.frameMs;
    sent++;
    options.onFrame(frame, atMs);
  };

  const fillGap = (gapMs: number) => {
    const before = sent;
    // The frame the suspension cut short goes first, padded, so the silence lands after it.
    const tail = framer.flush();
    if (tail) emit(tail);
    for (const frame of silenceFrames(Math.min(gapMs, MAX_GAP_FILL_MS))) emit(frame);
    // Whatever silence did not cover moves later frames to their true time.
    // Overshoot (the padded tail, rounding) is under one frame and is left alone.
    const uncovered = gapMs - (sent - before) * PCM.frameMs;
    if (uncovered > 0) {
      shiftMs += uncovered;
      options.onGap?.(uncovered);
    }
  };

  // A gap is only counted once frames have started: a context that starts
  // suspended and then resumes has lost nothing.
  const onState = () => {
    if (ctx.state === "running") {
      if (suspendedAt !== null && anchorMs !== null) pendingGapMs += perfNow() - suspendedAt;
      suspendedAt = null;
    } else if (suspendedAt === null) {
      suspendedAt = perfNow();
    }
  };
  ctx.addEventListener("statechange", onState);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    node.port.onmessage = null;
    node.onprocessorerror = null;
    try {
      node.port.postMessage({ type: "stop" });
    } catch {
      // The context may already be closed.
    }
    if (anchorMs !== null) {
      const tail = framer.flush();
      if (tail) emit(tail);
    }
    ctx.removeEventListener("statechange", onState);
    try {
      source.disconnect();
      node.disconnect();
      sink.disconnect();
    } catch {
      // Already disconnected by a closed context.
    }
    options.signal?.removeEventListener("abort", stop);
    release();
  };

  node.port.onmessage = (event: MessageEvent<unknown>) => {
    if (stopped || !isBlock(event.data)) return;
    const { samples } = event.data;
    if (clock && !clock.started) return;
    if (anchorMs === null) {
      // The block's first sample was captured one block before it arrived.
      anchorMs = toSession(perfNow() - (samples.length / ctx.sampleRate) * 1000);
    }
    if (pendingGapMs > 0) {
      const gap = pendingGapMs;
      pendingGapMs = 0;
      fillGap(gap);
    }
    for (const frame of framer.push(samples)) emit(frame);
  };

  node.onprocessorerror = () => {
    if (stopped) return;
    stop();
    options.onError?.(new Error("The live-caption audio tap stopped."));
  };

  options.signal?.addEventListener("abort", stop, { once: true });

  // A context created outside a user gesture starts suspended.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  return {
    get sampleRate() {
      return ctx.sampleRate;
    },
    get framesSent() {
      return sent;
    },
    stop,
  };
}
