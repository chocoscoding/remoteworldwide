"use client";

// Every plan-task write.
//
// Ticking, editing and removing are optimistic. A plan is a checklist, and a
// box that waits a round trip before it fills reads as a missed click, so the
// cache changes first and is put back if the server says no. Adding is not
// optimistic: the server decides whether a task is new, already there under its
// dedupeKey, or refused because the plan is full, and a row that appeared and
// then vanished would be worse than one that arrives a moment later.
//
// Errors toast by default, the house style. The plan panel's add input and
// AddToPlanButton pass `{ toastErrors: false }` and show the failure inline,
// beside the thing that failed, the way the job picker does.
//
// Lists are cached per period and per status filter (`qk.tasks.list`). A write
// puts its task into every cached list it belongs in rather than refetching
// them all: the dashboard limiter's budget is shared by every user behind the
// frontend's host, and a PATCH answer already is the task. Creates and removes
// still invalidate `qk.tasks.all` once they settle, because they change what a
// list holds, and a service may have added to the plan in the meantime.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiMessage } from "@/app/lib/api/core";
import { compareTasks, createTasks, deleteTask, restoreTask, updateTask } from "@/app/lib/tasks/api";
import { TASK_STATUSES, type AddTasksResult, type CreateTasksBody, type TaskItem, type UpdateTaskInput } from "@/app/lib/tasks/types";
import { qk } from "@/app/lib/query/keys";

export interface TaskWriteOptions {
  /** Report a failure with a toast. Turn it off wherever the error is shown inline. */
  toastErrors?: boolean;
}

const reportWith = (toastErrors: boolean) => (error: unknown) => {
  if (toastErrors) toast.error(apiMessage(error));
};

// ---------------------------------------------------------------------------
// The cache
// ---------------------------------------------------------------------------

/** Every list a task can be cached under within its period: the unfiltered one, and one per status. */
const LIST_FILTERS = [undefined, ...TASK_STATUSES] as const;

/** `list` with `task` where the server's order will put it. */
function insertInOrder(list: readonly TaskItem[], task: TaskItem): TaskItem[] {
  const index = list.findIndex((other) => compareTasks(task, other) < 0);
  return index === -1 ? [...list, task] : [...list.slice(0, index), task, ...list.slice(index)];
}

/**
 * Write one task into every cached list of its period, as its status says:
 * replaced in place where it already is (a ticked row keeps its slot until the
 * next fetch re-sorts), inserted in order where it now belongs, and dropped
 * from a status-filtered list it has left. Lists nobody fetched stay unfetched.
 */
function storeTask(queryClient: QueryClient, task: TaskItem) {
  for (const status of LIST_FILTERS) {
    queryClient.setQueryData<TaskItem[]>(qk.tasks.list(task.period, status), (list) => {
      if (!list) return list;
      const belongs = status === undefined || status === task.status;
      const index = list.findIndex((other) => other.id === task.id);
      if (index === -1) return belongs ? insertInOrder(list, task) : list;
      if (!belongs) return list.filter((other) => other.id !== task.id);
      const next = list.slice();
      next[index] = task;
      return next;
    });
  }
}

function dropTask(queryClient: QueryClient, id: string) {
  queryClient.setQueriesData<TaskItem[]>({ queryKey: qk.tasks.all }, (list) =>
    list?.some((task) => task.id === id) ? list.filter((task) => task.id !== id) : list,
  );
}

