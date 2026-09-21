// PCM helpers for the admin STT lab's AWS Transcribe streaming captions. Pure:
// no DOM, no React.
//
// AWS Transcribe streaming takes mono, 16 kHz, signed 16-bit little-endian PCM
// (its `pcm` encoding), relayed by our voice gateway in frames that all last
// the same time. The bytes are raw samples with no WAV header: AWS does not
// accept WAV on a stream, and a header would be read as 44 bytes of noise at
// the start of the audio.
//
// The browser captures at whatever rate its AudioContext runs: 48 kHz on most
// hardware, 44.1 kHz on plenty, occasionally something odd. So nothing here
// assumes a rate. It is kept free of browser APIs so the arithmetic can be
// checked numerically in Node, which is the only test this repo can run on it.
//
// The level and pause helpers moved to app/lib/voice/pause.ts beside the other
// capture modules; they are re-exported here so older imports keep working.

import { rms } from "@/app/lib/voice/pause";

export { createPauseDetector, rms, type PauseDetector } from "@/app/lib/voice/pause";

/** The rate the stream is opened at: the 16 kHz AWS recommends for speech. */
export const STREAM_SAMPLE_RATE = 16_000;

/** Seconds per packet: 50 ms, inside the 50-200 ms chunks AWS asks a stream for (2,400 samples at 48 kHz). */
export const PACKET_SECONDS = 0.05;

/** Samples in one packet at 16 kHz: 800. */
export const PACKET_SAMPLES = Math.round(STREAM_SAMPLE_RATE * PACKET_SECONDS);

/** Samples in one 50 ms capture buffer at the AudioContext's rate (2,400 at 48 kHz). */
export function captureBufferSamples(sampleRate: number): number {
  return Math.max(1, Math.round(sampleRate * PACKET_SECONDS));
}

// ---------------------------------------------------------------------------
// Resampling
// ---------------------------------------------------------------------------

export type Resampler = (input: Float32Array) => Float32Array;

/**
 * A streaming resampler from `inputRate` to `outputRate`.
 *
 * Each output sample is the mean of the input it spans (a box filter), with
 * the samples at either edge weighted by how much of them the span covers. At
 * 48 kHz that is the mean of every three samples. That is a cheap low-pass: it
 * keeps speech and removes most of what plain decimation (keep every third
 * sample) would fold back into the voice band as hiss.
 *
 * It streams because buffers rarely divide evenly. 50 ms at 22.05 kHz is
 * 1,102.5 samples, and 44.1 / 16 is not exact in floating point. The fractional
 * position carries from one call to the next, so the output never drifts from
 * the input's duration however long someone talks.
 */
export function createResampler(inputRate: number, outputRate: number = STREAM_SAMPLE_RATE): Resampler {
  if (!Number.isFinite(inputRate) || inputRate <= 0 || !Number.isFinite(outputRate) || outputRate <= 0) {
    throw new RangeError(`Sample rates must be positive numbers, got ${inputRate} -> ${outputRate}`);
  }
  const ratio = inputRate / outputRate;
  // Input not yet fully consumed by an output window.
  let pending = new Float32Array(0);
  // Where the next output window starts, in samples from pending[0]. Always in [0, 1].
  let offset = 0;

  return (input) => {
    let buf = input;
    if (pending.length > 0) {
      buf = new Float32Array(pending.length + input.length);
      buf.set(pending);
      buf.set(input, pending.length);
    }

    // The epsilon absorbs floating-point error: 2,205 / 2.75625 must give 800,
    // not 799.9999999. The window that goes a hair past the end is read with the
    // missing sliver as silence, which is inaudible.
    const count = Math.max(0, Math.floor((buf.length - offset) / ratio + 1e-7));
    const out = new Float32Array(count);
    for (let k = 0; k < count; k++) {
      const start = offset + k * ratio;
      out[k] = windowMean(buf, start, start + ratio);
    }

    const next = offset + count * ratio;
    const drop = Math.min(buf.length, Math.floor(next));
    // A copy, never a view: `buf` may be the caller's buffer, which it reuses.
    pending = buf.slice(drop);
    offset = next - drop;
    return out;
  };
}

function windowMean(buf: Float32Array, start: number, end: number): number {
  const first = Math.floor(start);
  const last = Math.min(buf.length, Math.ceil(end));
  let sum = 0;
  for (let i = first; i < last; i++) {
    const overlap = Math.min(i + 1, end) - Math.max(i, start);
    if (overlap > 0) sum += buf[i] * overlap;
  }
  return sum / (end - start);
}

// ---------------------------------------------------------------------------
// Fixed-size chunks
// ---------------------------------------------------------------------------

export interface Chunker {
  /** Adds samples and returns every chunk they completed, each a new array of exactly `size`. */
  push(samples: Float32Array): Float32Array[];
  /**
   * Returns what is left and starts over, or null when nothing is. With `pad`,
   * the rest is filled with silence to a full chunk; without, only the samples
   * actually held come back.
   */
  flush(pad: boolean): Float32Array | null;
}

/**
 * Cuts a stream into chunks of `size` samples. Used twice: for the 50 ms
 * capture buffers at the context's rate, and for the 800-sample packets at
 * 16 kHz. The last packet is padded with silence rather than sent short, so
 * every frame keeps one duration, and AWS asks for silence rather than gaps.
 */
export function createChunker(size: number): Chunker {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError(`Chunk size must be a positive integer, got ${size}`);
  let current = new Float32Array(size);
  let filled = 0;

  return {
    push(samples) {
      const done: Float32Array[] = [];
      let i = 0;
      while (i < samples.length) {
        const take = Math.min(size - filled, samples.length - i);
        current.set(samples.subarray(i, i + take), filled);
        filled += take;
        i += take;
        if (filled === size) {
          done.push(current);
          current = new Float32Array(size);
          filled = 0;
        }
      }
      return done;
    },
    flush(pad) {
      if (filled === 0) return null;
      // A fresh Float32Array is zero-filled, so the padded form is already silent past `filled`.
      const rest = pad ? current : current.slice(0, filled);
      current = new Float32Array(size);
      filled = 0;
      return rest;
    },
  };
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

function clampSample(value: number): number {
  // `|| 0` turns NaN (and -0) into silence instead of letting it through.
  const v = value || 0;
  return v > 1 ? 1 : v < -1 ? -1 : v;
}

/**
 * Float samples to signed 16-bit, clamped to [-1, 1] first. A hot mic can go
 * past full scale, and an unclamped 1.2 would wrap to a loud negative click.
 * The asymmetric scale is the usual one for signed 16-bit PCM: -1 is -32768, 1 is 32767.
 */
export function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = clampSample(samples[i]);
    out[i] = s < 0 ? Math.floor(s * 0x8000) : Math.floor(s * 0x7fff);
  }
  return out;
}

/**
 * The samples' little-endian bytes, base64-encoded. Written through a DataView
 * with the byte order spelled out, rather than handing over the Int16Array's
 * buffer and trusting the platform to be little-endian.
 */
export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, samples[i], true);
  return bytesToBase64(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
  // In chunks: spreading a large array into String.fromCharCode overflows the
  // engine's argument limit. One packet is 1,600 bytes, but this should not
  // depend on that staying small.
  const CHUNK = 0x2000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export interface EncodedPacket {
  /** base64 of raw int16 LE PCM, no header. */
  data: string;
  /** The packet's RMS. */
  volume: number;
}

export function encodePacket(samples: Float32Array): EncodedPacket {
  return { data: int16ToBase64(floatToInt16(samples)), volume: rms(samples) };
}
