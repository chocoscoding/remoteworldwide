"use client";

// The job picker's reads: this user's saved jobs, one saved job, and Remote
// Worldwide listings.
//
// None of it is persisted to disk — see PERSISTED_DOMAINS in
// app/lib/query/keys.ts. A saved job carries the full text of a posting the
// user is applying to, which has no business outliving the tab on a shared
// machine.

import { useEffect, useState } from "react";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { PLATFORM_SEARCH_LIMIT, getSavedJob, listSavedJobs, searchPlatformJobs } from "@/app/lib/jobs/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

/**
 * How long the picker's search box waits after the last keystroke. Never under
 * 250 ms: each settled query costs two backend reads (saved jobs and listings,
 * the second a regex plus a company-name lookup), and they arrive from the
 * frontend host's IP, where the dashboard limiter's budget is shared by every
 * user of the site.
 */
export const JOB_SEARCH_DEBOUNCE_MS = 300;

/** `value`, once it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs = JOB_SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

// Options builders, shared by the hooks below and by the picker's imperative
// reads (`queryClient.fetchQuery(savedJobQuery(id))`), so a pick and a screen
// reading the same job hit the same cache entry with the same freshness rule.

export const savedJobsQuery = (q: string) =>
  queryOptions({
    queryKey: qk.savedJobs.list(q),
    queryFn: ({ signal }) => listSavedJobs(q, signal),
    staleTime: STALE_TIME.savedJobs,
  });

export const savedJobQuery = (id: string) =>
  queryOptions({
    queryKey: qk.savedJobs.detail(id),
    queryFn: ({ signal }) => getSavedJob(id, signal),
    staleTime: STALE_TIME.savedJobs,
  });

export const platformJobSearchQuery = (q: string, limit = PLATFORM_SEARCH_LIMIT) =>
  queryOptions({
    queryKey: qk.platformJobs.search(q, limit),
    queryFn: ({ signal }) => searchPlatformJobs(q, limit, signal),
    staleTime: STALE_TIME.platformJobs,
  });

interface ListOptions {
  /** Off while the list is not on screen, e.g. the picker's paste tab. */
  enabled?: boolean;
}

/**
 * "Your jobs", most recently used first, filtered on the server. Debounce `q`
 * before passing it (`useDebouncedValue`); this hook fetches on every value.
 */
export function useSavedJobsQuery(q: string, { enabled = true }: ListOptions = {}) {
  return useQuery({
    ...savedJobsQuery(q.trim()),
    enabled,
    // The previous matches stay up while the next search runs, so the list
    // never collapses to a skeleton between keystrokes.
    placeholderData: keepPreviousData,
  });
}

export function useSavedJobQuery(id: string | null) {
  return useQuery({ ...savedJobQuery(id ?? ""), enabled: id !== null });
}

/** Remote Worldwide listings for `q`, newest first. Same debouncing rule as `useSavedJobsQuery`. */
export function usePlatformJobSearch(q: string, { enabled = true, limit = PLATFORM_SEARCH_LIMIT }: ListOptions & { limit?: number } = {}) {
  return useQuery({
    ...platformJobSearchQuery(q.trim(), limit),
    enabled,
    placeholderData: keepPreviousData,
  });
}
