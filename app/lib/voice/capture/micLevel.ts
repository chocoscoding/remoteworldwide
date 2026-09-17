// The microphone's level, for the waveform, barge-in and (where there are no
// captions) auto-send on silence.
//
// The same analyser loop useVoiceSession runs for dictation, lifted out so the
// interview capture can run it on its own stream. useVoiceSession keeps its own
// copy for now; the numbers here match it, so a level means the same thing on
// both screens.
//
// A subscription rather than state: at 60 fps a setState would re-render the
// whole interview screen. It runs on animation frames, so it pauses in a
// background tab, which is fine for a meter and for barge-in (nobody talks over
// an interviewer they cannot see); a Firefox auto-send that must keep counting
// there should use pause.ts on the PCM blocks instead.

/** The analyser settings useVoiceSession uses. */
export const LEVEL_FFT_SIZE = 512;
export const LEVEL_SMOOTHING = 0.75;
/** Low and mid bins only, where speech energy sits. */
export const LEVEL_BINS = 64;
/** Speech at a normal distance reads around 0.3-0.6 after this gain. */
export const LEVEL_GAIN = 2.2;
/** A level this loud, held for more than `SUSTAINED_FRAMES` frames, is someone speaking rather than a cough or a knock. */
export const SUSTAINED_LEVEL = 0.22;
export const SUSTAINED_FRAMES = 6;

/** The level of one analyser reading, 0-1: RMS over the first `bins` byte bins, with the gain applied. Pure. */
export function levelFromBins(data: ArrayLike<number>, bins: number = LEVEL_BINS): number {
  const count = Math.min(data.length, bins);
  if (count <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < count; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / count) / 255;
  return Math.min(1, rms * LEVEL_GAIN);
}

export interface MicLevelOptions {
  /** An AudioContext to share (the PCM tap's, say). The meter closes only a context it created. */
  context?: AudioContext;
  /**
   * Called on every frame once the level has stayed above `SUSTAINED_LEVEL`
   * for more than `SUSTAINED_FRAMES` frames, until it drops. It repeats,
   * so it must be idempotent (stopping speech synthesis is).
   */
  onSustained?: () => void;
}

export interface MicLevel {
  /** Subscribes to the level, 0-1, on every animation frame. Returns an unsubscribe. */
  onLevel(listener: (level: number) => void): () => void;
  /** The latest level. */
  readonly level: number;
  /** Stops the loop and disconnects; listeners hear a final 0. Safe to call twice. */
  stop(): void;
}

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Starts metering `stream`. Null when this browser has no Web Audio or the stream cannot be read. */
export function createMicLevel(stream: MediaStream, options: MicLevelOptions = {}): MicLevel | null {
  const Ctor = audioContextCtor();
  if (!options.context && !Ctor) return null;

  const owned = !options.context;
  let ctx: AudioContext;
  try {
    ctx = options.context ?? new (Ctor as AudioContextCtor)();
  } catch {
    return null;
  }
  let source: MediaStreamAudioSourceNode;
  let analyser: AnalyserNode;
  try {
    analyser = ctx.createAnalyser();
    analyser.fftSize = LEVEL_FFT_SIZE;
    analyser.smoothingTimeConstant = LEVEL_SMOOTHING;
    source = ctx.createMediaStreamSource(stream);
    // Analysed only: an analyser needs no path to the speakers.
    source.connect(analyser);
  } catch {
    if (owned) void ctx.close().catch(() => {});
    return null;
  }

  const listeners = new Set<(level: number) => void>();
  const data = new Uint8Array(analyser.frequencyBinCount);
  let level = 0;
  let loudFrames = 0;
  let stopped = false;
  let handle: number | null = null;

  const schedule = (tick: () => void): number =>
    typeof requestAnimationFrame === "function" ? requestAnimationFrame(tick) : (setTimeout(tick, 50) as unknown as number);
  const cancel = (id: number) => {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
    else clearTimeout(id);
  };

  const publish = (value: number) => {
    listeners.forEach((listener) => {
      try {
        listener(value);
      } catch {
        // One bad subscriber must not stop the meter for the others.
      }
    });
  };

  const tick = () => {
    if (stopped) return;
    analyser.getByteFrequencyData(data);
    level = levelFromBins(data);
    if (level > SUSTAINED_LEVEL) {
      loudFrames += 1;
      if (loudFrames > SUSTAINED_FRAMES) options.onSustained?.();
    } else {
      loudFrames = 0;
    }
    publish(level);
    handle = schedule(tick);
  };
  handle = schedule(tick);

  // A context created outside a user gesture starts suspended, and reads silence.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  return {
    onLevel(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get level() {
      return level;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (handle !== null) cancel(handle);
      handle = null;
      try {
        source.disconnect();
      } catch {
        // Already disconnected by a closed context.
      }
      if (owned) void ctx.close().catch(() => {});
      level = 0;
      publish(0);
      listeners.clear();
    },
  };
}
