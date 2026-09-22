// Browser-side calls for the streak, freezes, gifts and repairs.
//
// Every path goes through the `/api/streak/:path*` rewrite in next.config.mjs,
// so the session cookie rides along first-party. Plain functions; the hooks in
// hooks/queries/useStreakQuery.ts and hooks/mutations/useStreakMutations.ts
// wrap them for caching.

import { apiGet, apiPost } from "@/app/lib/api/client";
import type { GiftKind } from "@/app/lib/dashboard/gifts";
import type { RepairMethod, StreakItem, StreakWithGifts } from "./types";

export const STREAK_PATH = "/api/streak";

/**
 * The browser's own timezone, sent with every read. The server uses it only
 * while the user's settings name none — so someone who never picked a zone
 * still gets their own midnight rather than UTC's.
 */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function getStreak(signal?: AbortSignal) {
  const zone = browserTimeZone();
  return apiGet<StreakItem>(zone ? `${STREAK_PATH}?tz=${encodeURIComponent(zone)}` : STREAK_PATH, signal);
}

export function getGifts(signal?: AbortSignal) {
  return apiGet<StreakWithGifts>(`${STREAK_PATH}/gifts`, signal);
}

/** Uses the oldest waiting gift of `kind`. */
export function redeemGift(kind: GiftKind) {
  return apiPost<StreakWithGifts>(`${STREAK_PATH}/gifts/redeem`, { kind });
}

/** Buys the current break back: credits (a ledger spend), a restore gift, or the free half-restore. */
export function repairStreak(method: RepairMethod) {
  return apiPost<StreakWithGifts>(`${STREAK_PATH}/repair`, { method });
}

/** "Start from zero instead": the offer for this break stops showing. */
export function dismissRepair() {
  return apiPost<StreakItem>(`${STREAK_PATH}/repair/dismiss`);
}

/** Celebrations shown and freeze notices told, so neither comes back. */
export function markStreakSeen(input: { milestones?: number[]; freezes?: string[] }) {
  return apiPost<{ seen: true }>(`${STREAK_PATH}/seen`, input);
}

/** Hired: the streak retires at its count and the search pauses. */
export function retireStreak() {
  return apiPost<StreakItem>(`${STREAK_PATH}/retire`);
}

/** The one action a browser reports itself: a follow-up on one of its own applications. */
export function reportFollowUp(applicationId: string) {
  return apiPost<StreakItem>(`${STREAK_PATH}/actions`, { kind: "follow-up", applicationId });
}
