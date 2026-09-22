// Browser-side calls for Ask about a job.
//
// Every route lives in the AI service and goes through the session proxy at
// `app/api/ai/[...path]/route.ts`, never a rewrite: the proxy is what sets
// `x-user-id` from the verified session and adds the service token, so the
// browser never says who it is and never holds a secret. Paths are relative for
// the same reason as in `app/lib/api/client.ts`: the session cookie rides along
// first-party.
//
// There is deliberately no call here that sends job text. A thread is opened by
// saved-job id and the AI service reads the posting from the backend itself, so
// nobody can spend model calls on text of their own choosing through this file.

import { apiGet, apiPost } from "@/app/lib/api/client";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import {
  JD_QUICK_QUESTION_IDS,
  type AskJobInput,
  type AskJobResult,
  type JdQuickQuestionId,
  type JobThreadEntry,
  type JobThreadItem,
} from "./types";

export const JOB_THREADS_PATH = "/api/ai/jobs/threads";

/** Where a 402 sends someone to top up. */
export const BILLING_HREF = "/dashboard/settings/billing";

/**
 * Mirrors `MAX_JOB_QUESTION_CHARS` in the AI service's jobs validator. Enforced
 * by the composer, so a long paste is cut off where the user can see it rather
 * than refused after a round trip.
 */
export const MAX_JOB_QUESTION_CHARS = 1_000;

const QUICK_IDS: ReadonlySet<string> = new Set(JD_QUICK_QUESTION_IDS);

/**
 * The quick-question chips, in the order they show. The labels match the AI
 * service's `QUICK_QUESTIONS` (jobAskService), so a stored answer reads the same
 * as the chip that asked it. Moved here from mock-data.ts: they are the screen's
 * own copy, not sample data.
 */
export const JD_QUICK_QUESTIONS: ReadonlyArray<{ id: JdQuickQuestionId; label: string }> = [
  { id: "fit", label: "Am I a fit?" },
  { id: "really-asking", label: "What are they really asking for?" },
  { id: "salary", label: "Salary sanity check" },
  { id: "questions-to-ask", label: "Questions to ask them" },
];

/** Only the ids the AI service knows may go out as `questionId`. */
export function isQuickQuestionId(id: string): id is JdQuickQuestionId {
  return QUICK_IDS.has(id);
}

// Ids go into the path, so they are encoded, as in `app/lib/jobs/api.ts`.
const threadPath = (id: string) => `${JOB_THREADS_PATH}/${encodeURIComponent(id)}`;

/**
 * Open this user's thread for a saved job, creating it on first use.
 *
 * It never charges. The AI service keys a thread on the posting's text as well
 * as the job, so opening again after the job was edited returns the thread for
 * the current version. It is rate limited per user, which is why the query that
 * calls it never refetches on its own (`hooks/queries/useJobThread.ts`).
 */
export function openJobThread(savedJobId: string) {
  return apiPost<JobThreadItem>(JOB_THREADS_PATH, { savedJobId });
}

/**
 * A thread as it stands now, by its id. Not rate limited, unlike opening, so
 * it is how the screen picks up answers stored outside its own asks (a spoken
 * call). It never follows an edit to the posting; only opening does that.
 */
export function getJobThread(threadId: string, signal?: AbortSignal) {
  return apiGet<JobThreadItem>(threadPath(threadId), signal);
}

/**
 * Ask a quick question (`{ questionId }`) or one of the user's own (`{ question }`).
 * A new answer costs a credit. An answer already on the thread for the same
 * question and the same resume comes back with `charged: false`.
 */
export function askAboutJob(threadId: string, input: AskJobInput) {
  return apiPost<AskJobResult>(`${threadPath(threadId)}/ask`, input);
}

/**
 * Whether an answer is one the AI service never stores on the thread. Today
 * that is only the "upload a resume" reply to "Am I a fit?", which it answers
 * for free and ids `no-resume-<question>` (`noResumeEntry` in
 * remoteworldwideai/src/services/jobAskService.ts). Reopening the thread will
 * never find such an answer.
 */
export function isUnstoredAnswer(entry: Pick<JobThreadEntry, "id">): boolean {
  return entry.id.startsWith("no-resume-");
}

// ---------------------------------------------------------------------------
// What the transcript's status region reads out
// ---------------------------------------------------------------------------

export type AskProgress =
  | { status: "pending" }
  | { status: "answered"; verdict: string; charged: boolean; repeat: boolean }
  | { status: "failed" };

/**
 * The announcement for the latest ask: "Thinking…" while it runs, then the
 * verdict's first sentence and what it cost. The full answer is in the
 * transcript; this only tells someone who cannot see it that it arrived, and
 * whether a credit went. A failure says nothing here, because its bubble is an
 * alert of its own.
 */
export function askAnnouncement(latest: AskProgress | null): string {
  if (latest === null || latest.status === "failed") return "";
  if (latest.status === "pending") return "Thinking…";
  const verdict = latest.verdict.trim();
  const firstSentence = verdict.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? verdict;
  const cost = latest.repeat ? " Asked before, no credit used." : latest.charged ? " 1 credit used." : "";
  return `Answered: ${firstSentence}${cost}`;
}

// ---------------------------------------------------------------------------
// Failures: what the transcript shows in place of an answer
// ---------------------------------------------------------------------------

export type AskFailureKind =
  /** 402. Nothing was generated or kept, and the fix is on the billing screen. */
  | "credits"
  /** 429. The server's message already says when to try again. */
  | "limited"
  /** 409 or 404. The thread no longer matches the job; the ask hook reopens it. */
  | "stale"
  | "failed";

export interface AskFailure {
  kind: AskFailureKind;
  message: string;
  /** False when sending the same thing again cannot work, so the bubble offers no retry. */
  retryable: boolean;
}

// A retry cannot fix what the request itself got wrong: a question the validator
// refuses, a signed-out session, a job with no description to answer from.
const FINAL_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 413, 422]);

/** True when the thread must be opened again before anything else is asked on it. */
export function isStaleThreadError(error: unknown): boolean {
  return error instanceof BackendError && (error.status === 409 || error.status === 404);
}

export function describeAskFailure(error: unknown): AskFailure {
  const message = apiMessage(error);
  if (!(error instanceof BackendError)) return { kind: "failed", message, retryable: true };

  switch (error.status) {
    case 402:
      // Retryable: people top up in another tab and come back to the same question.
      return { kind: "credits", message, retryable: true };
    case 429:
      return { kind: "limited", message, retryable: true };
    case 409:
      // The server tells the user to reopen the job. By the time this renders
      // the ask hook has already done that, so the copy says so instead of
      // sending them looking for a step that no longer exists.
      return {
        kind: "stale",
        message: "This job changed since you opened it. The latest version is loaded now, so ask again.",
        retryable: true,
      };
    case 404:
      return { kind: "stale", message, retryable: true };
    default:
      return { kind: "failed", message, retryable: !FINAL_STATUSES.has(error.status) };
  }
}
