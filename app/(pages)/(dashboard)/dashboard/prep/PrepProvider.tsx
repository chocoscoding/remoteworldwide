"use client";

// Interview Prep — route-scoped state.
//
// Real routes back this feature (list -> /prep/[trackId] -> setup/live -> a
// session report at /prep/[trackId]/sessions/[sessionId]), and every one of
// them reads the same tracks. This provider is mounted by prep/layout.tsx —
// scoped to the /dashboard/prep/** tree only, not lifted to DashboardShell,
// since nothing outside this feature reads it.
//
// Everything here is real now:
//  - Tracks are the user's own, saved in the backend (/api/prep-tracks) and
//    read through one cached list (`usePrepTracks`). Each carries its plan
//    tasks, which are the track's checklist.
//  - Sessions are the AI service's saved interviews, graded there. Scored ones
//    are merged into their track's `sessions` on the way out, because the
//    preparedness score averages them; the hub lists the rest from its own
//    per-track read.
//  - A round's outcome writes through to the tracker application the track
//    belongs to, through the tracker's own moves, so an offer here lands in
//    Offer on the board with the same toast and rewards a drag would give.
//
// Nothing is scored in the browser and nothing is seeded: a user with no
// tracks sees no tracks.

import { createContext, useCallback, useContext, useMemo, type FC, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTracker } from "@/app/components/dashboard/tracker/TrackerProvider";
import { updateApplication as patchApplication } from "@/app/lib/applications/api";
import type { ApplicationItem, UpdateApplicationInput } from "@/app/lib/applications/types";
import { BackendError } from "@/app/lib/api/core";
import type { PrepTrack } from "@/app/lib/dashboard/prep-data";
import { applicationStatusFor, roundInputs, toPrepTrack, withOutcome } from "@/app/lib/prep/tracks";
import type { CreatePrepTrackInput, PrepRoundInput, PrepRoundOutcome, PrepTrackItem, PrepTrackerChange, UpdatePrepTrackInput } from "@/app/lib/prep/types";
import type { AddTasksResult } from "@/app/lib/tasks/types";
import { qk } from "@/app/lib/query/keys";
import { mergeServerSessions } from "@/app/lib/voice/mapSession";
import { applicationsQuery, useApplications } from "@/hooks/queries/useApplicationsQuery";
import { usePrepSessions } from "@/hooks/queries/usePrepSessionQueries";
import { usePrepTracks } from "@/hooks/queries/usePrepTrackQueries";
import { useUpdateApplication } from "@/hooks/mutations/useApplicationMutations";
import {
  useAddPrepAction,
  useCreatePrepTrack,
  useDeletePrepTrack,
  useTogglePrepAction,
  useUpdatePrepTrack,
} from "@/hooks/mutations/usePrepTrackMutations";

export type PrepTracksStatus = "loading" | "error" | "ready";

/** A track just added, or the one the job already had, and what the add did to the tracker. */
export interface AddedTrack {
  track: PrepTrack;
  alreadyTracked: boolean;
  tracker: PrepTrackerChange;
}

interface PrepContextValue {
  tracks: PrepTrack[];
  /** "loading" until the first read lands; "error" when it failed with nothing cached to show. */
  status: PrepTracksStatus;
  error: unknown;
  retry: () => void;
  getTrack: (id: string) => PrepTrack | undefined;
  /**
   * Creates a saved track — which also puts its job at interviewing on the
   * tracker — or finds the one the job already has. Rejects with the server's refusal.
   */
  addTrack: (input: CreatePrepTrackInput) => Promise<AddedTrack>;
  updateTrack: (id: string, input: UpdatePrepTrackInput) => Promise<void>;
  deleteTrack: (id: string) => Promise<void>;
  /** Ticks or unticks one of the track's actions, on the plan. */
  toggleAction: (trackId: string, actionId: string) => void;
  /** Adds an action of the user's own to the track, and so to this month's plan. */
  addAction: (trackId: string, title: string) => Promise<AddTasksResult>;
  /**
   * Replaces the track's rounds in one write. `changed` names the round (by
   * position) whose outcome the user just set, so the linked application moves
   * to match once the write lands.
   */
  saveRounds: (trackId: string, rounds: PrepRoundInput[], changed?: { index: number; outcome: PrepRoundOutcome | null }) => Promise<void>;
  /** Records how a round went, and moves the linked application to match. */
  setRoundOutcome: (trackId: string, roundId: string, outcome: PrepRoundOutcome | null) => Promise<void>;
}

const PrepContext = createContext<PrepContextValue | null>(null);

const NO_TRACKS: PrepTrackItem[] = [];

