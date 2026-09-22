// Browser-side calls for the saved-answer library and its use log.
//
// Every route lives in the AI service behind the session proxy
// (`app/api/ai/[...path]/route.ts`), which sets `x-user-id` from the session:
// the browser never says whose library it is editing, so another user's answer
// is simply a 404.
//
// One call keeps its refusal's `data`, which BackendError drops: a create that
// hits a question already saved answers 409 WITH that saved answer, and the
// screen shows it rather than a generic conflict. The server's key decides what
// counts as the same question — there is no client-side normalizing to drift
// from it.

import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/lib/api/client";
import { BackendError, revive } from "@/app/lib/api/core";
import type { QaItem } from "@/app/lib/dashboard/types";
import type {
  AddAnswerResult,
  AnswerHistoryItem,
  AnswerResolveChoice,
  CreateAnswerInput,
  DeleteAnswerResult,
  RecordAnswerUsesInput,
  RecordAnswerUsesResult,
  UpdateAnswerInput,
} from "./types";

export const ANSWERS_PATH = "/api/ai/answers";
const HISTORY_PATH = `${ANSWERS_PATH}/history`;

const answerPath = (id: string) => `${ANSWERS_PATH}/${encodeURIComponent(id)}`;

export function listAnswers(signal?: AbortSignal) {
  return apiGet<QaItem[]>(ANSWERS_PATH, signal);
}

/**
 * Saves an answer in the user's own words. A question the library already holds
 * resolves (not rejects) with `{ added: false, existing }`, because it is an
 * answer to show, not an error; anything else non-2xx rejects as usual.
 */
export async function createAnswer(input: CreateAnswerInput): Promise<AddAnswerResult> {
  const res = await fetch(ANSWERS_PATH, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(input),
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { data?: unknown; message?: unknown } | null;
  const data = revive(json?.data) as QaItem | null | undefined;
  if (res.status === 409 && data && typeof data.id === "string") return { added: false, existing: data };
  if (!res.ok || !data) throw new BackendError(res.status, typeof json?.message === "string" ? json.message : res.statusText);
  return { added: true, item: data };
}

export function updateAnswer(id: string, input: UpdateAnswerInput) {
  return apiPatch<QaItem>(answerPath(id), input);
}

export function resolveAnswer(id: string, choice: AnswerResolveChoice) {
  return apiPost<QaItem>(`${answerPath(id)}/resolve`, { choice });
}

export function deleteAnswer(id: string) {
  return apiDelete<DeleteAnswerResult>(answerPath(id));
}

/** Every application answers were filled on, latest first. */
export function listAnswerHistory(signal?: AbortSignal) {
  return apiGet<AnswerHistoryItem[]>(HISTORY_PATH, signal);
}

/** Records answers used on an application the app created after filling them (the apply wizard's submit). */
export function recordAnswerUses(input: RecordAnswerUsesInput) {
  return apiPost<RecordAnswerUsesResult>(HISTORY_PATH, input);
}
