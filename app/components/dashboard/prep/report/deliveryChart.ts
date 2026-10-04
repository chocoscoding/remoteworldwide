// The Delivery tab's one chart: pitch, pace and energy on a shared time axis,
// each drawn against the speaker's own usual in this session, so the three
// lines share one "usual" line in the middle and read as "higher" or "lower"
// than it rather than in three units that have nothing in common.
//
//  - Pitch (semitones) and energy (dB) arrive relative to the session's own
//    median already; deliveryCurves' `buildWave` scales each to the chart's
//    height around that zero, as wide as all but the top 1% of its values.
//  - Pace (wpm) is centred here on the session's average, the Pace figure,
//    and scaled the same way, so a stretch faster than usual sits above the
//    line like a stretch of higher pitch does.
//
// The curves themselves (pooling, bridged pauses, a monotone cubic that never
// overshoots) are deliveryCurves'. This file adds the centring, the answer
// bands, the readout at a moment, and the per-answer figures the table shows.
//
// Pure: no React, no DOM.

import type { DeliveryAnswer, DeliveryFlag, DeliveryReport } from "@/app/lib/voice/types";
import { buildWave, monotoneLine, px, type CurvePoint, type Join, type WaveGeometry } from "../delivery/deliveryCurves";

/** Each line's colour; the legend and the table use the same. */
export const CHART_COLORS = { pitch: "#6c7a1e", pace: "#2f55c4", energy: "#b23c26" } as const;

const clampTo = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const finite = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The recording's length, trusting the report but never cutting off data it carries. */
export function chartDuration(delivery: Pick<DeliveryReport, "durationMs" | "answers" | "series">): number {
  let end = delivery.durationMs > 0 ? delivery.durationMs : 0;
  for (const answer of delivery.answers) end = Math.max(end, answer.endMs);
  if (end === 0) end = Math.max(delivery.series.pitchSt.length, delivery.series.energyDb.length) * delivery.series.stepMs;
  return end;
}

// ---------------------------------------------------------------------------
// Pace, around the session's own average
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

export interface CenteredPace {
  line: string;
  /** Across one dropped pace window: drawn dotted. */
  bridge: string;
  /** A run of one window has no length to stroke; it is drawn as a dot. */
  dots: CurvePoint[];
  spans: PaceSpan[];
  /** The usual pace the line is drawn around: the session's average, else the middle of what was measured. */
  centre: number | null;
  /** How many wpm either side of usual reach the top and bottom of the chart. */
  limit: number;
  /** Nothing to draw: no window and no answer with a pace. */
  empty: boolean;
}

export interface PaceOptions {
  points: ReadonlyArray<{ atMs: number; wpm: number }>;
  answers: ReadonlyArray<Pick<DeliveryAnswer, "turnId" | "startMs" | "endMs" | "wpm" | "leadInMs">>;
  words: ReadonlyArray<{ s: number; e: number }>;
  wpmMean: number | null;
  durationMs: number;
  width: number;
  height: number;
  pad: number;
}

/** The pace scale runs ±limit around usual, rounded up to this step and held within these. */
const PACE_LIMIT = { min: 20, max: 60, step: 10 } as const;

/** First word's start to last word's end: what an answer's own pace is measured over. */
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

export function buildCenteredPace(o: PaceOptions): CenteredPace {
  const points = o.points.filter((p) => finite(p.wpm) && finite(p.atMs)).sort((p, q) => p.atMs - q.atMs);
  const spoken = o.answers
    .filter((a) => finite(a.wpm) && !points.some((p) => p.atMs >= a.startMs && p.atMs < a.endMs))
    .map((a) => ({ turnId: a.turnId, wpm: a.wpm as number, ...spokenSpan(o.words, a) }));
  const measured = [...points.map((p) => p.wpm), ...spoken.map((s) => s.wpm)];
  const centre = finite(o.wpmMean) ? o.wpmMean : measured.length > 0 ? median(measured) : null;
  const none: CenteredPace = { line: "", bridge: "", dots: [], spans: [], centre, limit: PACE_LIMIT.min, empty: true };
  if (centre === null || measured.length === 0 || o.width <= 0 || o.durationMs <= 0) return none;

  // Wide enough for all but the top 1% of the distances from usual.
  const distances = measured.map((v) => Math.abs(v - centre)).sort((a, b) => a - b);
  const p99 = distances[Math.min(distances.length - 1, Math.floor(distances.length * 0.99))];
  const limit = clampTo(Math.ceil(p99 / PACE_LIMIT.step) * PACE_LIMIT.step, PACE_LIMIT.min, PACE_LIMIT.max);
  const mid = o.height / 2;
  const half = mid - o.pad;
  const y = (wpm: number) => px(mid - clampTo((wpm - centre) / limit, -1, 1) * half);
  const x = (ms: number) => clampTo((ms / o.durationMs) * o.width, 0, o.width);
  const answerIndexAt = (ms: number) => o.answers.findIndex((a) => ms >= a.startMs && ms < a.endMs);

  // Break between answers and across any gap much wider than the windows'
  // own spacing, so the line never draws speech across a question; a gap of
  // one dropped window is bridged, dotted.
  const gaps = points
    .slice(1)
    .map((p, i) => p.atMs - points[i].atMs)
    .sort((p, q) => p - q);
  const typical = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0;
  const breakAfter = Math.max(typical * 3, 20_000);
  const bridgeAfter = typical * 1.5;

  let line = "";
  let bridge = "";
  const dots: CurvePoint[] = [];
  let run: CurvePoint[] = [];
  let joins: Join[] = [];
  const flush = () => {
    const drawn = monotoneLine(run, joins);
    line += drawn.solid;
    bridge += drawn.bridge;
    if (run.length === 1) dots.push({ x: px(run[0].x), y: run[0].y });
    run = [];
    joins = [];
  };
  points.forEach((p, i) => {
    const prev = points[i - 1];
    const gap = prev === undefined ? Infinity : p.atMs - prev.atMs;
    if (prev === undefined || gap > breakAfter || answerIndexAt(p.atMs) !== answerIndexAt(prev.atMs)) flush();
    joins.push(run.length > 0 && typical > 0 && gap > bridgeAfter ? "bridged" : "measured");
    run.push({ x: x(p.atMs), y: y(p.wpm) });
  });
  flush();

  return {
    line,
    bridge,
    dots,
    spans: spoken.map((s) => {
      const x0 = px(x(s.startMs));
      return { ...s, x0, x1: px(Math.max(x0 + 4, x(s.endMs))), y: y(s.wpm) };
    }),
    centre,
    limit,
    empty: false,
  };
}

