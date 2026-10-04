// Browser-side call for drafting application-form answers.
//
// The route lives in the AI service at `/api/ai/autofill` and goes through the
// session proxy at `app/api/ai/[...path]/route.ts`, never a rewrite: the proxy
// sets `x-user-id` from the verified session and adds the service token. The
// browser sends the FORM — the questions — and never the person: the profile
// and resume the answers are drafted from are read server-side from the user's
// own account (the one resume named here is read back scoped to them).
//
// Mirrors `AutofillAnswer` in remoteworldwideai/src/services/autofillService.ts
// by hand. The browser extension is the service's other caller.
//
// ── What it costs ──────────────────────────────────────────────────────────
// One credit for the batch, and only when a question actually reached the
// model. A question the user has answered before comes back verbatim from their
// saved-answer library for free, and demographic questions are never drafted
// (blank, zero confidence) — so re-running the same form costs nothing extra.

import { apiPost } from "@/app/lib/api/client";

const AUTOFILL_PATH = "/api/ai/autofill";

/** What one drafted batch costs, for the copy that warns before spending it. Mirrors CREDIT_COST in the service. */
export const AUTOFILL_CREDITS = 1;

/**
 * The most questions sent in one go. The service drafts at most eight
 * unanswered questions inline and answers 202 with the rest left undrafted past
 * that, so a form is capped here rather than half-answered there.
 */
export const AUTOFILL_MAX_QUESTIONS = 8;

/** The service's per-question ceiling; longer is a 400. */
export const AUTOFILL_QUESTION_MAX = 400;

export type AutofillCategory = "screening" | "demographics";

export interface AutofillAnswer {
  /** The form's own wording, echoed back. */
  question: string;
  /** Empty when the facts on file do not support an answer, and always for a demographic question. */
  answer: string;
  /** 0-1: how well the facts on file support the answer. 1 is the user's own saved answer, reused. */
  confidence: number;
  cat: AutofillCategory;
}

export interface AutofillInput {
  questions: string[];
  /**
   * The application the form belongs to. Scopes the charge (the same questions
   * for the same id are one ledger row) and files the answers in the Questions
   * screen's "By application" log under it — so pass only an id that names a
   * real application row, never a placeholder for one not yet created.
   */
  applicationId?: string | null;
  /** The ingested resume the answers should speak from. Omitted, the newest one that parsed is used. */
  resumeId?: string | null;
  /** The posting: context for "why this company" answers, never a fact about the person. */
  job?: { company?: string | null; role?: string | null } | null;
}

/**
 * Drafts answers for up to `AUTOFILL_MAX_QUESTIONS` questions, in the order
 * asked. Rejects with the service's own sentence: 402 without a credit, 429
 * when the model is busy, 503 when it is briefly unavailable.
 */
export async function draftAnswers(input: AutofillInput): Promise<AutofillAnswer[]> {
  const questions = input.questions
    .map((question) => question.trim().slice(0, AUTOFILL_QUESTION_MAX))
    .filter(Boolean)
    .slice(0, AUTOFILL_MAX_QUESTIONS);
  if (questions.length === 0) return [];
  const data = await apiPost<{ answers: AutofillAnswer[] }>(AUTOFILL_PATH, {
    questions: questions.map((question) => ({ question })),
    applicationId: input.applicationId || null,
    resumeId: input.resumeId || null,
    job: input.job?.company || input.job?.role ? { company: input.job.company || null, role: input.job.role || null } : null,
  });
  return data?.answers ?? [];
}

// ── Reading a pasted form ──────────────────────────────────────────────────
// The apply wizard's "Paste the whole application form": the text of an
// employer's application page, select-all and copy, in; the form's questions
// out. Free: nothing is drafted. Mirrors `FormQuestions` in
// remoteworldwideai/src/services/formQuestionService.ts.

/** The longest paste the service takes. A whole page with a long posting sits well inside it. */
export const FORM_TEXT_MAX = 60_000;

/** The most questions read off one form. */
export const FORM_QUESTIONS_MAX = 20;

/** The fields left out of the list because the profile covers them, or they are the person's own to answer on the form. */
export type FormLeftOut = "name" | "email" | "phone" | "links" | "uploads" | "address" | "self-ID";

export interface FormQuestion {
  /** The form's own wording. */
  question: string;
  /** In the saved-answer library already: answering it is free and returns the person's own answer. */
  answeredBefore: boolean;
}

export interface FormQuestions {
  questions: FormQuestion[];
  leftOut: FormLeftOut[];
}

/** Reads the questions off a pasted application page. Rejects with the service's own sentence (429 when read too often). */
export async function findFormQuestions(text: string): Promise<FormQuestions> {
  const data = await apiPost<FormQuestions>(`${AUTOFILL_PATH}/questions`, { text: text.slice(0, FORM_TEXT_MAX) });
  return { questions: data?.questions ?? [], leftOut: data?.leftOut ?? [] };
}
