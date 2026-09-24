// Browser-side calls for interview prep sessions, voice and typed.
//
// Every route lives in the AI service under /api/ai/prep and goes through the
// session proxy at `app/api/ai/[...path]/route.ts`, never a rewrite: the proxy
// sets `x-user-id` from the verified session and adds the service token, so the
// browser never says who it is and never holds a secret. Paths are relative for
// the same reason as in `app/lib/api/client.ts`: the session cookie rides along
// first-party.
//
// Audio never comes through here. Recording parts go straight to S3 on the
// presigned PUTs these calls hand out (capture/s3Upload.ts), and live audio
// goes to the speech engine (capture/engineSession.ts).
//
// Two things differ from the plain client:
//  - Dates stay ISO strings. The shared client revives `createdAt` and
//    `completedAt` into Date objects; the voice contract (./types.ts) says
//    strings, so they are turned back here and every caller can trust the
//    declared types.
//  - Create and unlock keep the refusal's `data` (a 402's balance, a 409's
//    open session, a 429's reason), which BackendError drops. Read it with
//    `insufficientCreditsOf`, `openSessionOf` and `limitedOf`.

import { apiDelete, apiGet, apiPost } from "@/app/lib/api/client";
import { BackendError } from "@/app/lib/api/core";
import {
  PREP_LIMIT_REASONS,
  type CreatePrepSessionInput,
  type CreatePrepSessionResult,
  type DeletePrepSessionResult,
  type FinishPrepSessionInput,
  type FinishPrepSessionResult,
  type PartUrlsInput,
  type PartUrlsResult,
  type PlaybackLink,
  type PrepInsufficientCredits,
  type PrepLimited,
  type PrepLimitReason,
  type PrepOpenSessionConflict,
  type PrepRating,
  type PrepRatingInput,
  type PrepSessionDetail,
  type PrepSessionList,
  type PrepSessionSummary,
  type PrepVoiceConfig,
  type RecordingTrack,
  type RetryPrepSessionResult,
  type UnlockPrepSessionResult,
} from "./types";

export const PREP_PATH = "/api/ai/prep";
const SESSIONS_PATH = `${PREP_PATH}/sessions`;

/** Where a 402 sends someone to top up. */
export const PREP_BILLING_HREF = "/dashboard/settings/billing";

// Ids go into the path, so they are encoded, as in `app/lib/jobs/api.ts`.
const sessionPath = (id: string) => `${SESSIONS_PATH}/${encodeURIComponent(id)}`;

// ---------------------------------------------------------------------------
// Refusals that carry data
// ---------------------------------------------------------------------------

