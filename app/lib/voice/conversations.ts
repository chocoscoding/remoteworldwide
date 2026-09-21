// Browser-side calls for spoken conversations: the career coach, Ask about a
// job and the mock interview, all over the ElevenLabs Speech Engine.
//
// Same conventions as ./api.ts: relative /api/ai paths through the session
// proxy, and refusals keep their `data` (a 409's live call, a 429's limit), which
// BackendError drops. Read them with `conversationConflictOf`, `voiceLimitedOf`
// and `isVoiceUnavailable`, or all at once with `mintRefusalOf`.
//
// A mint answers with a signed URL, a single-use bearer credential. Nothing here
// logs it, stores it or puts it in an error.

import { apiGet } from "@/app/lib/api/client";
import { BackendError } from "@/app/lib/api/core";
import {
  VOICE_FEATURES,
  type MintVoiceConversationInput,
  type MintVoiceConversationResult,
  type ReleaseVoiceConversationInput,
  type VoiceConversationConfig,
  type VoiceConversationConflict,
  type VoiceConversationStatus,
  type VoiceFeature,
} from "./conversation";

export const VOICE_PATH = "/api/ai/voice";
const CONVERSATIONS_PATH = `${VOICE_PATH}/conversations`;
export const RELEASE_PATH = `${CONVERSATIONS_PATH}/release`;

/** A non-2xx answer whose `data` says more than the status: see the readers below. */
export class VoiceRequestError extends BackendError {
  constructor(
    status: number,
    message: string,
    public readonly data: unknown,
  ) {
    super(status, message);
    this.name = "VoiceRequestError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const FEATURES: ReadonlySet<string> = new Set(VOICE_FEATURES);

async function postKeepingData<T>(path: string, body: unknown, keepalive = false): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
    keepalive,
  });
  const json = (await res.json().catch(() => null)) as { data?: unknown; message?: unknown } | null;
  if (!res.ok) {
    const message = typeof json?.message === "string" ? json.message : res.statusText;
    throw new VoiceRequestError(res.status, message, json?.data ?? null);
  }
  return json?.data as T;
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

/** Whether spoken conversations are on, per feature, and today's remaining minutes. */
export function getVoiceConfig(signal?: AbortSignal) {
  return apiGet<VoiceConversationConfig>(`${VOICE_PATH}/config`, signal);
}

/**
 * Mints one conversation. Reserves nothing: the call is metered once it
 * connects. Refusals reject with a VoiceRequestError:
 *  - 409: a call is already live (`conversationConflictOf`);
 *  - 429: today's minutes are used, or too many calls were started (`voiceLimitedOf`);
 *  - 503: spoken conversations are switched off (`isVoiceUnavailable`).
 */
export function mintConversation(input: MintVoiceConversationInput): Promise<MintVoiceConversationResult> {
  return postKeepingData<MintVoiceConversationResult>(CONVERSATIONS_PATH, input);
}

/** Hangs up or cancels a call. `keepalive`, so it survives the page navigating away. */
export function releaseConversation(conversationId: string): Promise<{ status: VoiceConversationStatus }> {
  const body: ReleaseVoiceConversationInput = { conversationId };
  return postKeepingData<{ status: VoiceConversationStatus }>(RELEASE_PATH, body, true);
}

/**
 * Releases from `pagehide`, when an ordinary request would be cancelled with the
 * page. Falls back to a keepalive release when the browser has no `sendBeacon`
 * or refuses the beacon; returns whether the beacon was queued.
 */
export function beaconRelease(conversationId: string): boolean {
  const body: ReleaseVoiceConversationInput = { conversationId };
  let queued = false;
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      queued = navigator.sendBeacon(RELEASE_PATH, new Blob([JSON.stringify(body)], { type: "application/json" }));
    } catch {
      queued = false;
    }
  }
  if (!queued) void releaseConversation(conversationId).catch(() => undefined);
  return queued;
}

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

/** A 409 from mint: the call this user already has live. Null for anything else. */
export function conversationConflictOf(error: unknown): VoiceConversationConflict | null {
  if (!(error instanceof VoiceRequestError) || error.status !== 409 || !isRecord(error.data)) return null;
  const { conversationId, feature } = error.data;
  if (typeof conversationId !== "string" || !conversationId || typeof feature !== "string" || !FEATURES.has(feature)) return null;
  return { conversationId, feature: feature as VoiceFeature };
}

/**
 * A 429 from mint. `minutes` when the refusal names today's voice minutes;
 * `rate` for anything else, which is the hourly limit on starting calls.
 */
export interface VoiceLimited {
  kind: "minutes" | "rate";
  retryAfterMs: number | null;
}

/** Null for anything but a 429. */
export function voiceLimitedOf(error: unknown): VoiceLimited | null {
  if (!(error instanceof BackendError) || error.status !== 429) return null;
  const data = error instanceof VoiceRequestError && isRecord(error.data) ? error.data : {};
  return { kind: data.reason === "voice-minutes" ? "minutes" : "rate", retryAfterMs: isCount(data.retryAfterMs) ? data.retryAfterMs : null };
}

const UNAVAILABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

/** Switched off, or the service could not be reached. */
export function isVoiceUnavailable(error: unknown): boolean {
  if (error instanceof BackendError) return UNAVAILABLE_STATUSES.has(error.status);
  return error instanceof TypeError;
}

/** Why a mint was refused, in the talk state's terms. Anything unrecognised is `unavailable`. */
export type MintRefusal =
  | { kind: "conflict"; conflict: VoiceConversationConflict }
  | { kind: "minutes" | "rate"; retryAt?: string }
  | { kind: "unavailable" };

export function mintRefusalOf(error: unknown, now: number = Date.now()): MintRefusal {
  const conflict = conversationConflictOf(error);
  if (conflict) return { kind: "conflict", conflict };
  const limited = voiceLimitedOf(error);
  if (limited) return limited.retryAfterMs === null ? { kind: limited.kind } : { kind: limited.kind, retryAt: new Date(now + limited.retryAfterMs).toISOString() };
  return { kind: "unavailable" };
}
