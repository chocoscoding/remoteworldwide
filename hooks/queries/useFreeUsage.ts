"use client";

// This month's free uses of the gated tools, for the "1 of 1 free this month" counters below a
// plan (AI service GET /api/ai/plan/usage, through the session proxy). A Pro account gets an empty
// list; so does any failure, so a counter is only ever shown from a real answer.

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/app/lib/api/client";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import type { FreeAllowance, FreeFeature, FreeUsage } from "@/app/lib/settings/types";

export const FREE_USAGE_PATH = "/api/ai/plan/usage";

export function useFreeUsage() {
  const query = useQuery({
    queryKey: qk.billing.freeUsage(),
    queryFn: ({ signal }) => apiGet<FreeUsage>(FREE_USAGE_PATH, signal),
    staleTime: STALE_TIME.billing,
    retry: false,
  });
  const features = query.data?.features ?? [];
  /** The allowance for one feature, or null when the plan has no count for it (or it is unknown). */
  const of = (feature: FreeFeature): FreeAllowance | null => features.find((f) => f.feature === feature) ?? null;
  return { ...query, of, month: query.data?.month ?? null };
}
