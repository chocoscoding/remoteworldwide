// Browser-side calls for interview prep tracks and their likely questions.
//
//  - Tracks live in the backend at /api/prep-tracks, reached through the
//    `/api/prep-tracks/:path*` rewrite in `next.config.mjs`, so the Auth.js
//    cookie rides along first-party and the backend's session guard sees the
//    user — the same door as the plan and the applications.
//  - Likely questions live in the AI service under /api/ai/prep/tracks, behind
//    the session proxy (`app/api/ai/[...path]/route.ts`), which sets
//    `x-user-id` from the session. Only the track's id is ever sent: the AI
//    service reads the posting from the backend itself, so nobody can spend a
//    model call on text of their choosing.
//
// Plain functions; `hooks/queries/usePrepTrackQueries.ts` and
// `hooks/mutations/usePrepTrackMutations.ts` wrap them for caching.

import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/lib/api/client";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import type {
  CreatePrepTrackInput,
  GenerateLikelyQuestionsInput,
  LikelyQuestionsResult,
  LikelyQuestionsState,
  PrepTrackCreated,
  PrepTrackDetail,
  PrepTrackItem,
  UpdatePrepTrackInput,
} from "./types";

export const PREP_TRACKS_PATH = "/api/prep-tracks";
const QUESTIONS_PATH = "/api/ai/prep/tracks";

// Ids go into the path, so they are encoded. An id is only ever an ObjectId
// from our own responses, but a "../" reaching here through a bad caller would
// otherwise address a different route behind the same rewrite.
const at = (id: string) => `${PREP_TRACKS_PATH}/${encodeURIComponent(id)}`;
const questionsAt = (trackId: string) => `${QUESTIONS_PATH}/${encodeURIComponent(trackId)}/questions`;

/** A backend id: what every saved track, application and saved job carries. */
export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

/** Every track, most recently touched first, each with its plan tasks. */
export function listPrepTracks(signal?: AbortSignal) {
  return apiGet<PrepTrackItem[]>(PREP_TRACKS_PATH, signal);
}

/** One track with its pasted posting, for the details editor. Another user's id is a 404. */
export function getPrepTrack(id: string, signal?: AbortSignal) {
  return apiGet<PrepTrackDetail>(at(id), signal);
}

/**
 * Also puts the job at interviewing on the tracker, and says what it did
 * (`tracker`). A job that already has a track answers with that track
 * (`alreadyTracked`) rather than a refusal; 409 only at the account's cap.
 */
export function createPrepTrack(input: CreatePrepTrackInput) {
  return apiPost<PrepTrackCreated>(PREP_TRACKS_PATH, input);
}

/** Any subset; `rounds` replaces the whole list, keeping each named round's id. */
export function updatePrepTrack(id: string, input: UpdatePrepTrackInput) {
  return apiPatch<PrepTrackItem>(at(id), input);
}

/** The track's plan tasks stay on the plan. */
export function deletePrepTrack(id: string) {
  return apiDelete<{ id: string }>(at(id));
}

// ---------------------------------------------------------------------------
// Likely questions
// ---------------------------------------------------------------------------

/** The stored set, whether it is stale, and what a new one costs. Free. */
export function getLikelyQuestions(trackId: string, signal?: AbortSignal) {
  return apiGet<LikelyQuestionsState>(questionsAt(trackId), signal);
}

/**
 * Write a set. Costs a credit when a new one is written; without `refresh`, a
 * set already written from the same posting and resume comes back free.
 */
export function generateLikelyQuestions(trackId: string, input: GenerateLikelyQuestionsInput = {}) {
  return apiPost<LikelyQuestionsResult>(questionsAt(trackId), input);
}

export type LikelyQuestionsFailureKind = "credits" | "no-posting" | "limited" | "failed";

export interface LikelyQuestionsFailure {
  kind: LikelyQuestionsFailureKind;
  message: string;
}

/** What went wrong, as the questions panel answers it: a 402 links to billing, a 422 to the posting editor. */
export function describeLikelyQuestionsFailure(error: unknown): LikelyQuestionsFailure {
  const message = apiMessage(error);
  if (error instanceof BackendError && error.status === 402) return { kind: "credits", message };
  if (error instanceof BackendError && error.status === 422) return { kind: "no-posting", message };
  if (error instanceof BackendError && error.status === 429) return { kind: "limited", message };
  return { kind: "failed", message };
}
