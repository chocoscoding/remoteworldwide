// The delivery timeline's lines: how the pitch and energy series and the pace
// points become curves that flow without claiming more than was measured.
//
// The series arrive every 250 ms (500 ms past 15 minutes). Pitch is null in a
// step with no voiced frame, energy in a step with no speech, and both are
// null outside the answers. Broken at every null, a line reads as a scatter of
// dashes: one unvoiced "s", or the breath between two phrases, would cut it.
// So, per answer:
//
//  - A silence of up to LONG_GAP_MS is bridged. The line carries on across
//    it, dotted, so a joined stretch never passes for a measured one. A
//    longer silence, or the step to the next answer, ends the line.
//  - Samples are pooled into bins sized to the drawing: never under
//    MIN_BIN_MS, and otherwise about TARGET_BIN_PX wide, so a one-minute
//    session and a half-hour one both get a point every few pixels instead of
//    one per 2 px bin that a short pause leaves empty. A gap shorter than a
//    bin sits inside that bin, whose value is the mean of what was measured.
//  - Each point is a Gaussian-weighted mean of its neighbours that reaches
//    across bridged pauses, so the smoothing doesn't restart at every edge,
//    and the points are joined by a monotone cubic: smooth, and never swinging
//    past either neighbour, so every peak on the line is a peak in the data.
//
// Pure: no React and no DOM. Rebuilt only when the data or the width changes.

/**
 * A run of empty steps longer than this ends the line: the report's own
 * long-pause threshold (over 1.2 s mid-answer, the "Long pauses" figure). A
 * step is empty only when all of it was silent (or, for pitch, unvoiced), so
 * a run this long is a pause at least this long: at 250 ms steps, five empty
 * steps (1.25 s) break the line and four (1 s) are bridged. Pauses between
 * phrases in conversation mostly run 0.2-1 s, so those join; a pause just
 * over 1.2 s that straddles the step grid may show as a bridge rather than a
 * break, which still marks it as not measured.
 */
export const LONG_GAP_MS = 1_200;
/**
 * The smallest bin: two 250 ms steps. Intonation and loudness move over
 * syllables and phrases, so a finer point is noise, and one empty step (a
 * voiceless consonant, a stop) is absorbed by its bin instead of being drawn
 * as a bridge a few pixels long.
 */
export const MIN_BIN_MS = 500;
/** Roughly how wide a bin is drawn: close enough for a smooth curve, wide enough to pool a few samples. */
export const TARGET_BIN_PX = 3;
/** The smoothing kernel's standard deviation, in bins. */
export const SMOOTH_SIGMA_BINS = 1;

export interface CurvePoint {
  x: number;
  y: number;
}

/** How a point joins the one before it: measured on both sides, or across a pause that was bridged. */
export type Join = "measured" | "bridged";

const clampTo = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
export const px = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Monotone cubic
// ---------------------------------------------------------------------------

interface Segment {
  x0: number;
  y0: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  x1: number;
  y1: number;
}

const sign = (v: number) => (v < 0 ? -1 : 1);

/**
 * Tangents for a monotone cubic through the points (Steffen, 1990; d3's
 * curveMonotoneX). At a local peak or trough the tangent is flat, and nowhere
 * is it steep enough for the curve to leave the range of the two points it
 * joins, which Catmull-Rom and the other overshooting splines do.
 */
function tangents(points: readonly CurvePoint[]): number[] {
  const n = points.length;
  if (n < 2) return n === 1 ? [0] : [];
  const secant: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = points[i + 1].x - points[i].x;
    secant.push(h !== 0 ? (points[i + 1].y - points[i].y) / h : 0);
  }
  if (n === 2) return [secant[0], secant[0]];
  const t = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const s0 = secant[i - 1];
    const s1 = secant[i];
    const p = h0 + h1 !== 0 ? (s0 * h1 + s1 * h0) / (h0 + h1) : 0;
    t[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  // The ends take the one-sided slope, which stays within 0.5-1.5× the end
  // secant, so the first and last segments can't overshoot either.
  t[0] = (3 * secant[0] - t[1]) / 2;
  t[n - 1] = (3 * secant[n - 2] - t[n - 2]) / 2;
  return t;
}

