"use client";

// The pod, read through React Query.
//
// One query for the whole screen, because the endpoint answers with the whole
// screen. Every mutation returns the same shape, so an action writes its
// response straight into this cache rather than triggering a refetch.
//
// Not persisted to disk — see PERSISTED_DOMAINS in app/lib/query/keys.ts. Other
// people write this feed, so a disk-warm copy would present someone else's
// stale activity as current.

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiGet } from "@/app/lib/api/client";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import type { PodOverview } from "@/app/lib/pod/types";

export const POD_PATH = "/api/pod/overview";

const fetchPod = (signal?: AbortSignal) => apiGet<PodOverview>(POD_PATH, signal);

/** @param initial The object the pod page already fetched server-side. */
export function usePodQuery(initial: PodOverview) {
  return useQuery({
    queryKey: qk.pod.overview(),
    queryFn: ({ signal }) => fetchPod(signal),
    staleTime: STALE_TIME.pod,
    initialData: initial,
  });
}

/** Server-side warm-up. Same key, same fetch. */
export function prefetchPod(queryClient: QueryClient, load: () => Promise<PodOverview>) {
  return queryClient.prefetchQuery({ queryKey: qk.pod.overview(), queryFn: load, staleTime: STALE_TIME.pod });
}
