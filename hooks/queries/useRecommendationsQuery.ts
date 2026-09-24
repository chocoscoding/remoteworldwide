"use client";

// The recommend screen's reads: the user's recommendations (backend), the live
// listings "worth watching" (platform-job searches, scored in the browser), and
// the warm paths — saved contacts at those companies.
//
// None of it is persisted to disk: `recommendations`, `platformJobs` and
// `contacts` are all outside PERSISTED_DOMAINS in app/lib/query/keys.ts.

import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { shouldRetry } from "@/app/lib/api/core";
import { companyKeyOf, contactToReferral } from "@/app/lib/contacts/people";
import { TIE_META } from "@/app/lib/contacts/ties";
import type { ReferralContact } from "@/app/lib/dashboard/types";
import { PLATFORM_SEARCH_LIMIT } from "@/app/lib/jobs/api";
import type { PlatformJobSearchItem } from "@/app/lib/jobs/types";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import { getRecommendation, getRecommendationEligibility, listRecommendations } from "@/app/lib/recommendations/api";
import type { RecommendationItem } from "@/app/lib/recommendations/types";
import { useContacts } from "./useContactsQuery";
import { platformJobSearchQuery } from "./useJobQueries";

/** Every recommendation, live and closed, newest first. */
export function useRecommendations() {
  return useQuery({
    queryKey: qk.recommendations.list(),
    queryFn: ({ signal }) => listRecommendations(signal),
    staleTime: STALE_TIME.recommendations,
  });
}

/**
 * Whether reviewers can pick you yet. Always fresh on mount (staleTime 0): it is
 * fixed on other screens — settings, My documents — and coming back from one
 * should show the item ticked, not a minute-old checklist.
 */
export function useRecommendationEligibility() {
  return useQuery({
    queryKey: qk.recommendations.eligibility(),
    queryFn: ({ signal }) => getRecommendationEligibility(signal),
    staleTime: 0,
  });
}

/**
 * One recommendation, for its own page. Opens on the list's copy when the list
 * is already cached (so a click from the list paints at once), then confirms
 * against the server. A 404 is final — someone else's id, or one deleted — so
 * it is not retried.
 */
export function useRecommendation(id: string) {
  const queryClient = useQueryClient();
  return useQuery<RecommendationItem>({
    queryKey: qk.recommendations.detail(id),
    queryFn: ({ signal }) => getRecommendation(id, signal),
    staleTime: STALE_TIME.recommendations,
    retry: shouldRetry,
    placeholderData: () => queryClient.getQueryData<RecommendationItem[]>(qk.recommendations.list())?.find((r) => r.id === id),
  });
}

/** Target-role searches per screen: each is one platform-job search, and three roles cover what people set. */
const ROLE_SEARCHES = 3;

/**
 * The pool of live listings the "worth watching" list is scored from: the
 * newest listings, plus a search per target role (the listing search matches a
 * title or company substring, so "Product Designer" finds "Senior Product
 * Designer"). Deduplicated by listing; scoring and ranking are the caller's,
 * because they read the user's unsaved preference edits too.
 */
export function useWatchPool(targetRoles: readonly string[]) {
  const roles = [...new Set(targetRoles.map((r) => r.trim()).filter(Boolean))].slice(0, ROLE_SEARCHES);
  return useQueries({ queries: ["", ...roles].map((q) => platformJobSearchQuery(q, PLATFORM_SEARCH_LIMIT)), combine: combinePool });
}

/**
 * Module-level on purpose: useQueries re-runs `combine` only when a result
 * changes or the function itself does, so a stable reference keeps `jobs`
 * stable across renders — the screen's scoring memo depends on it.
 */
function combinePool(results: UseQueryResult<PlatformJobSearchItem[]>[]) {
  const byId = new Map<string, PlatformJobSearchItem>();
  for (const result of results) for (const job of result.data ?? []) if (!byId.has(job.id)) byId.set(job.id, job);
  const jobs = [...byId.values()];
  return {
    jobs,
    loading: jobs.length === 0 && results.some((r) => r.isPending),
    failed: jobs.length === 0 && results.length > 0 && results.every((r) => r.isError),
    retry: () => results.forEach((r) => void r.refetch()),
  };
}

const sameCompany = (a: string, b: string) => companyKeyOf(a) !== "" && companyKeyOf(a) === companyKeyOf(b);
const byWarmth = (a: ReferralContact, b: ReferralContact) => TIE_META[a.tie].rank - TIE_META[b.tie].rank;

/**
 * Your saved contacts at these companies — the one warm path each card offers.
 * Only these companies, and at most a page of people: the backend matches
 * company names however they were typed ("Stripe, Inc." is Stripe). Moved here
 * from NetworkProvider, which fetched them on every dashboard screen for cards
 * that only this screen shows.
 */
export function useWarmPaths(companies: readonly string[]) {
  const wanted = [...new Set(companies.filter(Boolean))].slice(0, 20);
  const query = useContacts({ company: wanted, pageSize: 100 }, { enabled: wanted.length > 0 });
  const contacts = useMemo(() => (query.data?.items ?? []).map(contactToReferral), [query.data]);
  return (company: string): ReferralContact | undefined => contacts.filter((c) => sameCompany(c.company, company)).sort(byWarmth)[0];
}
