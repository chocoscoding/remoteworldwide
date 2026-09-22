"use client";

// Interview prep tracks (backend) and each track's likely questions (AI
// service), read through React Query.
//
// Not persisted to disk: `prep` is outside PERSISTED_DOMAINS in
// app/lib/query/keys.ts. A track names the companies someone is interviewing
// with, its posting and its notes; none of that belongs on a shared machine.
//
// One list, `qk.prep.tracks()`, feeds the index, the hub, setup, the live
// screen and the report header, so an edit on one screen is on all of them.
// Every track write in hooks/mutations/usePrepTrackMutations.ts puts its
// answer straight into that list.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { getLikelyQuestions, getPrepTrack, listPrepTracks } from "@/app/lib/prep/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

export const prepTracksQuery = () =>
  queryOptions({
    queryKey: qk.prep.tracks(),
    queryFn: ({ signal }) => listPrepTracks(signal),
    staleTime: STALE_TIME.prep,
  });

/** Every saved track, most recently touched first, each with its plan tasks. */
export function usePrepTracks() {
  return useQuery(prepTracksQuery());
}

/** One track with its pasted posting, for the details editor. Idle until it is opened. */
export function usePrepTrackDetail(id: string | null) {
  return useQuery({
    queryKey: qk.prep.track(id ?? ""),
    queryFn: ({ signal }) => getPrepTrack(id ?? "", signal),
    staleTime: STALE_TIME.prep,
    enabled: id !== null,
  });
}

/**
 * The track's stored likely questions, whether they are stale, and what a new
 * set costs. Reading is free; writing a set is `useGenerateLikelyQuestions`,
 * and only ever runs from a click.
 */
export function useLikelyQuestions(trackId: string | null) {
  return useQuery({
    queryKey: qk.prep.questions(trackId ?? ""),
    queryFn: ({ signal }) => getLikelyQuestions(trackId ?? "", signal),
    staleTime: STALE_TIME.prep,
    enabled: trackId !== null,
  });
}
