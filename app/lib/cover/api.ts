// Browser-side calls for the cover letter writer.
//
// The route lives in the AI service at `/api/ai/cover` and goes through the
// session proxy at `app/api/ai/[...path]/route.ts`, never a rewrite: the proxy
// sets `x-user-id` from the verified session and adds the service token, so the
// browser never says who it is and never holds a secret.
//
// ── The letter's shape is not declared here ────────────────────────────────
// `CoverLetterContent` lives in `app/lib/dashboard/types.ts`, which is what the
// AI service mirrors and what its `tests/contracts/frontend-types.test.ts`
// reads. One authority, one drift guard.
//
// ── Tone is a request, not a filter ────────────────────────────────────────
// Each tone is a SEPARATE LETTER: same facts, different register and different
// LENGTH. The service states the paragraph count in the prompt and then
// truncates anything longer, because "short" is a style word to a model and a
// paragraph count to a person. So switching tone cannot be done on the client —
// there is nothing to re-filter — and a tone the user has not generated yet
// costs what any other letter costs. Callers are expected to keep the ones
// already written (see `useCoverLetter`), so going back to a tone is free.
//
// ── Every letter is kept ───────────────────────────────────────────────────
// The service saves each letter it writes to the library and answers with its
// id (`documentId`), so a letter can be reopened (`/dashboard/cover?letter=`),
// picked by the extension, and printed to PDF on the server. The editor then
// autosaves what the person does to it (`updateLetter`, `useLetterAutosave`).
// A save that failed after the letter was written is not a failed letter: the
// answer is the letter with `documentId: null`, and the service's sentence
// saying so rides along as `saveNotice`. A blank draft ("Write your own") is
// saved too, on its first keystroke (`createLetter`), for free.

import { apiGet, apiPatch, apiPost, apiPostWithMessage } from "@/app/lib/api/client";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import type { CoverLetterContent, LetterDesign, LetterSummary, LetterView, StoredLetterContent } from "@/app/lib/dashboard/types";

export type { CoverLetterContent };

/**
 * A letter as the writer (or the reviser) answers it, or as it was reopened
 * from the library: the words, the editor's own text and HTML when a saved
 * letter has them, and the library id — null when it is not in the library.
 */
export interface WrittenLetter extends StoredLetterContent {
  documentId: string | null;
  /** The service's own sentence when `documentId` is null because the save failed. */
  saveNotice?: string;
}

const LETTERS_PATH = "/api/ai/cover/letters";

const COVER_PATH = "/api/ai/cover";

/** Where a 402 sends someone to top up. */
export { ATS_BILLING_HREF as COVER_BILLING_HREF } from "@/app/lib/ats/api";

/** What one letter costs, for the copy that warns before spending it. Mirrors COVER_CREDITS in the service. */
export const COVER_CREDITS = 2;

/** What revising the letter to an instruction costs. Mirrors REVISE_CREDITS in the service. */
export const COVER_REVISE_CREDITS = 1;

/** Mirror the revise validator: past these the service refuses the request. */
export const MAX_REVISE_LETTER_CHARS = 8_000;
export const MAX_REVISE_INSTRUCTION_CHARS = 500;

export const COVER_TONES = ["warm", "formal", "story", "short"] as const;
export type CoverTone = (typeof COVER_TONES)[number];

/**
 * How long each tone runs. Mirrored from `TONE_PARAGRAPHS` in the service,
 * which is the contract the generator enforces rather than a description of it.
 * Shown on the tone control so the length half of the choice is visible before
 * a credit is spent on it.
 */
export const TONE_PARAGRAPHS: Readonly<Record<CoverTone, number>> = {
  warm: 3,
  formal: 4,
  story: 4,
  short: 2,
};

export interface CoverLetterInput {
  /**
   * An INGESTED resume — a row from `GET /api/ai/resume`, the same set a scan
   * names. Not a document from the editor's library and not a file in My
   * documents: the letter is written from parsed resume content, and only these
   * have been parsed.
   */
  resumeId: string;
  company: string;
  role: string;
  jdText?: string | null;
  /** The saved job's id, when the description came from one rather than being pasted. */
  jobId?: string | null;
  tone: CoverTone;
}

/**
 * Writes one letter.
 *
 * Rejects with a `BackendError` carrying the service's own sentence: 402 with
 * no credits, 404 for a resume that is not this user's, 422 for a resume with
 * no experience to write from, 429 when the writer is busy, 503 when it is
 * briefly unavailable.
 */
export async function generateCoverLetter(input: CoverLetterInput): Promise<WrittenLetter> {
  const { data, message } = await apiPostWithMessage<CoverLetterContent & { documentId?: string | null }>(COVER_PATH, {
    resumeId: input.resumeId,
    company: input.company,
    role: input.role,
    jdText: input.jdText ?? null,
    jobId: input.jobId ?? null,
    tone: input.tone,
  });
  return withSaveNotice(data, message);
}

/** `documentId` as the service sent it — null (never undefined) when it is not in the library — and why, when that is news. */
function withSaveNotice(data: CoverLetterContent & { documentId?: string | null }, message: string): WrittenLetter {
  const documentId = data.documentId ?? null;
  return { ...data, documentId, ...(documentId === null && message ? { saveNotice: message } : {}) };
}