// ---------------------------------------------------------------------------
// The whole chart
// ---------------------------------------------------------------------------

export interface AnswerBand {
  turnId: string;
  /** The answer's number as the reader saw it ("Answer 3"). */
  number: number;
  startMs: number;
  endMs: number;
  x0: number;
  x1: number;
}

export interface FlagMark {
  flag: DeliveryFlag;
  number: number | null;
  x: number;
}

export interface ChartGeometry {
  /** The plot's own width; every x below is from its left edge. */
  width: number;
  /** The plot's own height; every y below is from its top. */
  height: number;
  durationMs: number;
  pitch: WaveGeometry;
  energy: WaveGeometry;
  pace: CenteredPace;
  answers: AnswerBand[];
  flags: FlagMark[];
  ticks: Array<{ ms: number; x: number }>;
}

/** The minimum distance between time-axis labels. */
const MIN_TICK_PX = 64;
const TICK_STEPS_S = [15, 30, 60, 120, 300, 600, 900, 1800, 3600];

export function buildTicks(durationMs: number, width: number): Array<{ ms: number; x: number }> {
  if (durationMs <= 0 || width <= 0) return [];
  const stepS = TICK_STEPS_S.find((s) => ((s * 1000) / durationMs) * width >= MIN_TICK_PX) ?? TICK_STEPS_S[TICK_STEPS_S.length - 1];
  const ticks: Array<{ ms: number; x: number }> = [];
  for (let ms = 0; ms <= durationMs; ms += stepS * 1000) ticks.push({ ms, x: px((ms / durationMs) * width) });
  return ticks;
}

export function buildChart(
  delivery: DeliveryReport,
  numbers: ReadonlyMap<string, number>,
  size: { width: number; height: number; pad: number }
): ChartGeometry | null {
  const durationMs = chartDuration(delivery);
  const { width, height, pad } = size;
  if (durationMs <= 0 || width <= 0) return null;
  const x = (ms: number) => (clampTo(ms, 0, durationMs) / durationMs) * width;
  const answers = [...delivery.answers].sort((a, b) => a.startMs - b.startMs);
  const bands: AnswerBand[] = answers.map((a, i) => ({
    turnId: a.turnId,
    number: numbers.get(a.turnId) ?? i + 1,
    startMs: a.startMs,
    endMs: a.endMs,
    x0: px(x(a.startMs)),
    x1: px(Math.max(x(a.startMs) + 3, x(a.endMs))),
  }));
  const numberOf = new Map(bands.map((b) => [b.turnId, b.number]));
  const wave = { stepMs: delivery.series.stepMs, durationMs, width, height, pad, answers };
  return {
    width,
    height,
    durationMs,
    pitch: buildWave(delivery.series.pitchSt, { ...wave, minLimit: 4, maxLimit: 12, limitStep: 2 }),
    energy: buildWave(delivery.series.energyDb, { ...wave, minLimit: 6, maxLimit: 18, limitStep: 3 }),
    pace: buildCenteredPace({
      points: delivery.series.pace,
      answers,
      words: delivery.transcript?.words ?? [],
      wpmMean: delivery.metrics.wpmMean,
      durationMs,
      width,
      height,
      pad,
    }),
    answers: bands,
    flags: [...delivery.flags]
      .sort((a, b) => a.atMs - b.atMs)
      .map((flag) => ({ flag, number: numberOf.get(flag.turnId) ?? null, x: px(x(flag.atMs)) })),
    ticks: buildTicks(durationMs, width),
  };
}

