"use client";

// Every applications and goals write.
//
// The tracker is dragged, not submitted, and a card that waits for a round trip
// before it lands reads as broken. So an application write changes the cached
// list FIRST, synchronously, before its request goes out, and puts back the one
// row it changed if the request fails. Three rules keep concurrent writes
// honest:
//
//  1. A write cancels any list read in flight before touching the cache, so a
//     response that left the server before the move cannot land after it.
//  2. A failed write restores its own row, never a snapshot of the whole list,
//     so failing one move cannot undo another made while it was in flight.
//  3. Nothing is refetched until the LAST pending write settles. Refetching
//     after each would paint the server's state between two quick moves: the
//     card jumps back, then forward again.
//
// A row the browser creates carries a client id until the server answers. A
// move made in that window waits for the create and then addresses the id the
// server issued, so dragging a card you have just added never sends an id the
// backend has never seen.
//
// Goals are the other kind of write: a few numbers edited in bursts (a held
// stepper nudges the weekly target every 110 ms), so edits gather for a moment
// and go out as one PATCH, one save at a time.

import { useCallback, useEffect } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import {
  applyApplicationUpdate,
  createApplication,
  deleteApplication,
  draftApplication,
  isObjectId,
  updateApplication,
  updateGoals,
} from "@/app/lib/applications/api";
import type { ApplicationItem, CreateApplicationInput, GoalsItem, UpdateApplicationInput, UpdateGoalsInput } from "@/app/lib/applications/types";
import { qk } from "@/app/lib/query/keys";
import { refreshStreak } from "./useStreakMutations";

const listKey = () => qk.activity.applications();
const goalsKey = () => qk.activity.goals();

/** One toast for every failed move. An outage fails them all, and ten stacked toasts say nothing one does not. */
const WRITE_FAILED_TOAST = "applications-write-failed";

// ---------------------------------------------------------------------------
// Rows created in this tab
// ---------------------------------------------------------------------------

interface PendingCreate {
  promise: Promise<ApplicationItem>;
  resolve: (row: ApplicationItem) => void;
  reject: (error: unknown) => void;
}

/** Creates still in flight, by client id. */
const pendingCreates = new Map<string, PendingCreate>();

/**
 * Client id → the id the server issued, for whatever still holds the client id
 * once its create has landed: an Undo toast, a dialog left open.
 */
const serverIds = new Map<string, string>();

function trackCreate(clientId: string): void {
  let resolve!: PendingCreate["resolve"];
  let reject!: PendingCreate["reject"];
  const promise = new Promise<ApplicationItem>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Nothing may be waiting on it. A failed create is reported by its own
  // toast, not as an unhandled rejection.
  promise.catch(() => undefined);
  pendingCreates.set(clientId, { promise, resolve, reject });
}

/** A write that addressed a row whose create failed. The create's own toast has already said so. */
class CreateFailedError extends Error {
  constructor() {
    super("That application was never saved.");
    this.name = "CreateFailedError";
  }
}

/** The id the server knows a row by, waiting for its create when that is still in flight. */
async function serverIdFor(id: string): Promise<string> {
  const known = serverIds.get(id);
  if (known) return known;
  const pending = pendingCreates.get(id);
  if (!pending) return id;
  try {
    return (await pending.promise).id;
  } catch {
    throw new CreateFailedError();
  }
}

/** The id a row is cached under right now: its server id once the create has landed. */
const cachedIdFor = (id: string) => serverIds.get(id) ?? id;

/**
 * The id the server issued for a create made in this tab, once it lands; null
 * when that create failed or was never made here. For a flow with something to
 * record against the real row once it exists — the apply wizard's answer log,
 * whose route takes only a backend id. Call it after `useCreateApplication`'s
 * create, never before: until then there is no pending create to wait for.
 */
export async function createdApplicationId(clientId: string): Promise<string | null> {
  const id = await serverIdFor(clientId).catch(() => null);
  return id !== null && isObjectId(id) ? id : null;
}

// ---------------------------------------------------------------------------
// The cached list
// ---------------------------------------------------------------------------