export const PrepProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const tracksQuery = usePrepTracks();
  const items = tracksQuery.data ?? NO_TRACKS;

  // Every track's saved sessions in one read (the service's newest 50). Only
  // scored ones join a track here, because the preparedness score averages
  // them. A failed read leaves the tracks without sessions, never without tracks.
  const { data: saved } = usePrepSessions();
  const savedSessions = saved?.sessions;
  const tracks = useMemo(
    () =>
      items.map((item) => {
        const track = toPrepTrack(item);
        if (!savedSessions || savedSessions.length === 0) return track;
        return { ...track, sessions: mergeServerSessions(track, savedSessions) };
      }),
    [items, savedSessions]
  );

  const status: PrepTracksStatus = tracksQuery.data !== undefined ? "ready" : tracksQuery.isError ? "error" : "loading";

  const createTrack = useCreatePrepTrack();
  const { mutateAsync: patchTrack } = useUpdatePrepTrack();
  const removeTrack = useDeletePrepTrack();
  const { mutate: toggleTask } = useTogglePrepAction();
  const { mutateAsync: addTask } = useAddPrepAction();

  const tracker = useTracker();
  const applications = useApplications();
  const updateApplication = useUpdateApplication();

  function getTrack(id: string) {
    return tracks.find((t) => t.id === id);
  }

  async function addTrack(input: CreatePrepTrackInput): Promise<AddedTrack> {
    const { alreadyTracked, tracker, ...item } = await createTrack.mutateAsync(input);
    return { track: toPrepTrack(item), alreadyTracked, tracker };
  }

  async function updateTrack(id: string, input: UpdatePrepTrackInput): Promise<void> {
    await patchTrack({ id, input });
  }

  async function deleteTrack(id: string): Promise<void> {
    await removeTrack.mutateAsync(id);
  }

  function toggleAction(trackId: string, actionId: string) {
    const task = items.find((t) => t.id === trackId)?.actions.find((a) => a.id === actionId);
    if (task) toggleTask({ trackId, task });
  }

  function addAction(trackId: string, title: string) {
    return addTask({ trackId, title });
  }

  /**
   * The tracker application a track belongs to, moved to match a round's
   * outcome: an offer or a rejection becomes its outcome, a live loop puts it
   * in interviewing, and `roundsReached` climbs to the round that just
   * happened. Through the tracker's own moves when the board holds the row, so
   * rewards, toasts and Undo fire as they would for a drag; straight to the
   * API when it does not (the board has not loaded yet).
   */
  const syncApplication = useCallback(
    async (applicationId: string, reached: number, outcome: PrepRoundOutcome) => {
      const current = tracker.statusOf(applicationId);
      if (current !== null) {
        const to = applicationStatusFor(outcome, current);
        if (to) tracker.setStatus(applicationId, to);
        const row = applications.data?.find((item) => item.id === applicationId);
        if ((row?.roundsReached ?? 0) < reached) updateApplication(applicationId, { roundsReached: reached });
        return;
      }

      let row: ApplicationItem | undefined;
      try {
        row = (await queryClient.fetchQuery(applicationsQuery())).find((item) => item.id === applicationId);
      } catch {
        return;
      }
      // Deleted from the tracker since the track was linked: nothing to move.
      if (!row) return;
      const input: UpdateApplicationInput = {};
      const to = applicationStatusFor(outcome, row.status);
      if (to) input.status = to;
      if ((row.roundsReached ?? 0) < reached) input.roundsReached = reached;
      if (Object.keys(input).length === 0) return;
      try {
        await patchApplication(applicationId, input);
      } catch (error) {
        if (!(error instanceof BackendError && error.status === 404)) throw error;
      } finally {
        void queryClient.invalidateQueries({ queryKey: qk.activity.applications() });
        void queryClient.invalidateQueries({ queryKey: qk.activity.summary() });
      }
    },
    [tracker, applications.data, updateApplication, queryClient]
  );

  async function saveRounds(trackId: string, rounds: PrepRoundInput[], changed?: { index: number; outcome: PrepRoundOutcome | null }): Promise<void> {
    const item = items.find((t) => t.id === trackId);
    if (!item) return;
    await patchTrack({ id: trackId, input: { rounds } });
    // How far the loop got is the round that just happened: its position, counted from one.
    if (item.applicationId && changed && changed.outcome !== null) await syncApplication(item.applicationId, changed.index + 1, changed.outcome);
  }

  async function setRoundOutcome(trackId: string, roundId: string, outcome: PrepRoundOutcome | null): Promise<void> {
    const item = items.find((t) => t.id === trackId);
    const index = item?.rounds.findIndex((round) => round.id === roundId) ?? -1;
    if (!item || index === -1) return;
    await saveRounds(trackId, roundInputs(withOutcome(item.rounds, roundId, outcome)), { index, outcome });
  }

  const retry = () => void tracksQuery.refetch();

  return (
    <PrepContext.Provider
      value={{ tracks, status, error: tracksQuery.error, retry, getTrack, addTrack, updateTrack, deleteTrack, toggleAction, addAction, saveRounds, setRoundOutcome }}>
      {children}
    </PrepContext.Provider>
  );
};

export function usePrep(): PrepContextValue {
  const ctx = useContext(PrepContext);
  if (!ctx) throw new Error("usePrep must be used within PrepProvider");
  return ctx;
}
