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
  /** Rewrite: the role its line stands in now ("Remote Worldwide"), for the card's header. */
  where?: string;
}

/** A card as the rail shows it: a rewrite carries the number the preview pins beside its line. */
export interface RailCard extends CheckSuggestion {
  n: number | null;
}

/**
 * The cards the rail shows, in order: none that was dismissed, and a rewrite
 * only while its line still stands or once it was used (to show that it was).
 * Rewrites are numbered 1, 2… in that order, and the preview pins the same
 * number beside each line still waiting for one (`pinnedLines`).
 */
export function railCards(suggestions: CheckSuggestion[], outcomes: Record<string, string>, dismissed: string[]): RailCard[] {
  let n = 0;
  return suggestions
    .filter((s) => !dismissed.includes(s.id) && (s.kind !== "rewrite" || s.rewrite?.at || outcomes[s.id]))
    .map((s) => ({ ...s, n: s.kind === "rewrite" ? (n += 1) : null }));
}

/** The lines the preview numbers: each rewrite card's line, while it waits to be used. */
export function pinnedLines(cards: RailCard[], content: ResumeContent, outcomes: Record<string, string>) {
  return cards.flatMap((card) => {
    const at = card.rewrite?.at;
    const entry = at ? content.experience[at.entryIndex] : undefined;
    return at && entry && card.n !== null && !outcomes[card.id] ? [{ entryId: entry.id, bulletIndex: at.bulletIndex, n: card.n }] : [];
  });
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

/** Words a requirement is padded with: they say nothing about whether the resume covers it. */
const FILLER = new Set(["and", "or", "the", "of", "to", "with", "for", "in", "on", "a", "an", "as", "at", "by", "using", "including", "e.g", "eg", "etc", "your", "our"]);

/** A term's words that carry its meaning: "work ethic and strong prioritization skills" -> work, ethic, strong, prioritization, skills. */
const meaningfulWords = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((word) => word.replace(/^\.+|\.+$/g, ""))
    .filter((word) => word.length > 1 && !FILLER.has(word));

/**
 * Whether the resume already says this. Word for word for a short term ("Docker",
 * "system design"); for a longer requirement, every one of its meaningful words
 * somewhere in the text, so a line the keywords tool worked in in its own words
 * ("strong work ethic and prioritization skills") counts as covered rather than
 * staying "missing" forever.
 */
function covered(term: string, text: string, words: Set<string>): boolean {
  if (text.includes(term.toLowerCase())) return true;
  const wanted = meaningfulWords(term);
  return wanted.length >= 3 && wanted.every((word) => words.has(word));
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
  // for anything to be missing from. Terms the resume covers now (typed since
  // the check ran, or worked in by the keywords tool, which writes into the
  // summary, skills and bullets) are not offered again.
  if (check.posting) {
    const inDoc = [...content.skills, content.summary, ...content.experience.flatMap((entry) => entry.bullets)].join(" \n ").toLowerCase();
    const docWords = new Set(meaningfulWords(inDoc));
    const seen = new Set<string>();
    const terms = missingGaps(report)
      .map((gap) => keywordLabel(gap.label))
      .filter((term) => {
        const key = term.toLowerCase();
        if (!term || term.length > MAX_TERM_CHARS || seen.has(key) || covered(term, inDoc, docWords)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_TERMS);

    if (terms.length > 0) {
      // The card lists the terms themselves, so its words only say what adding them does. Its id
      // names them: once a run has worked some in, what is still missing is a new card with its
      // own button, rather than the old card's "Worked in…" standing where the button should be.
      out.push({
        id: `${scope}:keywords:${terms.map((term) => term.toLowerCase()).join("|")}`,
        kind: "keywords",
        terms,
        title: `Add ${terms.length} missing ${plural(terms.length, "keyword", "keywords")}`,
        detail: "Worked into your Summary and Skills in your own voice. Only add what's honestly true of your work.",
      });
    }
  }

  // 2 · The scan's own bullet rewrites. Offered only while the line they
  // rewrite still stands, and applied locally — they were generated, grounded
  // and paid for with the check.
  for (const rewrite of report.rewrites.slice(0, MAX_REWRITE_CARDS)) {
    if (!rewrite.after.trim() || comparable(rewrite.after) === comparable(rewrite.before)) continue;
    const at = locateBullet(content, rewrite.before);
    const entry = at ? content.experience[at.entryIndex] : undefined;
    out.push({
      id: `${scope}:rewrite:${rewrite.chunkId}`,
      kind: "rewrite",
      title: "Sharpen a bullet",
      detail: rewrite.why || `Suggested by your check against ${check.job ?? "this job"}.`,
      rewrite: { before: rewrite.before, after: rewrite.after, why: rewrite.why, at },
      where: entry ? entry.company.trim() || entry.role.trim() || undefined : undefined,
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
      detail: `Impact language scored ${impact}/100 on your check. Get a measurable outcome proposed for each. You review every one before it's used.`,
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
