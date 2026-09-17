// Live-caption audio, as the gateway takes it: 100 ms frames of 16 kHz mono
// signed 16-bit little-endian PCM, 3,200 bytes each, raw (no WAV header).
//
// Pure: no DOM, no Web Audio. The AudioWorklet (pcmTap.ts) hands over Float32
// blocks at whatever rate the AudioContext runs, and this turns them into
// frames. The AI service's contract suite compiles this file as written
// (tests/contracts/frontend-voice-capture.test.ts), so the arithmetic is
// checked in Node.
//
// Every frame is exactly `PCM.frameBytes`. The gateway counts minutes from the
// bytes it forwards, AWS times its results from the samples it has received,
// and the relay maps those times back onto the session clock by counting
// frames. A short frame anywhere would put every later caption early. So the
// resampler's fractional position and the part-filled frame both carry from one
// block to the next, and the last frame is padded with silence rather than sent
// short. AWS asks for silence rather than gaps for the same reason.

import { createChunker, createResampler, floatToInt16 } from "@/app/components/dashboard/voice/pcm";
import { PCM } from "@/app/lib/voice/types";

/** Samples in one frame: 1,600. */
export const FRAME_SAMPLES = (PCM.sampleRate * PCM.frameMs) / 1000;

/** Signed 16-bit samples as little-endian bytes, whatever the platform's own byte order. */
export function int16ToBytes(samples: Int16Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, samples[i], true);
  return buffer;
}

export interface PcmFramer {
  /** The capture rate this framer converts from. */
  readonly inputRate: number;
  /** Frames handed out so far, padded ones included. Frame `n` starts `n * PCM.frameMs` into the stream. */
  readonly framesOut: number;
  /** Adds one block of samples and returns every frame it completed, each exactly `PCM.frameBytes`. */
  push(samples: Float32Array): ArrayBuffer[];
  /** The part-filled frame, padded with silence to full size, or null when nothing is held. */
  flush(): ArrayBuffer | null;
}

/**
 * A framer from `inputRate` (the AudioContext's rate: 48 kHz on most hardware,
 * 44.1 kHz on plenty) to the stream's 16 kHz. It uses pcm.ts's streaming
 * resampler, which low-passes as it decimates and never drifts from the input's
 * duration however long the interview runs. At 16 kHz in, it copies.
 */
export function createPcmFramer(inputRate: number): PcmFramer {
  const resample = createResampler(inputRate, PCM.sampleRate);
  const chunker = createChunker(FRAME_SAMPLES);
  let framesOut = 0;

  const encode = (frame: Float32Array): ArrayBuffer => {
    framesOut++;
    return int16ToBytes(floatToInt16(frame));
  };

  return {
    inputRate,
    get framesOut() {
      return framesOut;
    },
    push(samples) {
      if (samples.length === 0) return [];
      return chunker.push(resample(samples)).map(encode);
    },
    flush() {
      const rest = chunker.flush(true);
      return rest ? encode(rest) : null;
    },
  };
}

/** One frame of silence. A fresh ArrayBuffer is zero-filled, and zero is silence in signed PCM. */
export function silenceFrame(): ArrayBuffer {
  return new ArrayBuffer(PCM.frameBytes);
}

/** Whole frames nearest to `ms`; 0 for anything not positive. */
export function framesForMs(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / PCM.frameMs) : 0;
}

/**
 * Silence frames covering `ms`, at most `maxFrames` of them: what fills a
 * stretch the microphone gave nothing for (a suspended AudioContext), so the
 * stream's clock keeps pace with the session's.
 */
export function* silenceFrames(ms: number, maxFrames: number = Number.POSITIVE_INFINITY): Generator<ArrayBuffer, void, undefined> {
  const count = Math.min(framesForMs(ms), Math.max(0, Math.floor(maxFrames)));
  for (let i = 0; i < count; i++) yield silenceFrame();
}