// ---------------------------------------------------------------------------
// Reading a moment
// ---------------------------------------------------------------------------

/** The series' mean over ±1 s, so a reading is a moment, not one noisy sample. */
export function seriesAt(values: ReadonlyArray<number | null>, stepMs: number, ms: number): number | null {
  const step = stepMs > 0 ? stepMs : 250;
  const centre = Math.floor(ms / step);
  const reach = Math.max(0, Math.round(1000 / step));
  let sum = 0;
  let n = 0;
  for (let i = Math.max(0, centre - reach); i <= Math.min(values.length - 1, centre + reach); i++) {
    const v = values[i];
    if (!finite(v)) continue;
    sum += v;
    n++;
  }
  return n === 0 ? null : sum / n;
}

/** The series' mean over a window, for an answer's figures. */
export function seriesMean(values: ReadonlyArray<number | null>, stepMs: number, startMs: number, endMs: number): number | null {
  const step = stepMs > 0 ? stepMs : 250;
  let sum = 0;
  let n = 0;
  for (let i = Math.max(0, Math.floor(startMs / step)); i < Math.min(values.length, Math.ceil(endMs / step)); i++) {
    const v = values[i];
    if (!finite(v)) continue;
    sum += v;
    n++;
  }
  return n === 0 ? null : sum / n;
}

export interface ChartReading {
  ms: number;
  /** The answer the moment is in, if any. */
  answer: AnswerBand | null;
  /** That answer's figures, or the last answer before the moment's when it is between answers. */
  figures: DeliveryAnswer | null;
  /** Semitones against usual, at the moment. */
  pitch: number | null;
  /** Words a minute, at the moment. */
  pace: number | null;
  /** The pace is the answer's own, over its spoken span: it had no 15 s window. */
  paceWhole: boolean;
  /** Decibels against usual, at the moment. */
  energy: number | null;
}

export function readingAt(ms: number, delivery: DeliveryReport, chart: ChartGeometry): ChartReading {
  const answer = chart.answers.find((a) => ms >= a.startMs && ms < a.endMs) ?? null;
  const before = [...chart.answers].reverse().find((a) => a.startMs <= ms) ?? null;
  const figuresOf = (band: AnswerBand | null) => (band ? (delivery.answers.find((a) => a.turnId === band.turnId) ?? null) : null);
  let pace: number | null = null;
  let paceWhole = false;
  if (answer) {
    let best = Infinity;
    for (const p of delivery.series.pace) {
      const distance = Math.abs(p.atMs - ms);
      if (p.atMs >= answer.startMs && p.atMs < answer.endMs && distance <= 10_000 && distance < best) {
        best = distance;
        pace = p.wpm;
      }
    }
    const span = pace === null ? chart.pace.spans.find((s) => s.turnId === answer.turnId) : undefined;
    if (span) {
      pace = span.wpm;
      paceWhole = true;
    }
  }
  return {
    ms,
    answer,
    figures: figuresOf(answer ?? before),
    pitch: answer ? seriesAt(delivery.series.pitchSt, delivery.series.stepMs, ms) : null,
    pace,
    paceWhole,
    energy: answer ? seriesAt(delivery.series.energyDb, delivery.series.stepMs, ms) : null,
  };
}

// ---------------------------------------------------------------------------
// The same, per answer, for the table
// ---------------------------------------------------------------------------

export interface AnswerFigures {
  turnId: string;
  number: number;
  startMs: number;
  endMs: number;
  wpm: number | null;
  /** Words a minute above (+) or below (−) the session's usual pace. */
  paceVsUsual: number | null;
  /** Mean semitones against the session's usual pitch. */
  pitch: number | null;
  pitchRangeSt: number | null;
  /** Mean decibels against the session's usual loudness. */
  energy: number | null;
  flags: number;
}

export function answerFigures(delivery: DeliveryReport, numbers: ReadonlyMap<string, number>, usualWpm: number | null): AnswerFigures[] {
  const { series } = delivery;
  return [...delivery.answers]
    .sort((a, b) => a.startMs - b.startMs)
    .map((a, i) => ({
      turnId: a.turnId,
      number: numbers.get(a.turnId) ?? i + 1,
      startMs: a.startMs,
      endMs: a.endMs,
      wpm: finite(a.wpm) ? a.wpm : null,
      paceVsUsual: finite(a.wpm) && finite(usualWpm) ? a.wpm - usualWpm : null,
      pitch: seriesMean(series.pitchSt, series.stepMs, a.startMs, a.endMs),
      pitchRangeSt: finite(a.pitchRangeSt) ? a.pitchRangeSt : null,
      energy: seriesMean(series.energyDb, series.stepMs, a.startMs, a.endMs),
      flags: delivery.flags.filter((f) => f.turnId === a.turnId).length,
    }));
}
