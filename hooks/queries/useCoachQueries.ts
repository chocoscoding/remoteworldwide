"use client";

// The career coach's conversations, read through React Query.
//
// Not persisted to disk: `coach` is outside PERSISTED_DOMAINS in
// app/lib/query/keys.ts. A conversation about someone's search, salary and
// rejections has no business surviving on a shared machine.
//
// A send never refetches either read. A turn writes what it learns straight
// into these entries (hooks/mutations/useSendCoachMessage.ts): a new session
// into the list, the title the first message gives it, the stored messages, and
// today's allowance. The stream's answer already is the data.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { getCoachSession, listCoachSessions } from "@/app/lib/coach/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

// Options builders, shared by the hooks below and by imperative reads, so both
// hit the same cache entry with the same freshness rule.
export const coachSessionsQuery = () =>
  queryOptions({
    queryKey: qk.coach.sessions(),
    queryFn: ({ signal }) => listCoachSessions(signal),
    staleTime: STALE_TIME.coach,
  });

export const coachSessionQuery = (id: string) =>
  queryOptions({
    queryKey: qk.coach.session(id),
    queryFn: ({ signal }) => getCoachSession(id, signal),
    staleTime: STALE_TIME.coach,
  });

/** The rail: this user's sessions, newest first, and today's free-reply allowance. */
export function useCoachSessions() {
  return useQuery(coachSessionsQuery());
}

/** One session's messages, oldest first. Idle while no session is open (a new chat). */
export function useCoachSession(id: string | null) {
  return useQuery({ ...coachSessionQuery(id ?? ""), enabled: id !== null });
}
