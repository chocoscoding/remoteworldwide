"use client";

// Referral search: the stored web search for one saved job, or null when the
// job has never been searched. Reading it is free; running a search is the
// mutation in hooks/mutations/useRunReferralSearch.ts, which writes its result
// into this cache entry.
//
// Nothing here searches on its own. A search costs a credit, so it only ever
// runs from a click — opening the screen just shows what was found before.
//
// Not persisted to disk (see PERSISTED_DOMAINS in app/lib/query/keys.ts): it
// is a list of real people's names and likely addresses.

import { useQuery } from "@tanstack/react-query";
import { getReferralSearch } from "@/app/lib/referrals/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

/** The stored search for `savedJobId`. Idle while no job is picked. */
export function useReferralSearch(savedJobId: string | null) {
  return useQuery({
    queryKey: qk.referrals.forSavedJob(savedJobId ?? ""),
    queryFn: ({ signal }) => getReferralSearch(savedJobId ?? "", signal),
    staleTime: STALE_TIME.referrals,
    enabled: savedJobId !== null,
  });
}
