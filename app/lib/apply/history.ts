// The resume step's change history (owner's design, 2026-10-19): one draft, one history. Every
// change to the draft (a tool's rewrite, keywords added to Skills, a part hidden for the job) is a
// step; undo and redo walk the steps one at a time, and the history list jumps straight to any of
// them. Going back never loses anything: the later steps wait, faded, until a new change is made
// there, which clears them.
//
// Each step keeps the draft's words, so going back to it is writing them again, and the score it
// had (with its report for the latest few), so the score jumps with it and nothing is re-scored.
// A step only ever keeps a score made by today's formula (owner, 2026-10-19: the score is no longer
// keyword match alone), so the list and undo's "73 → 80" never mix two ways of scoring.
// Pure: tests/apply.test.mjs runs it under plain `node --test`.

import { isCurrentScore } from "@/app/lib/ats/score";
import type { ScanReport } from "@/app/lib/ats/types";
import type { ResumeContent } from "@/app/lib/dashboard/types";

/** The numbers a score is made from: what tells a score of today's formula from an older one. */
export type ScoreBasis = Pick<ScanReport, "metrics" | "stuffingPenalty">;

export interface ApplyHistoryStep {
  id: string;
  /** What the change was, as the list says it: "Added 3 keywords to Skills". */
  label: string;
  /** When it was made, ISO-8601. */
  at: string;
  /** The draft's words after it. */
  content: ResumeContent;
  /** The draft version these words were saved as; a scan of that version scores this step. */
  version: number | null;
  /** Its score once scored. */
  score: number | null;
  /** The whole report, for the latest few steps only, so a jump back shows it without re-scoring. */
  report?: ScanReport | null;
  /** What `score` was made from, kept once `report` is dropped for room, so a reload can still check it. */
  basis?: ScoreBasis;
}

/** Most steps one application keeps: the oldest go first (the starting point stays). */
export const MAX_HISTORY_STEPS = 12;
/** Steps that keep their whole report: the session store has a size limit. */
export const REPORTS_KEPT = 4;

/** Keeps the list in bounds: the first step and the latest ones, and reports only on the latest few. */
function bounded(steps: ApplyHistoryStep[], at: number): { history: ApplyHistoryStep[]; at: number } {
  let history = steps;
  let index = at;
  if (history.length > MAX_HISTORY_STEPS) {
    const drop = history.length - MAX_HISTORY_STEPS;
    history = [history[0], ...history.slice(1 + drop)];
    index = Math.max(0, index - drop);
  }
  const keepFrom = history.length - REPORTS_KEPT;
  history = history.map((step, i) =>
    i < keepFrom && step.report
      ? { ...step, report: null, basis: { metrics: step.report.metrics, stuffingPenalty: step.report.stuffingPenalty ?? 0 } }
      : step,
  );
  return { history, at: index };
}

/**
 * The score a step takes from a scan: none from a partly checked one (going back rescores) or from
 * one an older formula made, which would not compare with the steps around it.
 */
export const scoreOfScan = (report: ScanReport | null | undefined): { score: number | null; report: ScanReport | null } =>
  report && !report.degraded && isCurrentScore(report) ? { score: Math.round(report.score), report } : { score: null, report: null };

/**
 * A new change: the steps after the current one are cleared (owner's design: "Making a new change
 * here clears the faded steps"), and the change becomes the latest step.
 */
export function pushStep(history: ApplyHistoryStep[], at: number, step: ApplyHistoryStep): { history: ApplyHistoryStep[]; at: number } {
  const kept = history.slice(0, Math.max(0, Math.min(at, history.length - 1)) + 1);
  return bounded([...kept, step], kept.length);
}

/** The step a scanned version belongs to gets its score (and report), when today's formula made it. */
export function scoreStep(history: ApplyHistoryStep[], version: number, report: ScanReport): ApplyHistoryStep[] {
  if (!isCurrentScore(report)) return history;
  let changed = false;
  const next = history.map((step) => {
    if (step.version !== version) return step;
    changed = true;
    return { ...step, score: Math.round(report.score), report };
  });
  return changed ? bounded(next, 0).history : history;
}

/**
 * The step the draft is at now takes this score of the draft's current version, whatever version it
 * was recorded with: its words ARE the draft's words, so the score belongs to it. Run before leaving
 * a step (a change, an undo, a jump), so going back to it shows the score it really had. A score an
 * older formula made is never stamped: the step keeps none, and going back to it rescores.
 */
export function stampStep(history: ApplyHistoryStep[], at: number, version: number, report: ScanReport): ApplyHistoryStep[] {
  if (!history[at] || !isCurrentScore(report)) return history;
  return bounded(
    history.map((step, i) => (i === at ? { ...step, version, score: Math.round(report.score), report } : step)),
    0,
  ).history;
}

/** A step's id: unique enough for one application's list. */
export const stepId = (now: number = Date.now()): string => `s${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** "10:11" from a step's time, in the viewer's clock. */
export const stepTime = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const SECTION_NAMES: Record<string, string> = {
  summary: "Summary",
  skills: "Skills",
  education: "Education",
  projects: "Projects",
  certifications: "Certifications",
};

/**
 * What changing the hidden parts did, as a history line: "Hid Summary for this job", "Showed
 * Education again", "Hid a line at Paystack", or "Changed what's hidden" for several at once.
 */
export function hiddenLabel(before: readonly string[], after: readonly string[], content: ResumeContent): string {
  const added = after.filter((key) => !before.includes(key));
  const removed = before.filter((key) => !after.includes(key));
  if (added.length + removed.length !== 1) return "Changed what's hidden for this job";
  const key = added[0] ?? removed[0];
  const hid = added.length === 1;
  const role = (id: string) => {
    const entry = content.experience.find((e) => e.id === id);
    return entry ? entry.company.trim() || entry.role.trim() || "a role" : "a role";
  };
  const line = /^exp:([^:]+):\d+$/.exec(key);
  const what = SECTION_NAMES[key] ?? (line ? `a line at ${role(line[1])}` : key.startsWith("exp:") ? role(key.slice(4)) : "a part");
  return hid ? `Hid ${what} for this job` : `Showed ${what} again`;
}