export interface ReviseCoverLetterInput {
  /** The letter as it stands in the editor, the user's own edits included. */
  letter: string;
  /** "Make it warmer", "cut the second paragraph"… */
  instruction: string;
  company?: string | null;
  role?: string | null;
  /**
   * The library letter being revised. The service checks it is this user's
   * before charging, and saves the revision over it — its old text and HTML go,
   * so the editor adopts the answer and autosaves from there.
   */
  documentId?: string | null;
}

/**
 * Rewrites the letter to one instruction, for `COVER_REVISE_CREDITS`. The
 * service adds no facts the letter does not already hold. Rejects with the
 * service's sentence: 402 without a credit, 404 for a `documentId` that is not
 * this user's, 429/503 when the writer is busy. Without a `documentId` nothing
 * is saved and the answer's is null.
 */
export async function reviseCoverLetter(input: ReviseCoverLetterInput): Promise<WrittenLetter> {
  const { data, message } = await apiPostWithMessage<CoverLetterContent & { documentId?: string | null }>(`${COVER_PATH}/revise`, {
    letter: input.letter.slice(0, MAX_REVISE_LETTER_CHARS),
    instruction: input.instruction.slice(0, MAX_REVISE_INSTRUCTION_CHARS),
    company: input.company || undefined,
    role: input.role || undefined,
    documentId: input.documentId || undefined,
  });
  // Only news when a save was asked for: an unsaved blank draft revised is null by design.
  return input.documentId ? withSaveNotice(data, message) : { ...data, documentId: data.documentId ?? null };
}

// ---------------------------------------------------------------------------
// The library of letters
// ---------------------------------------------------------------------------

/** How many letters the cover screen offers to pick back up. */
export const RECENT_LETTERS = 5;

/**
 * Saved letters, most recently worked on first: every one up to 50, or the newest `limit`.
 * Summaries carry no content.
 */
export function listLetters(view: "summary", signal?: AbortSignal, limit?: number): Promise<LetterSummary[]>;
export function listLetters(view: "full", signal?: AbortSignal, limit?: number): Promise<LetterView[]>;
export function listLetters(view: "summary" | "full", signal?: AbortSignal, limit?: number): Promise<LetterSummary[] | LetterView[]> {
  return apiGet<LetterSummary[] | LetterView[]>(`${LETTERS_PATH}?view=${view}${limit ? `&limit=${limit}` : ""}`, signal);
}

/**
 * Saves a blank draft ("Write your own") with what is on the page, and answers
 * its library id for the autosave to write into from then on. Nothing is
 * generated or charged. A 409 carries the service's sentence when the person
 * already has as many saved letters as it keeps.
 */
export const createLetter = (input: { content?: StoredLetterContent; design?: LetterDesign }): Promise<{ id: string; label: string; updatedAt: Date }> =>
  apiPost<{ id: string; label: string; updatedAt: Date }>(LETTERS_PATH, input);

/** One saved letter. Another user's id, or a resume's, is a 404. */
export const getLetter = (id: string, signal?: AbortSignal): Promise<LetterView> => apiGet<LetterView>(`${LETTERS_PATH}/${encodeURIComponent(id)}`, signal);

/** What an autosave sends: `content` whole (the service recounts `wordCount` from `text`), `design` whole. */
export interface LetterPatch {
  label?: string;
  content?: StoredLetterContent;
  design?: LetterDesign;
}

/** The browser's keepalive quota is 64KB across every such request in flight; see `saveResumeDocument`. */
const KEEPALIVE_MAX_BYTES = 48_000;

/**
 * Saves the editor's side of a letter. Over a limit (60,000 characters of HTML,
 * 12,000 of text) the service refuses with a 400 and a sentence rather than
 * cutting the letter short.
 */
export const updateLetter = (id: string, patch: LetterPatch, options: { keepalive?: boolean } = {}): Promise<{ id: string; label: string; updatedAt: Date }> => {
  const keepalive = options.keepalive === true && new Blob([JSON.stringify(patch)]).size <= KEEPALIVE_MAX_BYTES;
  return apiPatch<{ id: string; label: string; updatedAt: Date }>(`${LETTERS_PATH}/${encodeURIComponent(id)}`, patch, { keepalive });
};

export type CoverFailureKind =
  /** Too few credits. Nothing was written or charged. */
  | "credits"
  /** No resume the writer can read — none imported, or the one named never parsed. */
  | "resume"
  | "failed";

export interface CoverFailure {
  kind: CoverFailureKind;
  message: string;
  /** False when running the same request again cannot work, so no Retry is offered. */
  retryable: boolean;
}

// A retry cannot fix what the request itself got wrong.
const FINAL_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 413]);

export function describeCoverFailure(error: unknown): CoverFailure {
  if (error instanceof BackendError) {
    // Retryable: people top up in another tab and come back to the same job.
    if (error.status === 402) return { kind: "credits", message: error.message, retryable: true };
    // 404 is a resume that is not this user's; 422 is one with nothing to write
    // from. Both are answered by choosing or importing a different resume, so
    // they read as the same kind of problem to the person looking at the screen.
    if (error.status === 404 || error.status === 422) return { kind: "resume", message: error.message, retryable: false };
    return { kind: "failed", message: error.message, retryable: !FINAL_STATUSES.has(error.status) };
  }
  return { kind: "failed", message: apiMessage(error), retryable: true };
}
