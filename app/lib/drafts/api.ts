// Browser-side calls for application drafts: what the extension kept of a form
// someone left before applying (rwwextension/docs/drafts.md).
//
// Every route lives in the AI service behind the session proxy
// (`app/api/ai/[...path]/route.ts`), which sets `x-user-id` from the session:
// the browser never says whose drafts it is reading, so another user's draft is
// simply a 404. The website only reads, deletes and fuses; saving is the
// extension's job, which is why `SaveDraftInput` has no caller here.
//
// Dates stay ISO strings. The shared client revives `createdAt` and `updatedAt`
// (an answer's too) into Date objects; the contract (./types.ts) says strings,
// so they are turned back here and every caller can trust the declared types.
//
// The pure helpers at the bottom are what "Mark as applied" sends with the
// tracker row: the draft's question answers and its cover letter, fitted to the
// applications table's limits.

import { apiDelete, apiGet, apiPost } from "@/app/lib/api/client";
import { APPLICATION_LIMITS, type ApplicationAnswer } from "@/app/lib/applications/types";
import type { ApplicationDraftAnswer, ApplicationDraftItem, ApplicationDraftStatus, FuseDraftInput, FuseDraftResult } from "./types";

export const DRAFTS_PATH = "/api/ai/answers/drafts";

/** What the list route filters on: one status, or both (`all`). */
export type DraftListStatus = ApplicationDraftStatus | "all";

const draftPath = (id: string) => `${DRAFTS_PATH}/${encodeURIComponent(id)}`;

const isoOf = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value ?? ""));

const answerOf = (answer: ApplicationDraftAnswer): ApplicationDraftAnswer => ({ ...answer, updatedAt: isoOf(answer.updatedAt as unknown) });

/** A draft as the contract declares it, whatever `revive` did to its dates on the way in. */
function draftOf(item: ApplicationDraftItem): ApplicationDraftItem {
  return {
    ...item,
    answers: (item.answers ?? []).map(answerOf),
    createdAt: isoOf(item.createdAt as unknown),
    updatedAt: isoOf(item.updatedAt as unknown),
  };
}

/** Newest `updatedAt` first, at most 300. `draft` is the drafts list; `applied` the last 30 days' fused ones. */
export async function listDrafts(status: DraftListStatus, signal?: AbortSignal): Promise<ApplicationDraftItem[]> {
  const rows = await apiGet<ApplicationDraftItem[]>(`${DRAFTS_PATH}?status=${encodeURIComponent(status)}`, signal);
  return (rows ?? []).map(draftOf);
}

/** 404 when it is already gone (or never was this user's). */
export function deleteDraft(id: string) {
  return apiDelete<{ deleted: true }>(draftPath(id));
}

/**
 * Files a draft's question answers against an application and marks it applied.
 * Idempotent for the same application; an already-applied draft asked to fuse
 * into a different one answers `fused: false` and changes nothing.
 */
export async function fuseDraft(input: FuseDraftInput): Promise<FuseDraftResult> {
  const result = await apiPost<FuseDraftResult>(`${DRAFTS_PATH}/fuse`, input);
  return { ...result, draft: result.draft ? draftOf(result.draft) : null };
}

// ---------------------------------------------------------------------------
// What an application carries from a draft
// ---------------------------------------------------------------------------

/**
 * The draft's question answers as the tracker row stores them: form order,
 * blanks dropped, each fitted to the table's limits, at most
 * `APPLICATION_LIMITS.answersMax` (40) — the same cap the backend applies when
 * it copies a fused draft's answers onto an application. Profile values and the
 * cover letter are not questions and stay out.
 */
export function draftApplicationAnswers(draft: Pick<ApplicationDraftItem, "answers">): ApplicationAnswer[] {
  const answers: ApplicationAnswer[] = [];
  for (const row of draft.answers) {
    if (answers.length >= APPLICATION_LIMITS.answersMax) break;
    if (row.kind !== "question") continue;
    const question = row.question.trim().slice(0, APPLICATION_LIMITS.questionMax);
    const answer = row.answer.trim().slice(0, APPLICATION_LIMITS.answerMax);
    if (question && answer) answers.push({ question, answer });
  }
  return answers;
}

/** The draft's cover letter (the most recently edited, should a form have had two boxes), or null. */
export function draftCoverLetter(draft: Pick<ApplicationDraftItem, "answers">): string | null {
  let latest: ApplicationDraftAnswer | null = null;
  for (const row of draft.answers) {
    if (row.kind !== "cover-letter" || !row.answer.trim()) continue;
    if (!latest || row.updatedAt > latest.updatedAt) latest = row;
  }
  return latest ? latest.answer.trim().slice(0, APPLICATION_LIMITS.coverLetterMax) : null;
}
