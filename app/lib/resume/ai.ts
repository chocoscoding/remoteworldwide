// Browser-side calls for the resume screen's AI rail.
//
// The six tools live in the AI service under `/api/ai/suggestions/:tool` and go
// through the session proxy at `app/api/ai/[...path]/route.ts`, never a rewrite:
// the proxy sets `x-user-id` from the verified session and adds the service
// token, so the browser never says who it is and never holds a secret.
//
// ── The result shapes are NOT declared here ────────────────────────────────
// They come from `app/lib/dashboard/resume/ai-tools.ts`, which is still the
// authority for them: the AI service mirrors that file field for field and its
// `tests/contracts/frontend-types.test.ts` reads it and fails if the names
// drift. Re-declaring them beside the fetch would give the drift guard a second
// file to not know about, and the failure would be a blank panel rather than a
// red build.
//
// What ai-tools.ts no longer is, is the engine. Its transforms ran in the
// browser over the document on screen; these run in the service, where all six
// reach a model and a credit can be charged — see the note on `FREE_TOOLS`.

import { apiPost } from "@/app/lib/api/client";
import type {
  AskResult,
  KeywordInjection,
  QuantifySuggestion,
  RewriteVariant,
  ShortenResult,
  TailorResult,
  ToneResult,
} from "@/app/lib/dashboard/resume/ai-tools";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { SectionConfig } from "@/app/lib/dashboard/resume/design-types";

export type { AskResult, KeywordInjection, QuantifySuggestion, RewriteVariant, ShortenResult, TailorResult, ToneResult };

const SUGGESTIONS_PATH = "/api/ai/suggestions";

/**
 * The six named tools, then `ask` — the rail's free-form "Ask for a rewrite…"
 * box, which rides the same route, meter and narrow-diff contract. The AI
 * service's list matches this one, and its contract test checks `ask` is in
 * both.
 */
export const SUGGESTION_TOOLS = ["tailor", "rewrite", "keywords", "quantify", "shorten", "tone", "ask"] as const;
export type SuggestionTool = (typeof SUGGESTION_TOOLS)[number];

/** Mirrors the service's MAX_ASK_INSTRUCTION_CHARS and its route validator — the input's `maxLength`. */
export const MAX_ASK_INSTRUCTION_CHARS = 500;

/** What one generative run costs, for the copy that warns before spending it. */
export const SUGGESTION_CREDITS = 1;

/**
 * Tools that never cost a credit. Empty now: `shorten` and `tone` used to be
 * fixed rules (keep two bullets per role; a typo table) and were free, and are
 * real rewrites now, priced like the other four. The service still answers some
 * runs for free — nothing to add, nothing to cut — and says so in the result.
 */
export const FREE_TOOLS: ReadonlySet<SuggestionTool> = new Set<SuggestionTool>();

/** True when running this tool will spend `SUGGESTION_CREDITS`. */
export const costsCredit = (tool: SuggestionTool): boolean => !FREE_TOOLS.has(tool);

export interface SuggestionInput {
  /**
   * The document ON SCREEN, including the paragraph typed thirty seconds ago.
   *
   * Sent rather than named by id on purpose: the rail edits the editor's
   * unsaved working copy, and running a tool against the last autosave would
   * hand back a resume the user is not looking at. The service never passes
   * this object to a model — every generative tool asks for a narrow diff and
   * reassembles the document around the untouched fields.
   */
  content: ResumeContent;
  /** Required by `tailor`; the keyword source of last resort for `keywords`. */
  jdText?: string | null;
  company?: string | null;
  role?: string | null;
  /** An explicit want-list for `keywords`. Falls back to the JD's own top terms. */
  keywords?: string[] | null;
  /** `keywords` only: list the posting's missing keywords to tick in (`proposeKeywords`), rather than work terms in. */
  propose?: boolean;
  /**
   * `rewrite` and `quantify`: the role picked on the page, by its index in `content.experience` —
   * its bullets are rewritten, or quantified, instead of the summary or every role.
   */
  entryIndex?: number | null;
  /**
   * `rewrite`, `quantify` and `tone`: a custom section picked on the page, by its id — its points are
   * rewritten, quantified or proofread (owner, 2026-10-04: custom sections are never left out).
   */
  customId?: string | null;
  /**
   * `quantify` and `tone`: one line of that role or custom section, by its index among its NON-EMPTY
   * lines (`serverBulletIndex`).
   */
  bulletIndex?: number | null;
  /** `tone`: one section picked on the page; `quantify`: "experience", every role but no custom section. With nothing else picked, the whole resume. */
  section?: ToneSection | null;
  /** Required by `ask`: what the user typed into the rewrite box. */
  instruction?: string | null;
}

/** The sections "Fix tone & grammar" can be pointed at, by section kind ("training" is the certifications). */
export type ToneSection = "summary" | "experience" | "education" | "skills" | "training" | "projects";

/**
 * Where a tone fix is, as the service numbers it: a bullet by its index among its role's non-empty
 * bullets, a skill in the flat list, the rest by their entry's index in their list.
 */