function segments(points: readonly CurvePoint[]): Segment[] {
  const t = tangents(points);
  const out: Segment[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = (b.x - a.x) / 3;
    out.push({ x0: a.x, y0: a.y, c1x: a.x + dx, c1y: a.y + dx * t[i - 1], c2x: b.x - dx, c2y: b.y - dx * t[i], x1: b.x, y1: b.y });
  }
  return out;
}

const cubic = (s: Segment) => `C${px(s.c1x)} ${px(s.c1y)} ${px(s.c2x)} ${px(s.c2y)} ${px(s.x1)} ${px(s.y1)}`;
/** The same segment walked the other way, for the return edge of a band. */
const cubicBack = (s: Segment) => `C${px(s.c2x)} ${px(s.c2y)} ${px(s.c1x)} ${px(s.c1y)} ${px(s.x0)} ${px(s.y0)}`;

/**
 * One curve through every point, split into two paths by how each point
 * joins the one before it. The tangents are worked out over the whole run,
 * so a bridged span meets the measured spans either side of it without a kink.
 */
export function monotoneLine(points: readonly CurvePoint[], joins: readonly Join[]): { solid: string; bridge: string } {
  if (points.length < 2) return { solid: "", bridge: "" };
  let solid = "";
  let bridge = "";
  // The point each path last reached, so a continuing span doesn't restart with a move.
  let solidAt = -1;
  let bridgeAt = -1;
  segments(points).forEach((s, k) => {
    const to = k + 1;
    if (joins[to] === "bridged") {
      if (bridgeAt !== k) bridge += `M${px(s.x0)} ${px(s.y0)}`;
      bridge += cubic(s);
      bridgeAt = to;
    } else {
      if (solidAt !== k) solid += `M${px(s.x0)} ${px(s.y0)}`;
      solid += cubic(s);
      solidAt = to;
    }
  });
  return { solid, bridge };
}

/** A closed band between two curves through the same x positions; one point draws a bar `halfWidth` either side. */
function monotoneBand(upper: readonly CurvePoint[], lower: readonly CurvePoint[], halfWidth: number): string {
  if (upper.length === 0) return "";
  if (upper.length === 1) {
    const { x } = upper[0];
    const top = Math.min(upper[0].y, lower[0].y - 1);
    return `M${px(x - halfWidth)} ${px(top)}H${px(x + halfWidth)}V${px(lower[0].y)}H${px(x - halfWidth)}Z`;
  }
  const up = segments(upper);
  const down = segments(lower);
  const last = lower[lower.length - 1];
  return `M${px(upper[0].x)} ${px(upper[0].y)}${up.map(cubic).join("")}L${px(last.x)} ${px(last.y)}${[...down].reverse().map(cubicBack).join("")}Z`;
}

// ---------------------------------------------------------------------------
// Pitch and energy
// ---------------------------------------------------------------------------

export interface WaveGeometry {
  /** Measured spans. */
  line: string;
  /** Pauses of up to LONG_GAP_MS, joined: drawn dotted. */
  bridge: string;
  /** The middle 80% of each bin's values along each measured span: how far the value moved within each moment. */
  area: string;
  /** A stretch of one bin has nothing to join to; it is drawn as a dot. */
  dots: CurvePoint[];
  zeroY: number;
  limit: number;
  /** Nothing measured anywhere: the row says so instead of drawing nothing. */
  empty: boolean;
  /** Whether any pause was bridged, for the key. */
  bridged: boolean;
}

export interface WaveOptions {
  stepMs: number;
  durationMs: number;
  width: number;
  height: number;
  /** Space kept clear above and below the line. */
  pad: number;
  /** The answer windows, in order. A line never runs from one into the next. */
  answers: ReadonlyArray<{ startMs: number; endMs: number }>;
  /** The scale runs ±limit, rounded up to `limitStep`, held within these. */
  minLimit: number;
  maxLimit: number;
  limitStep: number;
}