function findTask(queryClient: QueryClient, id: string): TaskItem | undefined {
  for (const [, list] of queryClient.getQueriesData<TaskItem[]>({ queryKey: qk.tasks.all })) {
    const hit = list?.find((task) => task.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** The change the server is about to make, made first. */
function applyUpdate(task: TaskItem, input: UpdateTaskInput): TaskItem {
  const next: TaskItem = { ...task, updatedAt: new Date() };
  if (input.title !== undefined) next.title = input.title;
  if (input.detail !== undefined) next.detail = input.detail;
  if (input.href !== undefined) next.href = input.href;
  if (input.priority !== undefined) next.priority = input.priority;
  if (input.dueAt !== undefined) next.dueAt = input.dueAt;
  if (input.status !== undefined && input.status !== task.status) {
    next.status = input.status;
    // Done stamps completedAt and reopening clears it, as TaskService does;
    // dismissing leaves it as it was.
    if (input.status === "done") next.completedAt = new Date();
    if (input.status === "open") next.completedAt = null;
  }
  if (input.seen && next.seenAt === null) next.seenAt = new Date().toISOString();
  return next;
}

// ---------------------------------------------------------------------------
// Overlapping writes
// ---------------------------------------------------------------------------

// The newest write per task id. Two quick ticks on one row send two PATCHes
// whose answers can land in either order, so only the answer to the newest
// write may enter the cache, and the row never flickers back to what the first
// tick said. Module-level because the rail and a card can both write the same
// task, and neither hook instance knows about the other.
const latestWrite = new Map<string, number>();
let writeSeq = 0;

interface WriteContext {
  /** The task as the cache held it just before this write, for the rollback. */
  previous: TaskItem | undefined;
  seq: number;
  /** A list was mid-fetch when this write cancelled it, so the lists refetch once the write settles. */
  interrupted: boolean;
}

async function beginWrite(queryClient: QueryClient, id: string): Promise<WriteContext> {
  const seq = ++writeSeq;
  latestWrite.set(id, seq);
  const interrupted = queryClient.isFetching({ queryKey: qk.tasks.all }) > 0;
  // A fetch already in flight would land on top of the optimistic change. Only
  // lists that hold data are cancelled: cancelling a first load leaves it
  // pending with nothing fetching, and its panel would sit on skeleton rows.
  await queryClient.cancelQueries({ queryKey: qk.tasks.all, predicate: (query) => query.state.data !== undefined });
  return { previous: findTask(queryClient, id), seq, interrupted };
}

const isLatest = (id: string, context: WriteContext | undefined) => context !== undefined && latestWrite.get(id) === context.seq;

/**
 * Only the newest write may put a row back. An older write failing under a
 * newer optimistic change would otherwise undo the change the user made last;
 * the refetch that follows every failure settles what the server really holds.
 */
function rollback(queryClient: QueryClient, id: string, context: WriteContext | undefined) {
  if (isLatest(id, context) && context?.previous) storeTask(queryClient, context.previous);
}

function settleWrite(queryClient: QueryClient, id: string, context: WriteContext | undefined, failed: boolean, refetch = false) {
  if (isLatest(id, context)) latestWrite.delete(id);
  if (refetch || failed || context?.interrupted) void queryClient.invalidateQueries({ queryKey: qk.tasks.all });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Add one task (`{ task }`) or a batch (`{ tasks }`). Resolves with the whole
 * `AddTasksResult`: a full plan is a `plan-full` rejection inside a 2xx, not a
 * thrown error, so read `rejected`. Created and existing tasks go straight
 * into the cached lists, so "Add to plan" and the panel agree the moment the
 * answer lands.
 */
export function useCreateTasks({ toastErrors = true }: TaskWriteOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation<AddTasksResult, unknown, CreateTasksBody>({
    mutationFn: createTasks,
    onSuccess: (result) => {
      for (const task of [...result.created, ...result.existing]) storeTask(queryClient, task);
    },
    onError: reportWith(toastErrors),
    // Not returned: a returned promise would hold `isPending` until the refetch
    // finished, and the add input would stay locked for a second round trip.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tasks.all });
    },
  });
}

/** The shape every optimistic PATCH shares: apply, send, keep only the newest answer, roll back on failure. */
function useOptimisticUpdate<V>(toRequest: (vars: V) => { id: string; input: UpdateTaskInput }, { toastErrors = true }: TaskWriteOptions) {
  const queryClient = useQueryClient();
  return useMutation<TaskItem, unknown, V, WriteContext>({
    mutationFn: (vars) => {
      const { id, input } = toRequest(vars);
      return updateTask(id, input);
    },
    onMutate: async (vars) => {
      const { id, input } = toRequest(vars);
      const context = await beginWrite(queryClient, id);
      if (context.previous) storeTask(queryClient, applyUpdate(context.previous, input));
      return context;
    },
    onSuccess: (task, vars, context) => {
      if (isLatest(toRequest(vars).id, context)) storeTask(queryClient, task);
    },
    onError: (error, vars, context) => {
      rollback(queryClient, toRequest(vars).id, context);
      reportWith(toastErrors)(error);
    },
    onSettled: (_task, error, vars, context) => settleWrite(queryClient, toRequest(vars).id, context, error !== null),
  });
}

/** Edit a task: title, detail, link, priority, due date or status. Optimistic, with rollback. */
export const useUpdateTask = (options: TaskWriteOptions = {}) =>
  useOptimisticUpdate<{ id: string; input: UpdateTaskInput }>((vars) => vars, options);

/**
 * Tick or untick a task: open becomes done, and done becomes open. Pass the
 * task as it is rendered, optimistic state included, so a second tick undoes
 * the first rather than repeating it.
 */
export const useToggleTask = (options: TaskWriteOptions = {}) =>
  useOptimisticUpdate<TaskItem>((task) => ({ id: task.id, input: { status: task.status === "done" ? "open" : "done" } }), options);

export interface DeleteTaskOptions extends TaskWriteOptions {
  /**
   * Called once the server has removed the task, with the task as it was, for
   * an Undo. Hook-level rather than a per-call `onSuccess`, because TanStack
   * runs per-call callbacks only for the latest `mutate`, and two quick
   * removals would leave the first one without its Undo.
   */
  onRemoved?: (task: TaskItem) => void;
}

/**
 * Take a task off the plan. What that means on the server depends on who added
 * it (see `deleteTask`); either way the row leaves every list at once, and
 * comes back if the server refuses.
 */
export function useDeleteTask({ toastErrors = true, onRemoved }: DeleteTaskOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, string, WriteContext>({
    mutationFn: deleteTask,
    onMutate: async (id) => {
      const context = await beginWrite(queryClient, id);
      dropTask(queryClient, id);
      return context;
    },
    onSuccess: (_result, _id, context) => {
      if (context?.previous) onRemoved?.(context.previous);
    },
    onError: (error, id, context) => {
      rollback(queryClient, id, context);
      reportWith(toastErrors)(error);
    },
    onSettled: (_result, error, id, context) => settleWrite(queryClient, id, context, error !== null, true),
  });
}

/**
 * Put back a task the user just removed (see `restoreTask`). Not optimistic: a
 * task the user wrote comes back under a new id, which only the server knows.
 */
export function useRestoreTask({ toastErrors = true }: TaskWriteOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation<TaskItem, unknown, TaskItem>({
    mutationFn: restoreTask,
    onSuccess: (task) => storeTask(queryClient, task),
    onError: reportWith(toastErrors),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tasks.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Seen
// ---------------------------------------------------------------------------

/** How long shown tasks gather before their seen marks go out. A panel's first paint shows them all at once. */
const SEEN_BATCH_MS = 1_500;
/** Seen PATCHes in flight at once. There is no batch endpoint, and they spend the dashboard limiter's shared budget. */
const SEEN_CONCURRENCY = 3;

// One queue for the page rather than one per panel: the rail and a card showing
// the same new task send one mark between them, and a panel that unmounts
// inside the window (navigating away straight after a glance) still sends what
// it showed.
const seenQueued = new Set<string>();
/** Queued or sent during this page load. A failed mark is taken back out, so the next showing tries again. */
const seenClaimed = new Set<string>();
let seenTimer: ReturnType<typeof setTimeout> | null = null;

async function flushSeen() {
  seenTimer = null;
  const ids = [...seenQueued];
  seenQueued.clear();
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        await updateTask(id, { seen: true });
      } catch {
        seenClaimed.delete(id);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SEEN_CONCURRENCY, ids.length) }, worker));
}

function markTasksSeen(ids: readonly string[]) {
  for (const id of ids) {
    if (seenClaimed.has(id)) continue;
    seenClaimed.add(id);
    seenQueued.add(id);
  }
  if (seenQueued.size > 0 && seenTimer === null) seenTimer = setTimeout(() => void flushSeen(), SEEN_BATCH_MS);
}

/**
 * Mark tasks a service added as seen once they have been shown, in batches.
 * Returns a stable function; pass it the ids of the rows on screen whose
 * `seenAt` is null.
 *
 * The cache is deliberately left alone. Writing `seenAt` into it would take the
 * "New" marker away the instant it rendered, the one moment it exists for. The
 * marker stays until the list next refetches (the window regaining focus, a
 * create or a remove, the next visit), and by then the server already knows.
 *
 * Silent on failure, like marking notifications read: nobody asked for it.
 */
export function useMarkTasksSeen(): (ids: readonly string[]) => void {
  return markTasksSeen;
}