/** A non-2xx answer whose `data` says more than the status: see the readers below. */
export class PrepRequestError extends BackendError {
  constructor(
    status: number,
    message: string,
    public readonly data: unknown,
  ) {
    super(status, message);
    this.name = "PrepRequestError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const LIMIT_REASONS: ReadonlySet<string> = new Set(PREP_LIMIT_REASONS);

/** A 402 from create or unlock: the known balance and what a session needs. Null for anything else. */
export function insufficientCreditsOf(error: unknown): PrepInsufficientCredits | null {
  if (!(error instanceof PrepRequestError) || error.status !== 402 || !isRecord(error.data)) return null;
  const { balance, required } = error.data;
  return isCount(balance) && isCount(required) ? { balance, required } : null;
}

/** A 409 from create: the voice session this user still has open. Null for anything else. */
export function openSessionOf(error: unknown): PrepOpenSessionConflict | null {
  if (!(error instanceof PrepRequestError) || error.status !== 409 || !isRecord(error.data)) return null;
  const { sessionId } = error.data;
  return typeof sessionId === "string" && sessionId ? { sessionId } : null;
}

/** A 429 from create: which daily limit, and when it resets if the service said. Null for anything else. */
export function limitedOf(error: unknown): PrepLimited | null {
  if (!(error instanceof PrepRequestError) || error.status !== 429 || !isRecord(error.data)) return null;
  const { reason, retryAfterMs } = error.data;
  if (typeof reason !== "string" || !LIMIT_REASONS.has(reason)) return null;
  return { reason: reason as PrepLimitReason, retryAfterMs: isCount(retryAfterMs) ? retryAfterMs : null };
}

/** A POST that keeps the refusal's data. No date revival, so strings stay strings. */
async function postKeepingData<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { data?: unknown; message?: unknown } | null;
  if (!res.ok) {
    // An empty message falls through to apiMessage's wording for the status.
    const message = typeof json?.message === "string" ? json.message : res.statusText;
    throw new PrepRequestError(res.status, message, json?.data ?? null);
  }
  return json?.data as T;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Every Date the shared client revived, back to the ISO string the contract promises. */
function isoDates<T>(value: T): T {
  return toIso(value) as T;
}

function toIso(value: unknown): unknown {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.map(toIso);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = toIso(item);
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** What the setup screen needs to offer and price a session. */
export function getVoiceConfig(signal?: AbortSignal) {
  return apiGet<PrepVoiceConfig>(`${PREP_PATH}/voice-config`, signal);
}

/**
 * Starts a session (201). A voice session needs `consent`; a typed one needs
 * nothing but the setup. Refusals reject with a PrepRequestError:
 *  - 400: consent missing or stale, or a bad setup;
 *  - 402: a known balance below the base price (`insufficientCreditsOf`);
 *  - 409: a voice session is still open (`openSessionOf`);
 *  - 429: a daily limit (`limitedOf`);
 *  - 503: voice interviews are switched off.
 */
export async function createPrepSession(input: CreatePrepSessionInput): Promise<CreatePrepSessionResult> {
  return isoDates(await postKeepingData<CreatePrepSessionResult>(SESSIONS_PATH, input));
}

// ---------------------------------------------------------------------------
// During a voice session
// ---------------------------------------------------------------------------

/**
 * Presigned PUTs from part `from`. Also the session's heartbeat, so the
 * capture calls it every few minutes even with URLs in hand. A `from` past the
 * cap is refused with a 4xx. `track` is the playback mix's parts (`mix`);
 * the candidate's own track sends none, as every browser before the mix did.
 */
export function getPartUrls(id: string, from: number, track?: RecordingTrack) {
  const body: PartUrlsInput = track && track !== "voice" ? { from, track } : { from };
  return apiPost<PartUrlsResult>(`${sessionPath(id)}/parts/urls`, body);
}

/**
 * The interviewer's voice for one question, synthesized server-side and served
 * from storage. `null` is a normal answer, not a failure: text-to-speech is
 * optional, and the caller falls back to the browser's own `speechSynthesis`.
 */
export function getQuestionSpeech(id: string, questionId: string) {
  return apiPost<PlaybackLink | null>(`${sessionPath(id)}/speech`, { questionId });
}

// ---------------------------------------------------------------------------
// Finishing
// ---------------------------------------------------------------------------

/**
 * Ends the session. Idempotent: finishing again answers with the current
 * state. `uploading` with `missingParts` means upload those parts and finish
 * again; `queued` means the analysis has started.
 */
export function finishPrepSession(id: string, body: FinishPrepSessionInput) {
  return apiPost<FinishPrepSessionResult>(`${sessionPath(id)}/finish`, body);
}

/**
 * Chrome drops a beacon whose pending keepalive bodies pass 64 KB, so the body
 * is kept under this, with room for anything else the page queued.
 */
export const BEACON_MAX_BYTES = 60_000;

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

/**
 * The finish body as the beacon sends it, shrunk to fit `maxBytes`, or null
 * when even the smallest form does not fit. In order, it drops:
 *  1. `liveText` (only the live-versus-batch agreement measure reads it);
 *  2. the playback mix: a manifest as long as the recording's own, and only
 *     ever played (the playback is then the candidate's track, as it always
 *     was), where the next step costs the answers their words;
 *  3. the text of spoken answers (the analysis replaces it with the batch
 *     transcript anyway);
 *  4. the tail of every remaining text, evenly.
 * The part manifest is never dropped: without it the service cannot check the
 * parts, and the abandoned-session sweep finishes the session from storage
 * instead. Nor are the muted stretches: a few hundred bytes that keep a mute
 * from reading as a long pause.
 */
export function beaconPayload(body: FinishPrepSessionInput, maxBytes: number = BEACON_MAX_BYTES): string | null {
  const fits = (candidate: FinishPrepSessionInput): string | null => {
    const json = JSON.stringify(candidate);
    return byteLength(json) <= maxBytes ? json : null;
  };

  const full = fits(body);
  if (full) return full;

  const lean = body.turns.map((turn) => {
    const rest = { ...turn };
    delete rest.liveText;
    return rest;
  });
  const noLive = fits({ ...body, turns: lean });
  if (noLive) return noLive;

  const unmixed: FinishPrepSessionInput = { ...body, turns: lean };
  delete unmixed.mix;
  const noMix = fits(unmixed);
  if (noMix) return noMix;

  const spokenCleared = lean.map((turn) => (turn.who === "user" && turn.source === "voice" ? { ...turn, text: "" } : turn));
  const noSpoken = fits({ ...unmixed, turns: spokenCleared });
  if (noSpoken) return noSpoken;

  // The longest per-turn text cap that fits, by bisection.
  const capped = (cap: number): FinishPrepSessionInput => ({ ...unmixed, turns: spokenCleared.map((turn) => ({ ...turn, text: turn.text.slice(0, cap) })) });
  const longest = spokenCleared.reduce((max, turn) => Math.max(max, turn.text.length), 0);
  if (!fits(capped(0))) return null;
  let low = 0;
  let high = longest;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(capped(mid))) low = mid;
    else high = mid - 1;
  }
  return fits(capped(low));
}

/**
 * Finishes the session from `pagehide`, when an ordinary request would be
 * cancelled with the page. Returns false when the browser has no
 * `sendBeacon`, refuses the beacon, or the body cannot be made small enough;
 * the abandoned-session sweep then finishes the session from storage.
 */
export function beaconFinish(id: string, body: FinishPrepSessionInput): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return false;
  const payload = beaconPayload(body);
  if (payload === null) return false;
  try {
    // JSON on a same-origin beacon: the proxy parses the body whatever its type.
    return navigator.sendBeacon(`${sessionPath(id)}/finish`, new Blob([payload], { type: "application/json" }));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface ListPrepSessionsOptions {
  /** One track's sessions; all of this user's when omitted. */
  trackId?: string;
  signal?: AbortSignal;
}

/** This user's sessions, newest first. */
export async function listPrepSessions({ trackId, signal }: ListPrepSessionsOptions = {}): Promise<PrepSessionList> {
  const query = trackId ? `?${new URLSearchParams({ trackId })}` : "";
  const data = await apiGet<PrepSessionList | PrepSessionSummary[]>(`${SESSIONS_PATH}${query}`, signal);
  // The contract wraps the rows; a bare array is read the same way rather than
  // turning a shape slip into an empty list.
  const sessions = Array.isArray(data) ? data : Array.isArray(data?.sessions) ? data.sessions : [];
  return { sessions: isoDates(sessions) };
}

/** One session. Polled while `queued` or `processing`. Another user's id is a 404. */
export async function getPrepSession(id: string, signal?: AbortSignal): Promise<PrepSessionDetail> {
  return isoDates(await apiGet<PrepSessionDetail>(sessionPath(id), signal));
}

/**
 * A signed link to the recording (`no-store`). A 409 means the playback copy
 * is not ready yet. Fetch a new one when the player gets a 403 or `expiresAt`
 * passes.
 */
export function getPlaybackLink(id: string, signal?: AbortSignal) {
  return apiGet<PlaybackLink>(`${sessionPath(id)}/playback`, signal);
}

// ---------------------------------------------------------------------------
// Acting on a session
// ---------------------------------------------------------------------------

/** How accurate the transcript felt, 1-5. A second rating replaces the first. */
export function ratePrepSession(id: string, score: number) {
  const body: PrepRatingInput = { score };
  return apiPost<PrepRating>(`${sessionPath(id)}/rating`, body);
}

/** Retries the charge on a locked report, under the same reference. A 402 again rejects with `insufficientCreditsOf` data. */
export async function unlockPrepSession(id: string): Promise<UnlockPrepSessionResult> {
  return isoDates(await postKeepingData<UnlockPrepSessionResult>(`${sessionPath(id)}/unlock`));
}

/** A new analysis run after a final failure; a 409 once the retries are used up. */
export function retryPrepSession(id: string) {
  return apiPost<RetryPrepSessionResult>(`${sessionPath(id)}/retry`);
}

/** Deletes the session, its recording, transcript and report. */
export function deletePrepSession(id: string) {
  return apiDelete<DeletePrepSessionResult>(sessionPath(id));
}
