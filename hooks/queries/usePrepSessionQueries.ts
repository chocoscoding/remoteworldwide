"use client";

// Saved interview prep sessions (voice and typed), read through React Query.
//
// Not persisted to disk: `prep` is outside PERSISTED_DOMAINS in
// app/lib/query/keys.ts. A session holds the transcript of a recorded
// interview and the report on it, which have no business outliving the page
// on a shared machine.
//
// Progress is polled, not streamed. Holding a serverless function open for a
// minute-long analysis costs far more than a few short reads, so a session in
// flight is re-read on a timer that slows down the longer it runs, and stops
// the moment it settles.

import { queryOptions, useQuery, useQueryClient, type Query, type QueryClient } from "@tanstack/react-query";
import { getPrepSession, listPrepSessions } from "@/app/lib/voice/api";
import type { PrepSessionDetail, PrepSessionList, PrepSessionStatus } from "@/app/lib/voice/types";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

/** How often a session in flight is re-read. */
export const PREP_POLL = {
  /** At first: the typed path finishes in seconds, and the first steps of a voice one are quick. */
  fastMs: 2_000,
  /** Once a run has gone on this long it is a transcription or a report being written; nothing changes every 2 s. */
  backoffAfterMs: 30_000,
  slowMs: 5_000,
  /** A delayed analysis is retried by the service's sweep about every half hour; a minute is plenty to notice. */
  delayedMs: 60_000,
  /** A list only needs to catch a row settling, and the open report invalidates it the moment it does. */
  listMs: 10_000,
} as const;

/** The statuses whose next state is only a moment away. `delayed` is waiting too, but on a much slower clock. */
const IN_FLIGHT: ReadonlySet<PrepSessionStatus> = new Set<PrepSessionStatus>(["open", "uploading", "queued", "processing"]);

/** The session is still being saved or analysed. */
export const isInFlight = (status: PrepSessionStatus): boolean => IN_FLIGHT.has(status);

/**
 * The poll interval for a session in `status` that has been in flight for
 * `inFlightForMs`, or false to stop. Settled sessions (ready, failed,
 * deleting) are not polled.
 */
export function prepPollInterval(status: PrepSessionStatus | undefined, inFlightForMs: number): number | false {
  if (status === "delayed") return PREP_POLL.delayedMs;
  if (status === undefined || !IN_FLIGHT.has(status)) return false;
  return inFlightForMs < PREP_POLL.backoffAfterMs ? PREP_POLL.fastMs : PREP_POLL.slowMs;
}

type SessionQuery = Query<PrepSessionDetail, Error, PrepSessionDetail, ReturnType<typeof qk.prep.session>>;

/**
 * When each cached session was first seen in flight. Keyed by the cache entry
 * itself, so it lives exactly as long as the entry: returning to a report
 * whose analysis has been running for minutes resumes at the slow rate, and a
 * session that settles (or is retried after failing) starts over.
 */
const inFlightSince = new WeakMap<SessionQuery, number>();

function detailInterval(query: SessionQuery): number | false {
  const status = query.state.data?.status;
  if (status === undefined || !IN_FLIGHT.has(status)) {
    inFlightSince.delete(query);
    return prepPollInterval(status, 0);
  }
  const now = Date.now();
  const since = inFlightSince.get(query) ?? now;
  inFlightSince.set(query, since);
  return prepPollInterval(status, now - since);
}

/**
 * A list row is waiting on the service. `open` is left out: that session's
 * user is still in the interview (or gone, and the abandon sweep takes 20
 * minutes), and polling a list for that long buys nothing.
 */
const listWaiting = (list: PrepSessionList | undefined): number | false => {
  const statuses = new Set(list?.sessions.map((session) => session.status));
  if (statuses.has("uploading") || statuses.has("queued") || statuses.has("processing")) return PREP_POLL.listMs;
  return statuses.has("delayed") ? PREP_POLL.delayedMs : false;
};

// Options builders, shared by the hooks and by imperative reads
// (`queryClient.fetchQuery(prepSessionsQuery(trackId))`), so both hit the same
// cache entry with the same freshness rule.

/** This user's sessions, newest first: one track's, or every track's without `trackId`. */
export const prepSessionsQuery = (trackId?: string) =>
  queryOptions({
    queryKey: qk.prep.sessions(trackId),
    queryFn: ({ signal }) => listPrepSessions({ trackId, signal }),
    staleTime: STALE_TIME.prep,
    refetchInterval: (query) => listWaiting(query.state.data),
  });

/**
 * One session. When a read finds that a session in flight has settled, every
 * list refetches too: the hub's row and the track's preparedness score change
 * with it, and they should not wait for their own timer to notice.
 */
export const prepSessionQuery = (queryClient: QueryClient, id: string) =>
  queryOptions({
    queryKey: qk.prep.session(id),
    queryFn: async ({ signal }) => {
      const next = await getPrepSession(id, signal);
      const previous = queryClient.getQueryData<PrepSessionDetail>(qk.prep.session(id));
      if (previous && previous.status !== next.status && !isInFlight(next.status)) {
        void queryClient.invalidateQueries({ queryKey: qk.prep.sessionLists() });
      }
      return next;
    },
    staleTime: STALE_TIME.prep,
    refetchInterval: detailInterval,
  });

interface PrepSessionsOptions {
  /** One track's sessions; every track's when omitted. */
  trackId?: string;
  /** Off when the caller has nothing to look up yet. */
  enabled?: boolean;
}

/** This user's saved sessions, newest first (at most 50). Re-read while any row is being analysed. */
export function usePrepSessions({ trackId, enabled = true }: PrepSessionsOptions = {}) {
  return useQuery({ ...prepSessionsQuery(trackId), enabled });
}

interface PrepSessionOptions {
  /** Off once there is nothing to read (an id that can't be a saved session, or one just deleted). */
  enabled?: boolean;
}

/**
 * One saved session, polled while it is being saved or analysed: every 2 s at
 * first, every 5 s once it has run for 30 s, every minute while `delayed`, and
 * not at all once it is ready or failed. Another user's id is a 404, which is
 * not retried.
 */
export function usePrepSession(id: string, { enabled = true }: PrepSessionOptions = {}) {
  const queryClient = useQueryClient();
  return useQuery({ ...prepSessionQuery(queryClient, id), enabled });
}
