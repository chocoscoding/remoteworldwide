"use client";

// The applications table and the user's goals, read through React Query.
//
// One list, `qk.activity.applications()`, feeds the tracker's columns and its
// closed list, Home's follow-ups, the log dialog's duplicate check and the
// weekly count, so a move can never update one of them and leave the others
// behind. The summary is the server's own funnel over the same rows; goals are
// one row per user.
//
// Persisted to disk with the rest of `activity` (PERSISTED_DOMAINS in
// app/lib/query/keys.ts): a reload paints the board at once and revalidates
// behind it.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { getApplicationSummary, getGoals, listApplications } from "@/app/lib/applications/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

// Options builders, shared by the hooks below and by imperative reads
// (`queryClient.fetchQuery(goalsQuery())`), so both hit the same cache entry
// with the same freshness rule.

export const applicationsQuery = () =>
  queryOptions({
    queryKey: qk.activity.applications(),
    queryFn: ({ signal }) => listApplications(signal),
    staleTime: STALE_TIME.activity,
  });

export const applicationSummaryQuery = () =>
  queryOptions({
    queryKey: qk.activity.summary(),
    queryFn: ({ signal }) => getApplicationSummary(signal),
    staleTime: STALE_TIME.activity,
  });

export const goalsQuery = () =>
  queryOptions({
    queryKey: qk.activity.goals(),
    queryFn: ({ signal }) => getGoals(signal),
    staleTime: STALE_TIME.activity,
  });

interface ReadOptions {
  /** Off when the caller has nothing to show it on yet. */
  enabled?: boolean;
}

/**
 * Every application. Group and order it with the helpers in
 * app/lib/applications/api (`compareByPosition`, `compareByClosedAt`) rather
 * than trusting the order it arrived in: an optimistic write changes a row in
 * place, and only the next read puts it where the server would.
 */
export function useApplications({ enabled = true }: ReadOptions = {}) {
  return useQuery({ ...applicationsQuery(), enabled });
}

/** The funnel, `diagnose()`'s sentence, follow-ups owed and the week's goal. Refreshed once a burst of writes settles. */
export function useApplicationSummary({ enabled = true }: ReadOptions = {}) {
  return useQuery({ ...applicationSummaryQuery(), enabled });
}

/** Weekly target, rest days, hunt hour, pause, and whether the browser board was imported. */
export function useGoals({ enabled = true }: ReadOptions = {}) {
  return useQuery({ ...goalsQuery(), enabled });
}