/**
 * Applies `recipe` to the cached list, when there is one. A list still loading
 * is left alone: the write would cancel its first read, and the row arrives
 * with the read that follows every settled write anyway.
 */
function editList(queryClient: QueryClient, recipe: (rows: ApplicationItem[]) => ApplicationItem[]): void {
  if (!queryClient.getQueryData<ApplicationItem[]>(listKey())) return;
  // Setting straight after cancelling is safe: a manual set becomes the state a
  // cancelled read reverts to, so the revert cannot undo this edit.
  void queryClient.cancelQueries({ queryKey: listKey() });
  queryClient.setQueryData<ApplicationItem[]>(listKey(), (rows) => (rows ? recipe(rows) : rows));
}

/**
 * Refreshes what the server owns, once nothing is left in flight. The count
 * includes the write calling this: `onSettled` runs before a mutation leaves
 * `pending`.
 *
 * The list, the summary and the plan. The backend completes an application's
 * follow-up tasks when it is touched, moved or closed, so a plan cached before
 * the write would still offer "Follow up with …" for a follow-up already done.
 * Goals do not change when an application does, and every read spends the
 * backend's dashboard limiter, whose budget the whole site shares from the
 * frontend host's address. Only plans on screen refetch now; the rest are
 * marked stale for their next showing.
 */
function refreshAfterWrites(queryClient: QueryClient): void {
  if (queryClient.isMutating({ mutationKey: listKey() }) > 1) return;
  void queryClient.invalidateQueries({ queryKey: listKey() });
  void queryClient.invalidateQueries({ queryKey: qk.activity.summary() });
  void queryClient.invalidateQueries({ queryKey: qk.tasks.all });
  // The server records the streak's action with the write (an application
  // logged, a card moved, a follow-up touched), and pays any gift it earned.
  refreshStreak(queryClient);
}

