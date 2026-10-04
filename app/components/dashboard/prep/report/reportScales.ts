// How the report colours and words its numbers: the score ring, the
// scorecard's bars, the pace verdict and the one-line delivery summaries.
// Pure, so the tabs and the tests read the same thresholds. Nothing here
// scores anything: every number is the AI service's, this only says which
// band it falls in and how to write it.

import type { DeliveryFlag, DeliveryMetrics } from "@/app/lib/voice/types";

export type ScoreBand = "low" | "mid" | "high";

/** The overall 0-100 score: red under 50, amber from 50 to 74, lime-green from 75. */
export const overallBand = (score: number): ScoreBand => (score < 50 ? "low" : score < 75 ? "mid" : "high");

/** One dimension's 0-10 score: red under 5, amber under 7, lime-green from 7. */
export const dimensionBand = (score: number): ScoreBand => (score < 5 ? "low" : score < 7 ? "mid" : "high");

/** The band's colour, for SVG strokes. */
export const BAND_COLOR: Record<ScoreBand, string> = { low: "#e02d2d", mid: "#d99a00", high: "#cddd54" };

/** The same colours as literal classes, so Tailwind's scan keeps them. */
export const BAND_BG: Record<ScoreBand, string> = { low: "bg-[#e02d2d]", mid: "bg-[#d99a00]", high: "bg-[#cddd54]" };

/** "3", "4.8", "9.5": a score as the service gave it, never more than one decimal. */
export const formatScore = (score: number): string => (Number.isInteger(score) ? String(score) : (Math.round(score * 10) / 10).toFixed(1));

/** Where the average pace sat against the 140-160 band many listeners find easy to follow. */
export type PaceVerdict = "in range" | "fast" | "slow";

export function paceVerdict(wpm: number, band: { low: number; high: number }): PaceVerdict {
  if (wpm < band.low) return "slow";
  if (wpm > band.high) return "fast";
  return "in range";
}

/** Below this change per answer, energy reads as steady. */
export const STEADY_DB = 0.5;

export type EnergyWord = "Steady" | "Fading" | "Building";

export const energyWord = (trend: number): EnergyWord => (trend <= -STEADY_DB ? "Fading" : trend >= STEADY_DB ? "Building" : "Steady");

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The delivery card's headline: "nothing stood out", or how many kinds of
 * finding did ("2 things stood out"). Kinds, not moments: three filler moments
 * are one thing to work on.
 */
export function deliveryHeadline(flags: readonly Pick<DeliveryFlag, "kind">[]): string {
  const kinds = new Set(flags.map((flag) => flag.kind)).size;
  return kinds === 0 ? "nothing stood out" : `${plural(kinds, "thing")} stood out`;
}

/**
 * Overall's one line on delivery: "140 wpm · 1 long pause · 2.8 fillers per
 * 100 words". What wasn't measured is left out; null when nothing was.
 */
export function deliverySummary(metrics: Pick<DeliveryMetrics, "wpmMean" | "longPauses" | "fillersPer100Words">): string | null {
  const parts: string[] = [];
  if (metrics.wpmMean !== null && Number.isFinite(metrics.wpmMean)) parts.push(`${Math.round(metrics.wpmMean)} wpm`);
  if (Number.isFinite(metrics.longPauses)) parts.push(plural(metrics.longPauses, "long pause"));
  if (metrics.fillersPer100Words !== null && Number.isFinite(metrics.fillersPer100Words)) parts.push(`${metrics.fillersPer100Words.toFixed(1)} fillers per 100 words`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "and"-joined, for a sentence: "a", "a and b", "a, b and c". */
export function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
