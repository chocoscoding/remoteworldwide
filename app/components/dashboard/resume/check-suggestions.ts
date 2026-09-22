// The resume editor's suggestion cards, derived from the standing ATS check.
//
// These used to be three fixed cards out of `mock-data.ts` — a missing
// "developer experience" keyword, two Paystack bullets, a skills section
// "buried on page 2" — shown on every resume that had been checked against
// anything, whatever the check had actually found. Every card here is now a
// finding the check made about THIS document, stated with the number behind
// it, and wired to the tool that acts on it:
//
//   keywords  the posting's requirements the scan found missing   -> the `keywords` tool, with those terms
//   rewrite   a bullet rewrite the scan's write-up proposed        -> applied locally; the scan already paid for it
//   quantify  impact language in the "needs work" band, and bullets
//             with no number to show for it                        -> the `quantify` tool
//   shorten   length & format in the "needs work" band, on a
//             resume that runs past one page                       -> the `shorten` tool
//
// Derived, never stored, and free: the scan is already on the document, so
// reading it again costs nothing, and a card cannot outlive the check it came
// from — Remove the check and its cards go with it.
//
// "Needs work" is the dashboard's shared banding (`scanTier`), applied to the
// metric rather than invented for it, so a card says the same thing about a
// number that the ATS screen's own tile would.

import { keywordLabel, missingGaps, scanTier } from "@/app/lib/ats/api";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeCheck } from "./resume-document";

export type CheckSuggestionKind = "keywords" | "rewrite" | "quantify" | "shorten";

export interface CheckSuggestion {
  /** Scoped to the scan, so a fresh check never inherits an old card's "applied". */
  id: string;
  kind: CheckSuggestionKind;
  title: string;
  detail: string;
  /** Keywords: the terms the action will ask the `keywords` tool to work in. */
  terms?: string[];
  /**
   * Rewrite: the proposed line, and where its original stands in the document
   * NOW. `at` is null once that line has been edited away — the rewrite can no
   * longer be applied to anything, so the card is not offered.
   */
  rewrite?: { before: string; after: string; why: string; at: { entryIndex: number; bulletIndex: number } | null };
}

/** The `keywords` tool caps each term at this many characters; a longer "keyword" is a requirement sentence, not a term to append. */
const MAX_TERM_CHARS = 48;
/** The tool takes at most this many terms per run. */
const MAX_TERMS = 8;
/** Phase two proposes at most three; the cap is only a guard. */
const MAX_REWRITE_CARDS = 3;

const METRIC_IMPACT = "impact-language";
const METRIC_LENGTH = "length-format";

/**
 * A line as the scorer quoted it, comparable with a line in the editor. The
 * ingested text writes each bullet as "- …", and the chunker may or may not
 * keep that marker, so leading bullet glyphs are dropped along with runs of
 * whitespace before comparing.
 */
