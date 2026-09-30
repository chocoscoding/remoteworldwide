"use client";

// The streak and the gift inventory, read through React Query.
//
// Both are the server's: the streak is derived from the activity log on every
// read (freezes spent, breaks recorded, rungs paid), so the browser only ever
// shows what the server decided. Persisted to disk with the rest of `activity`
// (PERSISTED_DOMAINS in app/lib/query/keys.ts) so the header pill paints at once
// on a reload; neither carries a company name — gift reasons and audit reasons
// are the server's own sentences.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { getGifts, getStreak } from "@/app/lib/streak/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

export const streakQuery = () =>
  queryOptions({
    queryKey: qk.activity.streak(),
    queryFn: ({ signal }) => getStreak(signal),
    staleTime: STALE_TIME.activity,
  });

export const giftsQuery = () =>
  queryOptions({
    queryKey: qk.activity.gifts(),
    queryFn: ({ signal }) => getGifts(signal),
    staleTime: STALE_TIME.activity,
  });

/** The streak: count, days, freezes, the repair offer, rungs reached. */
export function useStreakQuery() {
  return useQuery(streakQuery());
}

/** Every gift ever granted, used or waiting, oldest first. */
export function useGiftsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...giftsQuery(), enabled });
}