interface Bin {
  /** The bin's position in its stretch, counted from the stretch's first step. */
  index: number;
  values: number[];
  /** Sum of the measured steps' centre times, for the bin's mean time. */
  tSum: number;
  /** The first and last measured step in the bin. */
  first: number;
  last: number;
}

const measured = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

/** Linear-interpolated quantile of an already sorted list, `p` in 0-1. */
function quantile(sorted: readonly number[], p: number): number {
  const at = (sorted.length - 1) * p;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

/** The band's edges: the middle 80% of each bin, so one stray frame doesn't spike it. */
const BAND_LOW = 0.1;
const BAND_HIGH = 0.9;

export function buildWave(values: ReadonlyArray<number | null>, o: WaveOptions): WaveGeometry {
  const step = o.stepMs > 0 ? o.stepMs : 250;
  const mid = o.height / 2;
  const none: WaveGeometry = { line: "", bridge: "", area: "", dots: [], zeroY: mid, limit: o.minLimit, empty: true, bridged: false };
  if (o.width <= 0 || o.durationMs <= 0) return none;
  const msPerPx = o.durationMs / o.width;
  const perBin = Math.max(1, Math.ceil(MIN_BIN_MS / step), Math.round((TARGET_BIN_PX * msPerPx) / step));
  const binMs = perBin * step;

  // Stretches of bins: a stretch ends at a long silence or an answer's edge.
  // Bins are counted from each stretch's first step, so none straddles a break.
  const stretches: Bin[][] = [];
  const magnitudes: number[] = [];
  let current: Bin[] | null = null;
  let start = 0;
  let last = 0;
  let segment = 0;
  let a = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!measured(v)) continue;
    const t = i * step;
    while (a < o.answers.length && o.answers[a].endMs <= t) a++;
    // An answer's index, or a negative id for the gap before it.
    const here = a < o.answers.length && t >= o.answers[a].startMs ? a : -1 - a;
    magnitudes.push(Math.abs(v));
    if (current === null || here !== segment || (i - last - 1) * step > LONG_GAP_MS) {
      current = [];
      stretches.push(current);
      start = i;
      segment = here;
    }
    last = i;
    const index = Math.floor((i - start) / perBin);
    const tMs = (i + 0.5) * step;
    const bin = current[current.length - 1];
    if (bin !== undefined && bin.index === index) {
      bin.values.push(v);
      bin.tSum += tMs;
      bin.last = i;
    } else {
      current.push({ index, values: [v], tSum: tMs, first: i, last: i });
    }
  }
  if (magnitudes.length === 0) return none;

  // Symmetric about zero (the user's own median), wide enough for all but the
  // top 1% of values, so one spike can't flatten everything else.
  magnitudes.sort((p, q) => p - q);
  const p99 = magnitudes[Math.min(magnitudes.length - 1, Math.floor(magnitudes.length * 0.99))];
  const limit = clampTo(Math.ceil(p99 / o.limitStep) * o.limitStep, o.minLimit, o.maxLimit);
  const half = mid - o.pad;
  const y = (v: number) => mid - (clampTo(v, -limit, limit) / limit) * half;
  const x = (ms: number) => clampTo((ms / o.durationMs) * o.width, 0, o.width);
  const sigma = SMOOTH_SIGMA_BINS * binMs;
  const binHalfPx = Math.max(1, binMs / msPerPx / 2);

  let line = "";
  let bridge = "";
  let area = "";
  const dots: CurvePoint[] = [];
  let bridged = false;
  for (const bins of stretches) {
    const times = bins.map((b) => b.tSum / b.values.length);
    const stats = bins.map((b) => {
      const sorted = [...b.values].sort((p, q) => p - q);
      return { mean: b.values.reduce((s, v) => s + v, 0) / b.values.length, low: quantile(sorted, BAND_LOW), high: quantile(sorted, BAND_HIGH) };
    });
    // Each bin's neighbours by time, weighted by a Gaussian and by their
    // sample count: a bin with one voiced step out of twelve is the noisiest,
    // and should pull the line least. The band's edges are smoothed the same
    // way, so the line and its band move together.
    const smooth = bins.map((_, j) => {
      let weight = 0;
      const sum = { mean: 0, low: 0, high: 0 };
      for (let m = Math.max(0, j - 3); m <= Math.min(bins.length - 1, j + 3); m++) {
        const d = (times[m] - times[j]) / sigma;
        const w = bins[m].values.length * Math.exp(-0.5 * d * d);
        weight += w;
        sum.mean += w * stats[m].mean;
        sum.low += w * stats[m].low;
        sum.high += w * stats[m].high;
      }
      return { x: x(times[j]), mean: sum.mean / weight, low: sum.low / weight, high: sum.high / weight };
    });
    const points = smooth.map((s) => ({ x: s.x, y: y(s.mean) }));
    // Bridged where a whole bin's worth of steps went unmeasured; anything
    // shorter is inside a bin's mean and below what the drawing can show.
    const joins: Join[] = bins.map((b, j) => (j > 0 && (b.first - bins[j - 1].last - 1) * step >= binMs ? "bridged" : "measured"));
    if (points.length === 1) dots.push(points[0]);
    const drawn = monotoneLine(points, joins);
    line += drawn.solid;
    bridge += drawn.bridge;
    if (drawn.bridge !== "") bridged = true;

    // The band covers measured spans only: nothing was measured across a bridge.
    let from = 0;
    for (let j = 1; j <= bins.length; j++) {
      if (j < bins.length && joins[j] !== "bridged") continue;
      const piece = smooth.slice(from, j);
      area += monotoneBand(
        piece.map((s) => ({ x: s.x, y: y(s.high) })),
        piece.map((s) => ({ x: s.x, y: y(s.low) })),
        binHalfPx
      );
      from = j;
    }
  }

  return { line, bridge, area, dots, zeroY: mid, limit, empty: false, bridged };
}

