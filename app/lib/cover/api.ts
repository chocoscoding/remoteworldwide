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

import { apiPost } from "@/app/lib/api/client";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import type { CoverLetterContent } from "@/app/lib/dashboard/types";

export type { CoverLetterContent };

const COVER_PATH = "/api/ai/cover";

/** Where a 402 sends someone to top up. */
export { ATS_BILLING_HREF as COVER_BILLING_HREF } from "@/app/lib/ats/api";

/** What one letter costs, for the copy that warns before spending it. */
export const COVER_CREDITS = 1;

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
export const generateCoverLetter = (input: CoverLetterInput) =>
  apiPost<CoverLetterContent>(COVER_PATH, {
    resumeId: input.resumeId,
    company: input.company,
    role: input.role,
    jdText: input.jdText ?? null,
    jobId: input.jobId ?? null,
    tone: input.tone,
  });

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
