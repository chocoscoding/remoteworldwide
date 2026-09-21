// The AI Tools contract — what each of the six tools on the resume screen's AI
// rail answers with.
//
// This file used to be the engine as well: six pure transforms over
// `ResumeContent`, written so the rail could work before there was anything to
// call. The engine has moved. Every tool now runs in the AI service, reached
// through `app/lib/resume/ai.ts` — four of them reach a model, and the two that
// do not (`shorten`, `tone`) still run there so that what a tool DOES has one
// definition rather than two that drift apart.
//
// What stays here is the part that was always the contract. The AI service
// mirrors these interfaces field for field, and its
// `tests/contracts/frontend-types.test.ts` reads THIS FILE and fails if a name
// changes on one side only — the two projects are separate packages with no
// shared build, so a mirror that drifts silently shows up as a blank panel in
// production rather than a red build. Rename a field here and the service's
// suite goes red, which is the point.
//
// `applyQuantify` is the one transform that did not move, and deliberately.
// Committing a chosen suggestion substitutes one string at one index: it is an
// array update, it has to feel instant under a click, and a round trip could
// only make it slower and occasionally fail. Only PROPOSING the numbers is
// judgment, and that is the part the service does.

import type { ResumeContent } from "../types";

// ---------------------------------------------------------------------------
// 1 · Tailor to a job
// ---------------------------------------------------------------------------

export interface TailorResult {
  content: ResumeContent;
  /** The JD terms woven in — surfaced in the done-caption. */
  woven: string[];
}

// ---------------------------------------------------------------------------
// 2 · Rewrite a section (Summary) — three styled takes
// ---------------------------------------------------------------------------

export interface RewriteVariant {
  style: string;
  text: string;
}

// ---------------------------------------------------------------------------
// 3 · Add missing keywords
// ---------------------------------------------------------------------------

export interface KeywordInjection {
  content: ResumeContent;
  /** The terms actually added. Decided from the resume, never claimed by a model. */
  added: string[];
}

// ---------------------------------------------------------------------------
// 4 · Quantify my bullets
// ---------------------------------------------------------------------------

export interface QuantifySuggestion {
  /** Index into `content.experience`. */
  entryIndex: number;
  bulletIndex: number;
  role: string;
  before: string;
  after: string;
}

/**
 * Commits one suggestion the user chose. Pure, local and instant — see the note
 * at the top of the file.
 *
 * Out-of-range indices fall through untouched rather than throwing: a
 * suggestion is proposed against the document as it was, and the user may have
 * deleted the bullet before pressing Apply.
 */
export function applyQuantify(content: ResumeContent, suggestion: QuantifySuggestion): ResumeContent {
  return {
    ...content,
    experience: content.experience.map((entry, i) =>
      i === suggestion.entryIndex
        ? { ...entry, bullets: entry.bullets.map((b, j) => (j === suggestion.bulletIndex ? suggestion.after : b)) }
        : entry
    ),
  };
}

// ---------------------------------------------------------------------------
// 5 · Shorten to one page
// ---------------------------------------------------------------------------

export interface ShortenResult {
  content: ResumeContent;
  removedWords: number;
  trimmedBullets: number;
}

// ---------------------------------------------------------------------------
// 6 · Fix tone & grammar
// ---------------------------------------------------------------------------

export interface ToneResult {
  content: ResumeContent;
  /** What was changed, in words the caption can print — "trailing periods on bullets". */
  fixes: string[];
}
