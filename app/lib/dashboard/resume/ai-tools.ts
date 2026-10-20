// The AI Tools contract — what each of the six tools on the resume screen's AI
// rail answers with.
//
// This file used to be the engine as well: six pure transforms over
// `ResumeContent`, written so the rail could work before there was anything to
// call. The engine has moved. Every tool now runs in the AI service, reached
// through `app/lib/resume/ai.ts`, and all six reach a model — `shorten` and
// `tone` were fixed rules once, and are real rewrites now.
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
  /** Gaps left out because the resume's history doesn't show them (or they're about where the candidate may work), with advice. */
  notShown?: TermAdvice[];
  /** "Tailor to this job" (`whole`): the lines it tuned or reframed, and why. */
  changed?: FitChange[];
  /** "Tailor to this job": what the job asks for that the resume does not show, to ask the person about. */
  couldAdd?: FitAddition[];
}

/** One line "Tailor to this job" changed: lightly ("tune") or led with what the job wants ("reframe"). */
export interface FitChange {
  marker: string;
  kind: "tune" | "reframe";
  before: string;
  after: string;
  serves: string;
}

/** Something the job asks for that the resume does not show: asked of the person ("NetSuite, if you have used it"), never written in. */
export interface FitAddition {
  term: string;
  ifTrue: string;
  /** Where a "Yes" puts it: work into a line of the experience, a tool, language or certification into Skills. */
  place: "experience" | "skills";
}

/** A requested term the resume doesn't show yet, with one line of advice. Never written in, never charged for. */
export interface TermAdvice {
  term: string;
  advice: string;
}

// ---------------------------------------------------------------------------
// 2 · Rewrite a section (Summary) — three styled takes
// ---------------------------------------------------------------------------

export interface RewriteVariant {
  style: string;
  /** The summary as this take writes it — or, for a role, its bullets one per line. */
  text: string;
  /** A role's take only: its bullets, one for each of the role's own, in order. */
  bullets?: string[];
}

// ---------------------------------------------------------------------------
// 3 · Add missing keywords
// ---------------------------------------------------------------------------

export interface KeywordInjection {
  content: ResumeContent;
  /** The terms actually added. Decided from the resume, never claimed by a model. */
  added: string[];
  /** The requested terms that wouldn't go in as resume lines after every ask: nothing of them was added. */
  missed: string[];
  /** Advisory only: requested terms worked in although nothing on the resume came close — "make sure you can back these up in an interview". */
  unbacked: string[];
  /** Terms left out because the resume's history doesn't show them, each with advice. No retry, no charge. */
  notShown?: TermAdvice[];
  /** Where each added term went, by its spelling as sent: the lines that now show it ("Skills" for a skill name). */
  placed?: Record<string, string[]>;
  /** Picked terms only: the ones no line took after every ask, put in Skills for now (each is in `added` too). */
  skillsOnly?: string[];
  /** Picked terms only: the added terms the resume did not already show, each with a word on backing it in an interview. */
  advice?: TermAdvice[];
}

// ---------------------------------------------------------------------------
// 4 · Quantify my bullets
// ---------------------------------------------------------------------------

export interface QuantifySuggestion {
  /** Index into `content.experience`; -1 for a point of a custom section (`customId`). */
  entryIndex: number;
  /** The line's index: the service's among non-empty lines, the editor's stored one once it lands. */
  bulletIndex: number;
  /** The role's title, or the custom section's name. */
  role: string;
  before: string;
  after: string;
  /** A point of this custom section (`content.customSections`) rather than a role's bullet. */
  customId?: string;
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
  if (suggestion.customId) {
    return {
      ...content,
      customSections: content.customSections?.map((section) =>
        section.id === suggestion.customId
          ? { ...section, items: section.items.map((item, j) => (j === suggestion.bulletIndex ? suggestion.after : item)) }
          : section
      ),
    };
  }
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

// ---------------------------------------------------------------------------
// 7 · Ask for a rewrite — the rail's free-form box
// ---------------------------------------------------------------------------

/**
 * The user's own instruction, applied as a narrow diff: only the summary and
 * existing bullet text can come back changed. Every count is the service's,
 * computed from the before and after — the caption states them, and a model
 * is never trusted to count its own edits.
 */
export interface AskResult {
  content: ResumeContent;
  /** Whether the summary was rewritten. */
  summaryChanged: boolean;
  /** How many existing bullets were rewritten. */
  bulletsChanged: number;
  /** Proposed lines the service discarded. Always 0 since 2026-10-18: a ballooned line comes back in `longer`. */
  rejectedLines: number;
  /** Lines that grew far past their old length, held out of `content` until the person says keep them. */
  longer: AskLonger[];
  /** Ask's answer in the chat, or a few words on what it did in the editor. Null when it only rewrote text. */
  reply: string | null;
  /** True when `reply` is the service's fixed help answer ("what can you do?"), which is free. */
  help: boolean;
  /** Things to do in the editor, checked again by `checkedAskAction` before they run. */
  actions: unknown[];
}

/** One line Ask wrote much longer than it was. `at`: "summary", "<role>.<bullet>" or "c<section>.<point>". */
export interface AskLonger {
  at: string;
  before: string;
  after: string;
}
