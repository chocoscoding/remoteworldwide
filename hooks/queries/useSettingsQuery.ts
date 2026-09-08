"use client";

// Settings, read through React Query.
//
// The endpoint is reached at a relative path so `next.config.mjs`'s
// `/api/settings/*` rewrite carries it to Express with the session cookie
// already attached — no token plumbing, no session lookup per request.
//
// Colocated with the prefetch helper on purpose: the server prefetch and this
// hook must use the same key or the hydration is silently wasted, which is
// exactly the bug the reference implementation ships with. Sharing one file
// makes a mismatch obvious.

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiGet } from "@/app/lib/api/client";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import type { Settings } from "@/app/lib/settings/types";

export const SETTINGS_PATH = "/api/settings/me";

const fetchSettings = (signal?: AbortSignal) => apiGet<Settings>(SETTINGS_PATH, signal);

/**
 * @param initial The object the dashboard layout already fetched server-side.
 *
 * Passed as `initialData` rather than going through `HydrationBoundary`: the
 * layout awaits this value anyway, so seeding the cache directly avoids a
 * second serialization pass AND removes any chance of the server key drifting
 * from the client key — the exact failure the reference implementation ships
 * with. `initialDataUpdatedAt` is left at default (now), which is honest: the
 * fetch happened moments ago in the same request.
 */
export function useSettingsQuery(initial: Settings) {
  return useQuery({
    queryKey: qk.settings.me(),
    queryFn: ({ signal }) => fetchSettings(signal),
    staleTime: STALE_TIME.settings,
    initialData: initial,
  });
}

/** Server-side warm-up. Same key, same fetch — see the note above. */
export function prefetchSettings(queryClient: QueryClient, load: () => Promise<Settings>) {
  return queryClient.prefetchQuery({
    queryKey: qk.settings.me(),
    queryFn: load,
    staleTime: STALE_TIME.settings,
  });
}
