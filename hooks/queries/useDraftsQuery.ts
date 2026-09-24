"use client";

// Application drafts, read through React Query.
//
// They live in the AI service (`ai_application_drafts`) behind the session
// proxy, and the extension writes them — from the tab where a form is being
// filled, not this one. So unlike the rest of the dashboard this list refetches
// when the window regains focus: coming back from an application tab is exactly
// when it has changed.
//
// Not persisted to disk (see PERSISTED_DOMAINS in app/lib/query/keys.ts): a
// draft holds someone's answers, phone number and salary expectation included.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { listDrafts, type DraftListStatus } from "@/app/lib/drafts/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

/** Options builder, shared by the hook and by imperative reads, so both hit the same cache entry. */
export const draftsQuery = (status: DraftListStatus) =>
  queryOptions({
    queryKey: qk.drafts.list(status),
    queryFn: ({ signal }) => listDrafts(status, signal),
    staleTime: STALE_TIME.drafts,
    refetchOnWindowFocus: true,
  });

/** Drafts with one status, or both (`"all"`, the default), newest `updatedAt` first. */
export function useDraftsQuery(status: DraftListStatus = "all") {
  return useQuery(draftsQuery(status));
}