const comparable = (line: string): string =>
  line
    .replace(/^[\s•●▪■◦‣*\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();

/** Where a quoted line stands in the document now, or null when it has been edited away. */
function locateBullet(content: ResumeContent, quoted: string): { entryIndex: number; bulletIndex: number } | null {
  const target = comparable(quoted);
  if (!target) return null;
  for (let entryIndex = 0; entryIndex < content.experience.length; entryIndex += 1) {
    const bulletIndex = content.experience[entryIndex].bullets.findIndex((bullet) => comparable(bullet) === target);
    if (bulletIndex !== -1) return { entryIndex, bulletIndex };
  }
  return null;
}

/**
 * Applies one of the scan's bullet rewrites to the content as it is now:
 * re-located by its quoted text rather than trusted at a remembered index, and
 * a no-op when the original line is no longer there — edited since, it is the
 * user's line, not the scan's.
 */
export function applyBulletRewrite(content: ResumeContent, before: string, after: string): ResumeContent {
  const at = locateBullet(content, before);
  if (!at) return content;
  return {
    ...content,
    experience: content.experience.map((entry, i) =>
      i === at.entryIndex ? { ...entry, bullets: entry.bullets.map((bullet, j) => (j === at.bulletIndex ? after : bullet)) } : entry,
    ),
  };
}

const needsWork = (value: number | undefined): value is number => value !== undefined && scanTier(value).tone === "urgent";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Every card the standing check supports, against the document as it is now.
 *
 * `pageCount` is the editor's own page ruler — the length card needs a fact
 * about the rendered document that the scan's text alone does not carry.
 */
export function deriveCheckSuggestions(check: ResumeCheck | null, content: ResumeContent, pageCount: number): CheckSuggestion[] {
  if (!check) return [];
  const { report } = check;
  const scope = report.scanId || check.at.toISOString();
  const out: CheckSuggestion[] = [];

  // 1 · Missing keywords — a job check only; a general check has no posting
  // for anything to be missing from. Terms already in the skills or summary
  // (typed since the check ran) are not offered again.
  if (check.posting) {
    const inDoc = `${content.skills.join(" \n ")} \n ${content.summary}`.toLowerCase();
    const seen = new Set<string>();
    const terms = missingGaps(report)
      .map((gap) => keywordLabel(gap.label))
      .filter((term) => {
        const key = term.toLowerCase();
        if (!term || term.length > MAX_TERM_CHARS || seen.has(key) || inDoc.includes(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_TERMS);

    if (terms.length > 0) {
      const quoted = terms.map((term) => `“${term}”`).join(", ");
      out.push({
        id: `${scope}:keywords`,
        kind: "keywords",
        terms,
        title: terms.length === 1 ? `Missing keyword: ${quoted}` : `${terms.length} keywords this posting wants are missing`,
        detail: `Your check against ${check.job ?? "this job"} didn't find ${terms.length === 1 ? "it" : quoted} on your resume. Worked into your Summary and Skills in your own voice — only add what's honestly true of your work.`,
      });
    }
  }

  // 2 · The scan's own bullet rewrites. Offered only while the line they
  // rewrite still stands, and applied locally — they were generated, grounded
  // and paid for with the check.
  for (const rewrite of report.rewrites.slice(0, MAX_REWRITE_CARDS)) {
    if (!rewrite.after.trim() || comparable(rewrite.after) === comparable(rewrite.before)) continue;
    out.push({
      id: `${scope}:rewrite:${rewrite.chunkId}`,
      kind: "rewrite",
      title: "Sharpen a bullet",
      detail: rewrite.why || `Suggested by your check against ${check.job ?? "this job"}.`,
      rewrite: { before: rewrite.before, after: rewrite.after, why: rewrite.why, at: locateBullet(content, rewrite.before) },
    });
  }

  // 3 · Impact language, when it scored in the "needs work" band AND there are
  // bullets with no number — the `quantify` tool's own rule for a candidate.
  const impact = report.metrics.find((m) => m.id === METRIC_IMPACT)?.value;
  const bare = content.experience.reduce((n, entry) => n + entry.bullets.filter((b) => b.trim() && !/\d/.test(b)).length, 0);
  if (needsWork(impact) && bare > 0) {
    out.push({
      id: `${scope}:quantify`,
      kind: "quantify",
      title: `${bare} ${plural(bare, "bullet carries", "bullets carry")} no number`,
      detail: `Impact language scored ${impact}/100 on your check. Get a measurable outcome proposed for each — you review every one before it's used.`,
    });
  }

  // 4 · Length & format, when it scored in the "needs work" band on a resume
  // that runs past one page. Short resumes score low on this metric too, and
  // cutting one would be the wrong advice, so the page count has to agree.
  const length = report.metrics.find((m) => m.id === METRIC_LENGTH)?.value;
  if (needsWork(length) && pageCount > 1) {
    out.push({
      id: `${scope}:shorten`,
      kind: "shorten",
      title: `Runs to ${pageCount} pages`,
      detail: `Length & format scored ${length}/100 on your check. Tighten wordy bullets and drop the lowest-impact ones towards a single page.`,
    });
  }

  return out;
}
