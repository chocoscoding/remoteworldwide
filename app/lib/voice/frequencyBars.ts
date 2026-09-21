// Visualizer bar levels from the engine's byte spectrum (0-255 per bin, linear over 100-8000 Hz).

/** Only the lower half is drawn: about 100-4000 Hz, where speech lives. */
const VOICE_SHARE = 0.5;
/** How fast the bands widen towards the top; 0 would be linear. */
const BAND_WARP = 2.5;
/** The analyser's quiet-room hum; a band at or below it rests at zero. */
const NOISE_FLOOR = 0.2;
/** How much of the gap a falling bar closes per frame; rising is immediate. */
const FALL_SHARE = 0.22;

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

const countOf = (count: number): number => (Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0);

/** `count` levels, 0-1, lowest band first; all zeros without data. */
export function barsFrom(data: Uint8Array | null, count: number): number[] {
  const n = countOf(count);
  const bars = new Array<number>(n).fill(0);
  if (!data || data.length === 0 || n === 0) return bars;

  const span = Math.max(1, Math.round(data.length * VOICE_SHARE));
  const edge = (i: number) => Math.round((span * Math.expm1((BAND_WARP * i) / n)) / Math.expm1(BAND_WARP));
  const raw = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.min(edge(i), span - 1);
    const hi = Math.max(lo + 1, Math.min(edge(i + 1), span));
    let sum = 0;
    for (let bin = lo; bin < hi; bin++) sum += data[bin];
    raw[i] = sum / (hi - lo) / 255;
  }
  for (let i = 0; i < n; i++) {
    const blended = (raw[Math.max(0, i - 1)] + 2 * raw[i] + raw[Math.min(n - 1, i + 1)]) / 4;
    bars[i] = clamp01((blended - NOISE_FLOOR) / (1 - NOISE_FLOOR));
  }
  return bars;
}

/** One frame towards `next`: up at once, down gradually. */
export function easeBars(previous: readonly number[], next: readonly number[], fall: number = FALL_SHARE): number[] {
  const share = clamp01(fall);
  return next.map((target, i) => {
    const from = clamp01(previous[i] ?? 0);
    const to = clamp01(target);
    return to >= from ? to : from + (to - from) * share;
  });
}

/** `[a, b, c]` becomes `[c, b, a, a, b, c]`: the low bands meet in the middle. */
export function mirrorBars(half: readonly number[]): number[] {
  return [...half].reverse().concat(half);
}

/**
 * How many of an analyser's first bins span 0-8000 Hz, the input `barsFrom`
 * expects (see line 1). The engine's analyser runs at 16 kHz and is already
 * that; a mic analyser at 44.1 or 48 kHz spans ~24 kHz, and its raw bins would
 * leave the outer bars dead. Pass `data.subarray(0, voiceSpectrumBins(...))`.
 */
export function voiceSpectrumBins(sampleRate: number, binCount: number): number {
  const n = countOf(binCount);
  if (n === 0 || !(sampleRate > 0)) return n;
  return Math.min(n, Math.max(1, Math.round((8000 / (sampleRate / 2)) * n)));
}

/** A still silhouette for reduced motion: taller in the middle, never flat. */
export function restingBars(count: number): number[] {
  const n = countOf(count);
  return Array.from({ length: n }, (_, i) => 0.25 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / n) ** 2);
}
