// "Fix these in my resume" (owner, 2026-10-18): the ATS report hands everything it suggested to the
// resume editor, which puts the report on the resume as its check and sends the fixes to Ask.
//
// Kept in sessionStorage, not the address: a report's findings run past what a link should carry,
// and they belong to this tab only. Read once on arrival, then removed, so a refresh never sends
// the same fixes (and spends a credit) twice.

// Reads the report itself rather than through `./api` (its `unmetRequirements`), so it loads in the
// node tests, which cannot strip `api/core`'s classes.
import { isPostingNote, type ScanReport } from "./types";

export const FIX_HANDOFF_KEY = "rww:ats-fix";

/** The posting a job report was scored against, so the editor's check can be run again. */
export interface FixPosting {
  company: string;
  role: string;
  description: string;
}

export interface FixHandoff {
  v: 1;
  /** Epoch ms. A hand-off older than ten minutes is left alone: the person moved on. */
  at: number;
  /** The library id of the resume the report scored (the document itself for a made-here resume). */
  resumeId: string;
  report: ScanReport;
  job: FixPosting | null;
  /** Each finding as one instruction line, the most useful first (AI: MAX_ASK_FIXES, MAX_ASK_FIX_CHARS). */
  fixes: string[];
  /** What the Ask box says it was asked: short, the detail is in `fixes`. */
  instruction: string;
}

const MAX_FIXES = 12;
const MAX_FIX_CHARS = 400;
const MAX_REWRITES = 3;
const MAX_GAPS = 6;
const FRESH_MS = 10 * 60 * 1000;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const quote = (text: string) => `"${clip(text.replace(/\s+/g, " ").trim(), 140)}"`;

/** The posting's gaps, missing before partly shown and heaviest first, as the report lists them. */
const gapsOf = (report: ScanReport) =>
  report.verdicts
    .filter((verdict) => (verdict.state === "missing" || verdict.state === "partial") && !isPostingNote(verdict.requirement))
    .sort((a, b) => (a.state === b.state ? 0 : a.state === "missing" ? -1 : 1) || b.requirement.weight - a.requirement.weight);

/** Every correction the report made, as Ask reads them: rewrites, the posting's gaps, advice, stuffing. */
export function fixesFor(report: ScanReport, job: FixPosting | null): string[] {
  const out: string[] = [];

  for (const rewrite of report.rewrites.slice(0, MAX_REWRITES)) {
    if (!rewrite.after.trim() || rewrite.after.trim() === rewrite.before.trim()) continue;
    out.push(`Replace ${quote(rewrite.before)} with ${quote(rewrite.after)}${rewrite.why ? ` (${rewrite.why})` : ""}.`);
  }

  if (job) {
    for (const verdict of gapsOf(report).slice(0, MAX_GAPS)) {
      const { requirement } = verdict;
      const asked = clip((requirement.label || requirement.text).trim(), 80);
      const closest = verdict.evidence[0]?.text;
      out.push(
        closest
          ? `The posting asks for ${quote(asked)}, ${verdict.state === "partial" ? "partly shown" : "not shown"}. Reword ${quote(closest)} so it shows it.`
          : `The posting asks for ${quote(asked)}, not shown. Work it into the summary or the line it fits best.`,
      );
    }
  }

  for (const advice of report.advice ?? []) {
    const lines = advice.lines.length > 0 ? ` Lines: ${advice.lines.map(quote).join(", ")}.` : "";
    out.push(`${advice.title}. ${advice.detail}${lines}`);
  }

  const stuffing = report.stuffing ?? [];
  if (stuffing.length > 0) out.push(`It reads as stuffed: ${stuffing.join("; ")}. Say each keyword once, next to the work that proves it, and keep only the numbers that matter most.`);

  return out.map((fix) => clip(fix, MAX_FIX_CHARS)).slice(0, MAX_FIXES);
}

export function fixInstruction(job: FixPosting | null): string {
  return job
    ? `Fix what my ATS check against ${clip(job.company, 60)} found, in the lines I already have.`
    : "Fix what my ATS check found, in the lines I already have.";
}

export function writeFixHandoff(handoff: Omit<FixHandoff, "v" | "at">): boolean {
  try {
    window.sessionStorage.setItem(FIX_HANDOFF_KEY, JSON.stringify({ v: 1, at: Date.now(), ...handoff }));
    return true;
  } catch {
    return false;
  }
}

/** Where the button leads: the resume itself when made here, else the editable copy of the file. */
export function fixHref(resume: { id: string; source: string }): string {
  const id = encodeURIComponent(resume.id);
  return resume.source === "created" ? `/dashboard/resume?doc=${id}&fix=1` : `/dashboard/resume?from=${id}&fix=1`;
}

/**
 * The hand-off, once: read and removed. Only an arrival through `fixHref` (`?fix=1`) reads it; the
 * resume opened is the one the link named, or the editable copy of it, so the id is not compared.
 */
export function takeFixHandoff(): FixHandoff | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(FIX_HANDOFF_KEY);
    if (raw) window.sessionStorage.removeItem(FIX_HANDOFF_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FixHandoff>;
    if (parsed.v !== 1 || typeof parsed.at !== "number" || Date.now() - parsed.at > FRESH_MS) return null;
    if (!parsed.report || !Array.isArray(parsed.fixes) || typeof parsed.instruction !== "string") return null;
    return parsed as FixHandoff;
  } catch {
    return null;
  }
}