// ---------------------------------------------------------------------------
// Pace
// ---------------------------------------------------------------------------

/** An answer too short for a 15 s pace window, drawn at its own pace across its spoken span. */
export interface PaceSpan {
  turnId: string;
  wpm: number;
  startMs: number;
  endMs: number;
  x0: number;
  x1: number;
  y: number;
}

export interface PaceGeometry {
  line: string;
  /** Across a pace window that was dropped (under half speech): dotted. */
  bridge: string;
  /** The 15 s windows, measured: every one when there's room, else only those with no neighbour to join. */
  dots: CurvePoint[];
  spans: PaceSpan[];
  /** The session's average (the Pace figure), null when there is none. */
  avg: number | null;
  avgY: number;
  bandY0: number;
  bandY1: number;
  hi: number;
  lo: number;
  hiY: number;
  loY: number;
  /** No window, no answer pace and no session average. */
  empty: boolean;
}

export interface PaceOptions {
  points: ReadonlyArray<{ atMs: number; wpm: number }>;
  answers: ReadonlyArray<{ turnId: string; startMs: number; endMs: number; wpm: number | null; leadInMs: number | null }>;
  words: ReadonlyArray<{ s: number; e: number }>;
  wpmMean: number | null;
  band: { low: number; high: number };
  x: (ms: number) => number;
  height: number;
  pad: number;
}

/** First word's start to last word's end, which is what an answer's own pace is measured over. */
function spokenSpan(words: PaceOptions["words"], answer: PaceOptions["answers"][number]): { startMs: number; endMs: number } {
  let startMs = Infinity;
  let endMs = -Infinity;
  for (const w of words) {
    if (w.s < answer.startMs || w.s >= answer.endMs) continue;
    startMs = Math.min(startMs, w.s);
    endMs = Math.max(endMs, w.e);
  }
  if (Number.isFinite(startMs) && endMs > startMs) return { startMs, endMs };
  return { startMs: Math.min(answer.endMs, answer.startMs + (answer.leadInMs ?? 0)), endMs: answer.endMs };
}

/** Window dots are drawn only when windows sit at least this far apart. */
const MIN_DOT_SPACING_PX = 14;