/** Worth a Retry: the request never arrived, or the server failed. A 4xx fails the same way again. */
function isRetryable(error: unknown): boolean {
  return !(error instanceof BackendError) || error.status >= 500 || error.status === 408 || error.status === 429;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export interface CreateApplicationVars {
  /** The row's id until the server answers, and the create's idempotency key unless `input` brings its own. */
  clientId: string;
  /** Already fitted to the backend's limits: see `applicationInput`. */
  input: CreateApplicationInput;
}

/**
 * Adds a row now and saves it behind, returning at once: the log dialog's
 * payoff and the tracker's "Added to Saved" never wait on the network. A
 * failure takes the row back out and says so with Retry, which resends the same
 * idempotency key, so if the first request did land and only its answer was
 * lost, the retry returns that row instead of writing a second.
 */
export function useCreateApplication() {
  const queryClient = useQueryClient();

  const { mutate } = useMutation<ApplicationItem, unknown, CreateApplicationVars>({
    mutationKey: listKey(),
    mutationFn: async ({ clientId, input }) => {
      // A duplicate of a row logged moments ago names it by client id, which
      // the backend has never seen. Resolve it, and if that create failed, drop
      // the link rather than this application.
      const duplicateOf = input.duplicateOf ? await serverIdFor(input.duplicateOf).catch(() => null) : null;
      return createApplication({ ...input, duplicateOf, idempotencyKey: input.idempotencyKey ?? clientId });
    },
    onSuccess: (row, { clientId }) => {
      serverIds.set(clientId, row.id);
      pendingCreates.get(clientId)?.resolve(row);
      pendingCreates.delete(clientId);
      // The id only. The row keeps anything done to it while the create was in
      // flight; the read after the last write settles brings the server's copy.
      editList(queryClient, (rows) => rows.map((item) => (item.id === clientId ? { ...item, id: row.id } : item)));
    },
    onError: (error, vars) => {
      pendingCreates.get(vars.clientId)?.reject(error);
      pendingCreates.delete(vars.clientId);
      editList(queryClient, (rows) => rows.filter((item) => item.id !== vars.clientId));
      const retryable = isRetryable(error);
      toast.error(`${vars.input.company} wasn't saved`, {
        id: `application-create-${vars.clientId}`,
        description: retryable ? `${apiMessage(error)} It's off your board until it saves.` : apiMessage(error),
        // A lost application is worth a toast that waits for the user.
        duration: retryable ? Infinity : undefined,
        action: retryable ? { label: "Retry", onClick: () => create(vars) } : undefined,
      });
    },
    onSettled: () => refreshAfterWrites(queryClient),
  });

  function create(vars: CreateApplicationVars): void {
    // A second Retry while the first is still out.
    if (pendingCreates.has(vars.clientId)) return;
    editList(queryClient, (rows) =>
      rows.some((row) => row.id === vars.clientId) ? rows : [draftApplication(vars.clientId, vars.input, rows, new Date()), ...rows],
    );
    trackCreate(vars.clientId);
    mutate(vars);
  }

  return create;
}

interface UpdateApplicationVars {
  id: string;
  input: UpdateApplicationInput;
  /** The row before this write, to put back if it fails. */
  previous: ApplicationItem;
}

/**
 * Changes a row now and saves it behind. The returned function answers false,
 * sending nothing, when the row is not in the cached list: gone, or never
 * loaded. `id` may be a client id whose create has since landed.
 */
export function useUpdateApplication() {
  const queryClient = useQueryClient();

  const { mutate } = useMutation<ApplicationItem, unknown, UpdateApplicationVars>({
    mutationKey: listKey(),
    mutationFn: async ({ id, input }) => updateApplication(await serverIdFor(id), input),
    onError: (error, { id, previous }) => {
      // Back to how it was, under whichever id the row carries now.
      const rowId = cachedIdFor(id);
      editList(queryClient, (rows) => rows.map((row) => (row.id === rowId ? { ...previous, id: rowId } : row)));
      if (!(error instanceof CreateFailedError)) toast.error(apiMessage(error), { id: WRITE_FAILED_TOAST });
    },
    onSettled: () => refreshAfterWrites(queryClient),
  });

  function update(id: string, input: UpdateApplicationInput): boolean {
    const rowId = cachedIdFor(id);
    const previous = queryClient.getQueryData<ApplicationItem[]>(listKey())?.find((row) => row.id === rowId);
    if (!previous) return false;
    const now = new Date();
    editList(queryClient, (rows) => rows.map((row) => (row.id === rowId ? applyApplicationUpdate(row, input, now) : row)));
    mutate({ id: rowId, input, previous });
    return true;
  }

  return update;
}

interface DeleteApplicationVars {
  id: string;
  previous: ApplicationItem;
  /** Where the row sat in the cached list, so a failed delete puts it back in place. */
  index: number;
}

/** Removes a row now and deletes it behind. Answers false, sending nothing, when the row is not in the cached list. */
export function useDeleteApplication() {
  const queryClient = useQueryClient();

  const { mutate } = useMutation<unknown, unknown, DeleteApplicationVars>({
    mutationKey: listKey(),
    mutationFn: async ({ id }) => deleteApplication(await serverIdFor(id)),
    onError: (error, { id, previous, index }) => {
      const rowId = cachedIdFor(id);
      editList(queryClient, (rows) =>
        rows.some((row) => row.id === rowId) ? rows : [...rows.slice(0, index), { ...previous, id: rowId }, ...rows.slice(index)],
      );
      if (!(error instanceof CreateFailedError)) toast.error(apiMessage(error), { id: WRITE_FAILED_TOAST });
    },
    onSettled: () => refreshAfterWrites(queryClient),
  });

  function remove(id: string): boolean {
    const rowId = cachedIdFor(id);
    const rows = queryClient.getQueryData<ApplicationItem[]>(listKey());
    const index = rows?.findIndex((row) => row.id === rowId) ?? -1;
    if (!rows || index === -1) return false;
    editList(queryClient, (current) => current.filter((row) => row.id !== rowId));
    mutate({ id: rowId, previous: rows[index], index });
    return true;
  }

  return remove;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

/**
 * How long goal edits gather before one PATCH carries them all. A held stepper
 * nudges the weekly target every 110 ms and the number field changes on every
 * keystroke; a request per change would spend the dashboard limiter on values
 * the user has already moved past.
 */
export const GOALS_SAVE_DELAY_MS = 600;

/**
 * The edits waiting for the next save, its timer, and the goals to put back if
 * a save fails. Module state, not a ref: there is one goals row, and every
 * caller edits the same one.
 */
const goalsDraft: { pending: UpdateGoalsInput; timer: ReturnType<typeof setTimeout> | null; confirmed: GoalsItem | null } = {
  pending: {},
  timer: null,
  confirmed: null,
};

/**
 * Edits the user's goals: the cache now, the server shortly after.
 *
 * `recipe` receives the goals as cached at the moment of the call, not as of
 * some earlier render. That matters to press-and-hold, whose interval keeps
 * calling a setter captured when the hold began. It returns only the fields it
 * changes. Before goals have loaded there is nothing to show an edit against,
 * so it is sent without one and the answer fills the cache.
 *
 * Saves go out one at a time, in order, so a slow first save can never land
 * after a second. A failed save puts back the goals the server last confirmed
 * and says so.
 */
export function useUpdateGoals() {
  const queryClient = useQueryClient();

  const { mutate } = useMutation<GoalsItem, unknown, UpdateGoalsInput>({
    mutationKey: goalsKey(),
    mutationFn: updateGoals,
    scope: { id: "goals" },
    onSuccess: (goals) => {
      // Only the last save of a burst paints its answer. An earlier one would
      // paint over edits still on their way; it becomes the fallback instead.
      if (goalsDraft.timer !== null || queryClient.isMutating({ mutationKey: goalsKey() }) > 1) {
        goalsDraft.confirmed = goals;
        return;
      }
      goalsDraft.confirmed = null;
      // A first read still in flight predates this save.
      void queryClient.cancelQueries({ queryKey: goalsKey() });
      queryClient.setQueryData(goalsKey(), goals);
    },
    onError: (error) => {
      if (goalsDraft.timer !== null) clearTimeout(goalsDraft.timer);
      goalsDraft.timer = null;
      goalsDraft.pending = {};
      if (goalsDraft.confirmed) queryClient.setQueryData(goalsKey(), goalsDraft.confirmed);
      goalsDraft.confirmed = null;
      toast.error("Your goals didn't save", { id: "goals-save-failed", description: apiMessage(error) });
    },
    // The week's goal is part of the summary, and rest days and pauses decide
    // how the streak treats the days ahead.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: goalsKey() }) > 1) return;
      void queryClient.invalidateQueries({ queryKey: qk.activity.summary() });
      void queryClient.invalidateQueries({ queryKey: qk.activity.streak() });
    },
  });

  const flush = useCallback(() => {
    if (goalsDraft.timer !== null) clearTimeout(goalsDraft.timer);
    goalsDraft.timer = null;
    const patch = goalsDraft.pending;
    goalsDraft.pending = {};
    if (Object.keys(patch).length > 0) mutate(patch);
  }, [mutate]);

  // An edit still gathering when the dashboard unmounts is sent, not dropped.
  useEffect(() => flush, [flush]);

  return useCallback(
    (recipe: (current: GoalsItem | undefined) => UpdateGoalsInput) => {
      const current = queryClient.getQueryData<GoalsItem>(goalsKey());
      const patch = recipe(current);
      if (Object.keys(patch).length === 0) return;
      if (current) {
        goalsDraft.confirmed ??= current;
        void queryClient.cancelQueries({ queryKey: goalsKey() });
        queryClient.setQueryData<GoalsItem>(goalsKey(), { ...current, ...patch });
      }
      goalsDraft.pending = { ...goalsDraft.pending, ...patch };
      if (goalsDraft.timer !== null) clearTimeout(goalsDraft.timer);
      goalsDraft.timer = setTimeout(flush, GOALS_SAVE_DELAY_MS);
    },
    [queryClient, flush],
  );
}
