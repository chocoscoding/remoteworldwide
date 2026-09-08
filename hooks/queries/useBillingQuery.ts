"use client";

// Billing overview — plan, credit balance, subscription state.
//
// Note it is NOT on the persistence allowlist in query/keys.ts: the payload
// carries plan and payment identifiers, which have no business sitting in
// localStorage. It refetches on load instead.

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiGet } from "@/app/lib/api/client";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import type { BillingOverview } from "@/app/lib/settings/types";

export const BILLING_PATH = "/api/billing/overview";

const fetchBilling = (signal?: AbortSignal) => apiGet<BillingOverview>(BILLING_PATH, signal);

/** @param initial The layout's server-side fetch — see the note in useSettingsQuery. */
export function useBillingQuery(initial: BillingOverview) {
  return useQuery({
    queryKey: qk.billing.overview(),
    queryFn: ({ signal }) => fetchBilling(signal),
    staleTime: STALE_TIME.billing,
    initialData: initial,
  });
}

export function prefetchBilling(queryClient: QueryClient, load: () => Promise<BillingOverview>) {
  return queryClient.prefetchQuery({
    queryKey: qk.billing.overview(),
    queryFn: load,
    staleTime: STALE_TIME.billing,
  });
}
