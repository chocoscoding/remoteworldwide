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
// browser over the document on screen; these run in the service, where the
// generative four can reach a model and where a credit can be charged. The
// deterministic two (`shorten`, `tone`) go over the wire as well even though
// they are pure string work — see the note on `FREE_TOOLS`.

import { apiPost } from "@/app/lib/api/client";
import type {
  KeywordInjection,
  QuantifySuggestion,
  RewriteVariant,
  ShortenResult,
  TailorResult,
  ToneResult,
} from "@/app/lib/dashboard/resume/ai-tools";
import type { ResumeContent } from "@/app/lib/dashboard/types";

export type { KeywordInjection, QuantifySuggestion, RewriteVariant, ShortenResult, TailorResult, ToneResult };

const SUGGESTIONS_PATH = "/api/ai/suggestions";

export const SUGGESTION_TOOLS = ["tailor", "rewrite", "keywords", "quantify", "shorten", "tone"] as const;
export type SuggestionTool = (typeof SUGGESTION_TOOLS)[number];

/** What one generative run costs, for the copy that warns before spending it. */
export const SUGGESTION_CREDITS = 1;

/**
 * The two that cost nothing.
 *
 * `shorten` keeps the first two bullets of every role and the first two
 * sentences of the summary; `tone` applies a fixed typo table and reports what
 * it changed. Both are rules rather than judgment, and a model asked to execute
 * a rule adds latency, cost and the chance of a different answer on the second
 * click — which is the worst property a document editor can have, because the
 * user's next action is to undo and try again.
 *
 * They still go to the server rather than staying here, so that what a tool
 * does has one definition instead of two that drift. The round trip is the
 * price of that, and it is cheaper than the bug.
 */
export const FREE_TOOLS: ReadonlySet<SuggestionTool> = new Set<SuggestionTool>(["shorten", "tone"]);

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
}

const run = <T,>(tool: SuggestionTool, input: SuggestionInput) =>
  apiPost<T>(`${SUGGESTIONS_PATH}/${tool}`, {
    content: input.content,
    jdText: input.jdText ?? null,
    company: input.company ?? null,
    role: input.role ?? null,
    keywords: input.keywords ?? null,
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

/** Proposes a number for bullets that carry none. Proposing only — applying is `applyQuantify`, which stays local and pure. */
export const quantifySuggestions = (input: SuggestionInput) => run<QuantifySuggestion[]>("quantify", input);

export const shortenToOnePage = (input: SuggestionInput) => run<ShortenResult>("shorten", input);

export const fixToneAndGrammar = (input: SuggestionInput) => run<ToneResult>("tone", input);
