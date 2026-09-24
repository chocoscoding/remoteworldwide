"use client";

// Every prep track write, and the writes a track makes on the plan.
//
// Track edits are optimistic: an outcome picked or a round added should show
// at once, and the answer — which is the whole track as stored — replaces the
// optimistic copy when it lands. Creating is not: the server decides whether a
// track may be made (one per application, a per-account cap), and a row that
// appeared and vanished would be worse than one that arrives a moment later.
//
// A track's checklist is plan tasks, so ticking one is a PATCH /api/tasks/:id
// and adding one a POST /api/tasks with source kind "prep". Both write through
// the tracks list first, then refresh the plan's own lists behind.
//
// Adding a track also moves its job on the tracker (the server puts it at
// interviewing), so a create refreshes what the tracker's own writes refresh.
//
// Errors are thrown to the caller, which shows them where they happened.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { BackendError } from "@/app/lib/api/core";
import { createPrepTrack, deletePrepTrack, generateLikelyQuestions, updatePrepTrack } from "@/app/lib/prep/api";
import { trackHref } from "@/app/lib/prep/tracks";
import type {
  CreatePrepTrackInput,
  LikelyQuestionsResult,
  LikelyQuestionsState,
  PrepRound,
  PrepTrackCreated,
  PrepTrackItem,
  UpdatePrepTrackInput,
} from "@/app/lib/prep/types";
import { createTasks, updateTask } from "@/app/lib/tasks/api";
import { TASK_LIMITS, periodOf, type AddTasksResult, type TaskItem } from "@/app/lib/tasks/types";
import { qk } from "@/app/lib/query/keys";
import { storeBalance } from "./useAskJob";
import { refreshStreak } from "./useStreakMutations";

const tracksKey = () => qk.prep.tracks();

function editTracks(queryClient: QueryClient, recipe: (tracks: PrepTrackItem[]) => PrepTrackItem[]) {
  queryClient.setQueryData<PrepTrackItem[]>(tracksKey(), (tracks) => (tracks ? recipe(tracks) : tracks));
}

/** The server's answer in place of whatever the list held for it, newest touched first. */
function storeTrack(queryClient: QueryClient, track: PrepTrackItem) {
  editTracks(queryClient, (tracks) => [track, ...tracks.filter((other) => other.id !== track.id)]);
}

let tempSeq = 0;

/** The change the server is about to make, made first. A new round gets a stand-in id until the answer brings its own. */
function applyUpdate(track: PrepTrackItem, input: UpdatePrepTrackInput): PrepTrackItem {
  const next: PrepTrackItem = { ...track, updatedAt: new Date() };
  if (input.company !== undefined) next.company = input.company.trim();
  if (input.role !== undefined) next.role = input.role.trim();
  if (input.location !== undefined) next.location = input.location?.trim() || null;
  if (input.applicationId !== undefined) next.applicationId = input.applicationId || null;
  // The new job's logo comes with the server's answer; until then no logo is
  // right, where the old company's is actively wrong.
  if (input.savedJobId !== undefined) {
    next.savedJobId = input.savedJobId || null;
    next.companyLogo = null;
  }
  if (input.jobDescription !== undefined) next.hasJobDescription = Boolean(input.jobDescription?.trim());
  // The default is the server's to work out, so it stays as it was until the answer lands.
  if (input.resumeId !== undefined) next.resumeId = input.resumeId?.toLowerCase() || null;
  if (input.rounds !== undefined) {
    next.rounds = input.rounds.map(
      (round): PrepRound => ({
        id: round.id ?? `pending-${++tempSeq}`,
        type: round.type,
        scheduledAt: round.scheduledAt ?? null,
        outcome: round.outcome ?? null,
        notes: round.notes?.trim() ?? "",
      })
    );
  }
  return next;
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

/** The list item inside a create's answer, without the two fields that describe the add. */
function itemOf(created: PrepTrackCreated): PrepTrackItem {
  const track: PrepTrackItem & Partial<Pick<PrepTrackCreated, "alreadyTracked" | "tracker">> = { ...created };
  delete track.alreadyTracked;
  delete track.tracker;
  return track;
}

/**
 * What the tracker's own writes refresh (`refreshAfterWrites` in
 * useApplicationMutations): the board, the funnel, the plan — a move completes
 * the application's follow-up task — and the streak, whose action and gift the
 * server recorded with the move. Skipped while a board write is still in
 * flight: its refresh runs when the last one settles, which is after this, and
 * one now would paint the server's board between two of the user's moves.
 */
function refreshTracker(queryClient: QueryClient) {
  if (queryClient.isMutating({ mutationKey: qk.activity.applications() }) > 0) return;
  void queryClient.invalidateQueries({ queryKey: qk.activity.applications() });
  void queryClient.invalidateQueries({ queryKey: qk.activity.summary() });
  void queryClient.invalidateQueries({ queryKey: qk.tasks.all });
  refreshStreak(queryClient);
}

/**
 * A new track, or — when the job already has one — that track, which is
 * stored the same way. The tracker is refreshed whenever the add named a job,
 * failed or not: the server places the application before it writes the
 * track, so a failed track can still have moved a card.
 */
export function useCreatePrepTrack() {
  const queryClient = useQueryClient();
  return useMutation<PrepTrackCreated, unknown, CreatePrepTrackInput>({
    mutationFn: createPrepTrack,
    onSuccess: (created) => storeTrack(queryClient, itemOf(created)),
    onSettled: (_created, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: tracksKey() });
      if (input.applicationId || input.savedJobId) refreshTracker(queryClient);
    },
  });
}

interface UpdateVars {
  id: string;
  input: UpdatePrepTrackInput;
}

interface UpdateContext {
  previous: PrepTrackItem | undefined;
}

