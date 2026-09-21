"use client";

// Ask about a job: this user's thread for one saved job, meaning every answer
// so far and which quick questions are already answered.
//
// The read is a POST, deliberately. The AI service opens or creates the thread
// for (user, saved job, posting text) and returns it, so the screen needs
// nothing but the saved job's id, and opening again after an edit lands on the
// thread for the current text. A GET by thread id would keep serving the thread
// for the old text.
//
// Opening never charges, but it is rate limited per user, so nothing here
// refetches on its own. The query client already skips refetch on window
// focus, the stale time is long, `useAskJob` writes each answer into this
// cache entry instead of refetching, and a failed open is not retried once the
// AI service has answered it (see `retry` below).
//
// Not persisted to disk (see PERSISTED_DOMAINS in app/lib/query/keys.ts):
// answers quote the user's resume back to them.

import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { BackendError, shouldRetry } from "@/app/lib/api/core";
import { getJobThread, openJobThread } from "@/app/lib/jobs/ask";
import type { JobThreadItem } from "@/app/lib/jobs/types";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

export const jobThreadQuery = (savedJobId: string) =>
  queryOptions({
    queryKey: qk.jobThreads.forSavedJob(savedJobId),
    queryFn: () => openJobThread(savedJobId),
    staleTime: STALE_TIME.jobThreads,
    // Asked again only when no answer came back at all. Any answer from the AI
    // service, a 503 included, has already counted against the hourly open
    // limit (the limit runs before it loads the saved job), so the client's
    // usual three retries would spend four opens on every failure, and a few
    // clicks of "Try again" during an outage would lock the user out for the hour.
    retry: (failureCount, error) => !(error instanceof BackendError) && shouldRetry(failureCount, error),
  });

/** The thread for `savedJobId`. Idle while no job is picked. */
export function useJobThread(savedJobId: string | null) {
  return useQuery({ ...jobThreadQuery(savedJobId ?? ""), enabled: savedJobId !== null });
}

/**
 * Writes the thread as it stands now into `savedJobId`'s entry, read by thread
 * id. Never an invalidate: that refetch would open the thread again, which is
 * rate limited. An entry that has moved on to another thread is left alone.
 */
export async function refreshJobThread(queryClient: QueryClient, savedJobId: string, threadId: string): Promise<void> {
  const fresh = await getJobThread(threadId);
  queryClient.setQueryData<JobThreadItem>(qk.jobThreads.forSavedJob(savedJobId), (thread) => (thread && thread.id === fresh.id ? fresh : thread));
}
