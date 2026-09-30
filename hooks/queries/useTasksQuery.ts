"use client";

// The user's plan, read through React Query.
//
// Not persisted to disk: `tasks` is outside PERSISTED_DOMAINS in
// app/lib/query/keys.ts. Services add to a plan without asking (a follow-up
// falling due, a prep report), so a disk-warm list would present an old plan as
// today's and hide the one task that just arrived.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { listTasks } from "@/app/lib/tasks/api";
import type { TaskStatus } from "@/app/lib/tasks/types";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

// An options builder, shared by the hook below and by imperative reads
// (`queryClient.fetchQuery(tasksQuery(period))`), so both hit the same cache
// entry with the same freshness rule.
export const tasksQuery = (period: string, status?: TaskStatus) =>
  queryOptions({
    queryKey: qk.tasks.list(period, status),
    queryFn: ({ signal }) => listTasks({ period, status }, signal),
    staleTime: STALE_TIME.tasks,
  });

interface TasksOptions {
  /** Off when the caller has nothing to look up yet. */
  enabled?: boolean;
}

/**
 * One period's tasks (`YYYY-MM`, usually `periodOf(new Date())`), in the
 * server's order: open first, then priority, then newest. Without `status` the
 * list holds done and dismissed tasks too, so filter it with `isOnPlan` from
 * app/lib/tasks/api before showing it, and count it with `planProgress`.
 */
export function useTasks(period: string, status?: TaskStatus, { enabled = true }: TasksOptions = {}) {
  return useQuery({ ...tasksQuery(period, status), enabled });
}