export function buildPace(o: PaceOptions): PaceGeometry {
  const points = o.points.filter((p) => Number.isFinite(p.wpm) && Number.isFinite(p.atMs)).sort((p, q) => p.atMs - q.atMs);
  const answerIndexAt = (ms: number) => o.answers.findIndex((a) => ms >= a.startMs && ms < a.endMs);

  // Pace points exist only for full 15 s windows that are at least half
  // speech, so a short answer has none; its own pace, over its spoken span,
  // stands in, so the chart agrees with the Pace figure and the table.
  const spoken = o.answers
    .filter((a) => a.wpm !== null && Number.isFinite(a.wpm) && !points.some((p) => p.atMs >= a.startMs && p.atMs < a.endMs))
    .map((a) => ({ turnId: a.turnId, wpm: a.wpm as number, ...spokenSpan(o.words, a) }));
  const avg = o.wpmMean !== null && Number.isFinite(o.wpmMean) ? o.wpmMean : null;

  const values = [...points.map((p) => p.wpm), ...spoken.map((s) => s.wpm), ...(avg === null ? [] : [avg])];
  const min = values.length ? Math.min(...values) : o.band.low;
  const max = values.length ? Math.max(...values) : o.band.high;
  // Room for the band at least, and for every value with a little air.
  const lo = Math.min(100, Math.floor((min - 10) / 10) * 10);
  const hi = Math.max(200, Math.ceil((max + 10) / 10) * 10);
  const y = (wpm: number) => px(o.pad + ((hi - clampTo(wpm, lo, hi)) / (hi - lo)) * (o.height - o.pad * 2));

  // Break the line between answers, and across any gap much wider than the
  // series' own spacing, so it never draws speech across a question. A gap
  // of one dropped window is bridged, dotted.
  const gaps = points
    .slice(1)
    .map((p, i) => p.atMs - points[i].atMs)
    .sort((p, q) => p - q);
  const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  const breakAfter = Math.max(typical * 3, 20_000);
  const bridgeAfter = typical * 1.5;

  let line = "";
  let bridge = "";
  let run: CurvePoint[] = [];
  let joins: Join[] = [];
  // A run of one window has no length to stroke; it always gets its dot.
  const lone: CurvePoint[] = [];
  const flush = () => {
    const drawn = monotoneLine(run, joins);
    line += drawn.solid;
    bridge += drawn.bridge;
    if (run.length === 1) lone.push(run[0]);
    run = [];
    joins = [];
  };
  points.forEach((p, i) => {
    const prev = points[i - 1];
    const gap = prev === undefined ? Infinity : p.atMs - prev.atMs;
    if (prev === undefined || gap > breakAfter || answerIndexAt(p.atMs) !== answerIndexAt(prev.atMs)) flush();
    joins.push(run.length > 0 && typical > 0 && gap > bridgeAfter ? "bridged" : "measured");
    run.push({ x: o.x(p.atMs), y: y(p.wpm) });
  });
  flush();

  // A dot per window shows where each measurement sits, until they are so
  // close they'd bury the line they are on.
  const all = points.map((p) => ({ x: px(o.x(p.atMs)), y: y(p.wpm) }));
  const spacing = all
    .slice(1)
    .map((p, i) => p.x - all[i].x)
    .sort((p, q) => p - q);
  const roomy = spacing.length > 0 && spacing[Math.floor(spacing.length / 2)] >= MIN_DOT_SPACING_PX;

  return {
    line,
    bridge,
    dots: roomy ? all : lone.map((p) => ({ x: px(p.x), y: p.y })),
    spans: spoken.map((s) => {
      const x0 = px(o.x(s.startMs));
      return { ...s, x0, x1: px(Math.max(x0 + 4, o.x(s.endMs))), y: y(s.wpm) };
    }),
    avg,
    avgY: avg === null ? 0 : y(avg),
    bandY0: y(o.band.high),
    bandY1: y(o.band.low),
    hi,
    lo,
    hiY: y(hi),
    loY: y(lo),
    empty: points.length === 0 && spoken.length === 0 && avg === null,
  };
}
