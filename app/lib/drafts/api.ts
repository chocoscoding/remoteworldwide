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
// applications table's limits. Below them, `collapseSameJob`: the drafts page's
// one row per job, however many drafts the service holds for it.

import { apiDelete, apiGet, apiPost } from "@/app/lib/api/client";
import { BackendError } from "@/app/lib/api/core";
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
 * Every draft behind one drafts-page row (`ListedDraft.draftIds`), so an older
 * draft of the same job cannot take the deleted row's place. One already gone
 * is what was asked for. Fails on anything else, or — as one draft's delete
 * always did — with the 404 when every one of them was already gone.
 */
export async function deleteDrafts(ids: readonly string[]): Promise<{ deleted: true }> {
  const results = await Promise.allSettled(ids.map((id) => deleteDraft(id)));
  const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason as unknown] : []));
  const real = failures.find((error) => !(error instanceof BackendError && error.status === 404));
  if (real) throw real;
  if (failures.length > 0 && failures.length === ids.length) throw failures[0];
  return { deleted: true };
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

// ---------------------------------------------------------------------------
// One row per job
// ---------------------------------------------------------------------------

/**
 * A drafts-page row. Its `id` and every detail are the newest-updated draft's;
 * `draftIds` is that one first, then any older drafts of the same job, which
 * the row stands for too — so its delete takes them all.
 */
export type ListedDraft = ApplicationDraftItem & { draftIds: string[] };

/**
 * The AI service's question key (remoteworldwideai/src/lib/normalize.ts
 * `normalizeQuestion`, over wording it has already cleaned), so two drafts'
 * answers to one question are one answer here, as they would be there.
 */
const questionKey = (question: string): string =>
  question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Newest `updatedAt` first. ISO strings, so comparing them is comparing the moments. */
const newestFirst = (a: ApplicationDraftItem, b: ApplicationDraftItem) => (a.updatedAt === b.updatedAt ? 0 : a.updatedAt < b.updatedAt ? 1 : -1);

/**
 * Several drafts' answers as one, the way the service merges two saves: one per
 * question, the newest `updatedAt` winning — a blank one (a removal) included,
 * so a question taken back in one draft is not brought back by an older one.
 * The first draft's form order, then questions only the others had.
 */
function mergedAnswers(drafts: ApplicationDraftItem[]): ApplicationDraftAnswer[] {
  const byKey = new Map<string, ApplicationDraftAnswer>();
  for (const draft of drafts) {
    for (const answer of draft.answers) {
      const key = questionKey(answer.question);
      const held = byKey.get(key);
      // A Map keeps a key's first position when it is set again, which is what holds the form order.
      if (!held || answer.updatedAt > held.updatedAt) byKey.set(key, answer);
    }
  }
  return [...byKey.values()];
}

/**
 * The drafts list, one row per job. Drafts sharing a `postingKey` are one
 * posting the service holds more than one draft for, and list as one: the
 * newest-updated draft's details, with every distinct answer across them,
 * counted the way the service counts (`answerCount`: a filled answer, once per
 * question). A draft without a `postingKey` — every draft, from a service that
 * predates the field — is a job of its own, so this changes nothing until the
 * field arrives. Rows keep the list's order: a group sits where its first draft
 * did, which in a list sorted newest-first is its newest.
 */
export function collapseSameJob(drafts: ApplicationDraftItem[]): ListedDraft[] {
  const groups = new Map<string, ApplicationDraftItem[]>();
  for (const draft of drafts) {
    // Prefixed, so no posting key can ever collide with a draft id.
    const key = draft.postingKey ? `posting:${draft.postingKey}` : `draft:${draft.id}`;
    const group = groups.get(key);
    if (group) group.push(draft);
    else groups.set(key, [draft]);
  }
  return [...groups.values()].map((group): ListedDraft => {
    if (group.length === 1) return { ...group[0], draftIds: [group[0].id] };
    // A stable sort, so a tie keeps the service's own order (updatedAt, then id, both descending).
    const ordered = [...group].sort(newestFirst);
    const answers = mergedAnswers(ordered);
    return {
      ...ordered[0],
      answers,
      answerCount: answers.filter((answer) => answer.answer.length > 0).length,
      draftIds: ordered.map((draft) => draft.id),
    };
  });
}
