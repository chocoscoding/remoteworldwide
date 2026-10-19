// The ATS score on the website, kept apart from api.ts (which talks to the network) so it can be
// tested on its own: its cap, "not checked", and the recipe the AI service scores by (owner,
// 2026-10-19: 70% keyword match, 15% impact language, 10% parseability, 5% length & format).

import type { AtsMetric } from "@/app/lib/dashboard/types";
import { isPostingNote, type RequirementVerdict, type ScanReport } from "./types";

/** The highest score any scan shows (owner, 2026-10-18): there is always something left to ask for. */
export const MAX_SCAN_SCORE = 99;

/** A metric the scan could not measure this time: shown as "not checked", never as 0. */
export const isUnchecked = (metric: Pick<AtsMetric, "value" | "checked"> | undefined): boolean =>
  metric !== undefined && (metric.checked === false || metric.value === null);

/**
 * How the ATS score is made, in whole percents (owner, 2026-10-19: "the ATS is meant to be more than
 * a keyword matcher"). Mirrors SCORING_WEIGHTS.headline in the AI service's scoringService.ts; its
 * contract test (frontend-types.test.ts) fails if they drift.
 */
export const HEADLINE_SHARES = { "keyword-match": 70, "impact-language": 15, parseability: 10, "length-format": 5 } as const;

/** Stuffing comes off only from this score, and never takes it below one point under it (STUFFING_FROM_SCORE). */
export const STUFFING_FROM_SCORE = 94;

const metricOf = (report: Pick<ScanReport, "metrics">, id: string) => report.metrics.find((metric) => metric.id === id);

/**
 * The score a report's own numbers make by today's formula: the 70/15/10/5 blend in whole percents
 * when keyword match was measured, the mean of the other three when it was not, less the stuffing
 * that came off, never above 99. Null when the report lacks a metric to make it from.
 */
export function expectedScore(report: Pick<ScanReport, "metrics" | "stuffingPenalty">): number | null {
  const value = (id: keyof typeof HEADLINE_SHARES): number | null => {
    const metric = metricOf(report, id);
    return metric && !isUnchecked(metric) && typeof metric.value === "number" ? metric.value : null;
  };
  const impact = value("impact-language");
  const parseability = value("parseability");
  const length = value("length-format");
  if (impact === null || parseability === null || length === null) return null;
  const keyword = value("keyword-match");
  const made =
    keyword === null
      ? Math.round((impact + parseability + length) / 3)
      : Math.round(
          (keyword * HEADLINE_SHARES["keyword-match"] +
            impact * HEADLINE_SHARES["impact-language"] +
            parseability * HEADLINE_SHARES.parseability +
            length * HEADLINE_SHARES["length-format"]) /
            100,
        );
  return Math.max(0, Math.min(MAX_SCAN_SCORE, made - (report.stuffingPenalty ?? 0)));
}

/**
 * Whether a stored report was scored by today's formula: its score is what its own numbers make.
 * One scored before 2026-10-19, when the score was keyword match alone, reads false, and is rescored
 * rather than compared with today's ("Up 18 since last change" would be the formula, not the
 * resume). A report too old to have all four metrics reads true: there is nothing to tell by.
 */
export function isCurrentScore(report: Pick<ScanReport, "score" | "metrics" | "stuffingPenalty">): boolean {
  const expected = expectedScore(report);
  return expected === null || expected === report.score;
}

/**
 * What a scan's number says about itself, the same on the report screen and in the downloaded
 * report. Never its recipe (owner, 2026-10-19: "70% keyword match" read as a keyword matcher).
 * `keywordChecked` is false for a general scan and for one whose keyword match could not be checked.
 *
 * - `partial` follows partialLine on a partly checked scan.
 * - `current` is false for a scan scored before 2026-10-19, when the score was keyword match alone:
 *   a rescore gives today's number, and nothing is projected from the old one.
 */
export function scoreMakeup(
  report: Pick<ScanReport, "score" | "metrics" | "stuffingPenalty">,
  { keywordChecked }: { keywordChecked: boolean },
): { partial: string; current: boolean } {
  // A general scan's stored keyword match (a 0 before it could say "not checked") is not in its score.
  const shown = keywordChecked ? report : { ...report, metrics: report.metrics.filter((metric) => metric.id !== "keyword-match") };
  const expected = expectedScore(shown);
  return {
    partial: keywordChecked ? "A rescore checks the rest." : "Until then, the score shows how the resume reads.",
    current: expected === null || expected === report.score,
  };
}

/**
 * How the scorer weighs one requirement (SCORING_WEIGHTS in the AI service's scoringService.ts:
 * type, category, coverage, confidence), mirrored so a projection is the rescore's own arithmetic.
 * The contract test (frontend-types.test.ts) fails if they drift.
 */
export const REQUIREMENT_WEIGHTS = {
  type: { required: 1, preferred: 0.4 },
  category: { responsibility: 0.5 },
  coverage: { satisfied: 1, partial: 0.5, missing: 0 },
  confidence: { high: 1, medium: 0.9, low: 0.75 },
} as const;

/** A requirement's weight as keyword match counts it: its 1 to 5, by its type and category. */
const weightOf = (verdict: RequirementVerdict): number => {
  const raw = Number.isFinite(verdict.requirement.weight) ? Math.min(5, Math.max(1, verdict.requirement.weight)) : 1;
  const category = (REQUIREMENT_WEIGHTS.category as Partial<Record<string, number>>)[verdict.requirement.category] ?? 1;
  return raw * (REQUIREMENT_WEIGHTS.type[verdict.requirement.type] ?? 1) * category;
};

/**
 * What meeting each unmet requirement would add to the score, unrounded, by its id (owner,
 * 2026-10-19): the credit it still lacks, as a share of every requirement the scan checked, at
 * keyword match's share of the score. Ticking every gap projects what a rescore would give, before
 * the 99 cap and any stuffing. A partly met one projects only the half it still lacks. Empty when
 * keyword match was not checked: closing a gap moves nothing else.
 */
export function projectedLifts(report: Pick<ScanReport, "verdicts" | "metrics">): Map<string, number> {
  const lifts = new Map<string, number>();
  if (isUnchecked(metricOf(report, "keyword-match"))) return lifts;
  const scored = report.verdicts.filter((verdict) => verdict.state !== "undetermined" && !isPostingNote(verdict.requirement));
  const possible = scored.reduce((sum, verdict) => sum + weightOf(verdict), 0);
  if (possible <= 0) return lifts;
  for (const verdict of scored) {
    if (verdict.state === "satisfied" || verdict.state === "undetermined") continue;
    const earned = REQUIREMENT_WEIGHTS.coverage[verdict.state] * (REQUIREMENT_WEIGHTS.confidence[verdict.confidence] ?? 1);
    lifts.set(verdict.requirement.id, (HEADLINE_SHARES["keyword-match"] * weightOf(verdict) * (1 - earned)) / possible);
  }
  return lifts;
}