export function useUpdatePrepTrack() {
  const queryClient = useQueryClient();
  return useMutation<PrepTrackItem, unknown, UpdateVars, UpdateContext>({
    mutationFn: ({ id, input }) => updatePrepTrack(id, input),
    onMutate: async ({ id, input }) => {
      // A fetch already in flight would land on top of the optimistic change.
      await queryClient.cancelQueries({ queryKey: tracksKey() });
      const previous = queryClient.getQueryData<PrepTrackItem[]>(tracksKey())?.find((track) => track.id === id);
      if (previous) storeTrack(queryClient, applyUpdate(previous, input));
      return { previous };
    },
    onSuccess: (track) => storeTrack(queryClient, track),
    onError: (_error, _vars, context) => {
      if (context?.previous) storeTrack(queryClient, context.previous);
    },
    onSettled: (_track, _error, { id, input }) => {
      void queryClient.invalidateQueries({ queryKey: qk.prep.track(id) });
      // A new posting (or none), or a different resume for the track — its own,
      // or the one a newly linked application was sent with — is what makes a
      // written set stale.
      if (input.jobDescription !== undefined || input.savedJobId !== undefined || input.resumeId !== undefined || input.applicationId !== undefined) {
        void queryClient.invalidateQueries({ queryKey: qk.prep.questions(id) });
      }
    },
  });
}

export function useDeletePrepTrack() {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, string>({
    mutationFn: async (id) => {
      try {
        return await deletePrepTrack(id);
      } catch (error) {
        // Already gone is what was asked for.
        if (error instanceof BackendError && error.status === 404) return null;
        throw error;
      }
    },
    onSuccess: (_result, id) => {
      editTracks(queryClient, (tracks) => tracks.filter((track) => track.id !== id));
      queryClient.removeQueries({ queryKey: qk.prep.track(id) });
      queryClient.removeQueries({ queryKey: qk.prep.questions(id) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: tracksKey() });
    },
  });
}

// ---------------------------------------------------------------------------
// The track's checklist — plan tasks
// ---------------------------------------------------------------------------

function editAction(queryClient: QueryClient, trackId: string, taskId: string, recipe: (task: TaskItem) => TaskItem) {
  editTracks(queryClient, (tracks) =>
    tracks.map((track) => (track.id === trackId ? { ...track, actions: track.actions.map((task) => (task.id === taskId ? recipe(task) : task)) } : track))
  );
}

interface ToggleVars {
  trackId: string;
  /** As rendered, optimistic state included, so a second tick undoes the first. */
  task: TaskItem;
}

/** Tick or untick one of the track's actions — on the plan, where it lives. */
export function useTogglePrepAction() {
  const queryClient = useQueryClient();
  return useMutation<TaskItem, unknown, ToggleVars, { previous: TaskItem }>({
    mutationFn: ({ task }) => updateTask(task.id, { status: task.status === "done" ? "open" : "done" }),
    onMutate: async ({ trackId, task }) => {
      await queryClient.cancelQueries({ queryKey: tracksKey() });
      const done = task.status !== "done";
      editAction(queryClient, trackId, task.id, (current) => ({ ...current, status: done ? "done" : "open", completedAt: done ? new Date() : null }));
      return { previous: task };
    },
    onSuccess: (task, { trackId }) => editAction(queryClient, trackId, task.id, () => task),
    onError: (_error, { trackId, task }, context) => editAction(queryClient, trackId, task.id, () => context?.previous ?? task),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tasks.all });
    },
  });
}

interface AddActionVars {
  trackId: string;
  title: string;
}

/**
 * Put an action of the user's own on the track, which puts it on this month's
 * plan. A full plan answers with a `plan-full` rejection inside a 2xx, so the
 * caller reads `rejected`.
 */
export function useAddPrepAction() {
  const queryClient = useQueryClient();
  return useMutation<AddTasksResult, unknown, AddActionVars>({
    mutationFn: ({ trackId, title }) =>
      createTasks({
        task: {
          title: title.trim().slice(0, TASK_LIMITS.titleMax),
          href: trackHref(trackId),
          period: periodOf(new Date()),
          metadata: { trackId },
        },
        source: { kind: "prep", ref: trackId },
      }),
    onSuccess: (result, { trackId }) => {
      const added = [...result.created, ...result.existing];
      if (added.length > 0) {
        editTracks(queryClient, (tracks) =>
          tracks.map((track) => (track.id === trackId ? { ...track, actions: [...added, ...track.actions.filter((task) => !added.some((a) => a.id === task.id))] } : track))
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tasks.all });
      void queryClient.invalidateQueries({ queryKey: tracksKey() });
    },
  });
}

// ---------------------------------------------------------------------------
// Likely questions
// ---------------------------------------------------------------------------

interface GenerateVars {
  trackId: string;
  refresh?: boolean;
}

/**
 * Write the track's likely questions (or, without `refresh`, get back the set
 * already written from the same posting and resume, free). The answer goes
 * straight into the questions cache; a charge refreshes the sidebar's balance.
 */
export function useGenerateLikelyQuestions() {
  const queryClient = useQueryClient();
  return useMutation<LikelyQuestionsResult, unknown, GenerateVars>({
    mutationFn: ({ trackId, refresh }) => generateLikelyQuestions(trackId, { refresh: refresh === true }),
    onSuccess: (result, { trackId }) => {
      const state: LikelyQuestionsState = { set: result.set, stale: result.stale, cost: result.cost };
      queryClient.setQueryData(qk.prep.questions(trackId), state);
      if (result.charged) storeBalance(queryClient, result.credits);
    },
    onError: (error) => {
      // A refusal means the balance the sidebar shows is out of date.
      if (error instanceof BackendError && error.status === 402) storeBalance(queryClient, null);
    },
  });
}