export type ToneAt =
  | { field: "summary" }
  | { field: "bullet"; entryIndex: number; bulletIndex: number }
  | { field: "skill"; index: number }
  | { field: "degree"; index: number }
  | { field: "detail"; index: number }
  | { field: "project"; index: number }
  | { field: "certification"; index: number }
  /** A custom section's point, by its index among the section's non-empty points. */
  | { field: "point"; customId: string; index: number };

/** One proposed correction: the line as it is and as it would read, whole. Nothing is changed until it is applied. */
export interface ToneFix {
  at: ToneAt;
  before: string;
  after: string;
  /** "spelling", "grammar", "punctuation", "capitalisation", "tense", "stronger verb" or "wording". */
  kind: string;
}

export interface ToneProposals {
  fixes: ToneFix[];
}

/** The skills and tools a posting asks for that the resume lacks — never its company, title or a generic word. */
export interface KeywordProposals {
  terms: string[];
}

const run = <T,>(tool: SuggestionTool, input: SuggestionInput) =>
  apiPost<T>(`${SUGGESTIONS_PATH}/${tool}`, {
    content: input.content,
    jdText: input.jdText ?? null,
    company: input.company ?? null,
    role: input.role ?? null,
    keywords: input.keywords ?? null,
    propose: input.propose === true ? true : null,
    entryIndex: typeof input.entryIndex === "number" ? input.entryIndex : null,
    customId: input.customId || null,
    bulletIndex: typeof input.bulletIndex === "number" ? input.bulletIndex : null,
    section: input.section ?? null,
    instruction: input.instruction ?? null,
  });

/** Rewrites the summary and skills towards one posting. Needs `jdText`. */
export const tailorToJob = (input: SuggestionInput) => run<TailorResult>("tailor", input);

/** Three styled takes on the summary. The user picks one; none is applied for them. */
export const rewriteVariants = (input: SuggestionInput) => run<RewriteVariant[]>("rewrite", input);

/**
 * Works a want-list into the summary and skills. Needs either `keywords` or a
 * `jdText` to pull them from — with neither, the service answers 400 rather
 * than inventing a list.
 *
 * WHICH terms are missing is decided server-side from the resume itself, not
 * asked of a model, so `added` is a fact about the document rather than a claim.
 */
export const injectKeywords = (input: SuggestionInput) => run<KeywordInjection>("keywords", input);

/**
 * The resume screen's "Add missing keywords": the posting's missing skills and tools, listed for
 * the person to tick into Skills or set aside, one by one. Nothing is changed by the call; ticking
 * one in is local and free. Needs `jdText`; `company` and `role` keep their words out of the list.
 */
export const proposeKeywords = (input: SuggestionInput) => run<KeywordProposals>("keywords", { ...input, propose: true });

/** Proposes a number for bullets that carry none. Proposing only — applying is `applyQuantify`, which stays local and pure. */
export const quantifySuggestions = (input: SuggestionInput) => run<QuantifySuggestion[]>("quantify", input);

export const shortenToOnePage = (input: SuggestionInput) => run<ShortenResult>("shorten", input);

export const fixToneAndGrammar = (input: SuggestionInput) => run<ToneResult>("tone", input);

/**
 * The resume screen's "Fix tone & grammar": proofreads what was picked on the page (`section`,
 * `entryIndex`, `bulletIndex`; none of them is the whole resume) and proposes each fix to apply or
 * set aside. Nothing is changed by the call; a run with nothing to fix is free.
 */
export const proposeToneFixes = (input: SuggestionInput) => run<ToneProposals>("tone", { ...input, propose: true });

/** A bullet's index among its role's non-empty bullets — how the service numbers it. -1 for an empty one. */
export const serverBulletIndex = (bullets: string[], storedIndex: number): number =>
  bullets[storedIndex]?.trim() ? bullets.slice(0, storedIndex).filter((bullet) => bullet.trim()).length : -1;

/**
 * The content as the AI tools get it: each custom section with its name (`title`, its heading on
 * the page), so the service knows what the points are, and only the ones on the page. A section
 * hidden from the resume, or with no place in the section list, is left out like a hidden role.
 */
export const withSectionTitles = (content: ResumeContent, sections: readonly SectionConfig[]): ResumeContent => {
  if (!content.customSections) return content;
  const shown = new Map(sections.filter((s) => s.kind === "custom" && s.visible).map((s) => [s.id, s.label.trim()]));
  return {
    ...content,
    customSections: content.customSections.flatMap((section) =>
      shown.has(section.id) ? [{ ...section, title: shown.get(section.id) || undefined }] : [],
    ),
  };
};

/** The stored index of a role's `nth` non-empty bullet: the service's numbering, back to the editor's. */
export const storedBulletIndex = (bullets: string[], nth: number): number => {
  let seen = -1;
  for (let i = 0; i < bullets.length; i++) {
    if (bullets[i].trim()) seen += 1;
    if (seen === nth) return i;
  }
  return -1;
};

/**
 * The rail's "Ask for a rewrite…" box: the user's instruction applied to the
 * summary and the existing bullets, and nothing else. The service refuses any
 * proposed line that adds a figure the resume never had or balloons past the
 * line it replaces — keeping the user's own — and reports how many it kept
 * back in `rejectedLines`. Nothing surviving is a failed run, not a no-op, and
 * is not charged.
 */
export const askForRewrite = (input: SuggestionInput & { instruction: string }) => run<AskResult>("ask", input);
