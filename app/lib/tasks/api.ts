// Browser-side calls for the user's plan: list, add, update and remove tasks.
//
// Every path is relative and goes through the `/api/tasks/:path*` rewrite in
// `next.config.mjs`, so the Auth.js cookie rides along first-party and the
// backend's session guard sees the user. Nothing here reads the session or
// sends a token, which also makes this module browser-only, exactly like
// `app/lib/api/client.ts` beneath it.
//
// Plain functions rather than hooks, so a screen can run a short flow (add a
// task, then reopen the one that came back dismissed) without threading
// mutation objects through it. `hooks/queries/useTasksQuery.ts` and
// `hooks/mutations/useTaskMutations.ts` wrap them for caching.

import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/lib/api/client";
import type {
  AddTasksResult,
  CreateTasksBody,
  ListTasksQuery,
  TaskItem,
  TaskSourceKind,
  TaskStatus,
  UpdateTaskInput,
  UserRouteSourceKind,
} from "./types";

export const TASKS_PATH = "/api/tasks";

// Ids go into the path, so they are encoded. An id is only ever an ObjectId
// from our own responses, but a "../" reaching here through a bad caller would
// otherwise address a different route behind the same rewrite.
const at = (id: string) => `${TASKS_PATH}/${encodeURIComponent(id)}`;

/**
 * A period's tasks, in the server's order (see `compareTasks`). Without a
 * `status` the answer can include dismissed tasks, so every reader that shows
 * "the plan" filters them out with `isOnPlan`.
 */
export function listTasks(query: ListTasksQuery = {}, signal?: AbortSignal) {
  const search = new URLSearchParams();
  if (query.period) search.set("period", query.period);
  if (query.status) search.set("status", query.status);
  const qs = search.toString();
  return apiGet<TaskItem[]>(qs ? `${TASKS_PATH}?${qs}` : TASKS_PATH, signal);
}

/**
 * One task (`{ task }`) or a batch (`{ tasks }`). Partial success, per item:
 * the answer is 201 when anything was created and 200 when nothing was, and in
 * both cases carries `created`, `existing` (a task with the same dedupeKey, in
 * any status) and `rejected` (each with its index and the backend's sentence).
 * A plan past its open-task cap is a `plan-full` rejection inside a 2xx, not an
 * error, so callers must read `rejected` rather than wait for a throw.
 *
 * Always pass `period`. The backend defaults to the current UTC month, while
 * the plan panel shows the user's local month (`periodOf`), and for a few hours
 * either side of midnight on the last day of a month those are different plans.
 */
export function createTasks(body: CreateTasksBody) {
  return apiPost<AddTasksResult>(TASKS_PATH, body);
}

/** Another user's id is a 404, never a 403, so ids cannot be probed. */
export function updateTask(id: string, input: UpdateTaskInput) {
  return apiPatch<TaskItem>(at(id), input);
}

/**
 * The backend decides what removing means: a task the user wrote is deleted,
 * and one a service added is dismissed, so its dedupeKey keeps the same
 * follow-up from coming straight back. The response body is not part of the
 * contract, so nothing reads it; callers refetch the list instead.
 */
export function deleteTask(id: string) {
  return apiDelete<unknown>(at(id));
}

// A task the user wrote was added through a session route, so its kind is
// already one of these; the check narrows the type, and "user" only catches a
// row that somehow says otherwise (the backend would refuse `coach` from here).
const isUserRouteKind = (kind: TaskSourceKind): kind is UserRouteSourceKind =>
  kind === "user" || kind === "prep" || kind === "ats";

/**
 * Put back a task the user just removed — the Undo on "Removed from your plan".
 *
 * Removing meant two different things on the server, so undoing does too. A
 * task a service added was only dismissed, so it goes back to the status it
 * had. A task the user wrote was deleted outright, so it is written again from
 * the snapshot: a new id, the same dedupeKey, and ticked again if it had been
 * done, because a create always lands open.
 */
export async function restoreTask(task: TaskItem): Promise<TaskItem> {
  if (task.createdBy === "service") return updateTask(task.id, { status: task.status });

  const result = await createTasks({
    task: {
      title: task.title,
      detail: task.detail,
      href: task.href,
      period: task.period,
      priority: task.priority,
      dueAt: task.dueAt,
      dedupeKey: task.dedupeKey,
      metadata: task.metadata,
    },
    source: { kind: isUserRouteKind(task.source.kind) ? task.source.kind : "user", ref: task.source.ref },
  });
  const restored = result.created[0] ?? result.existing[0];
  if (!restored) throw new Error(result.rejected[0]?.message ?? "That task couldn't be put back on your plan.");
  return restored.status === task.status ? restored : updateTask(restored.id, { status: task.status });
}

// ---------------------------------------------------------------------------
// Reading a list
// ---------------------------------------------------------------------------

/** Whether a task belongs on the plan as the user sees it. Dismissed tasks are kept only for dedupe. */
export function isOnPlan(task: TaskItem): boolean {
  return task.status !== "dismissed";
}

const STATUS_RANK: Record<TaskStatus, number> = { open: 0, done: 1, dismissed: 2 };

/**
 * The order `TaskService.listTasks` answers in: open first, then priority
 * (1 before 3), then newest. Used to place a task the browser just created
 * where the next fetch will put it, so the row does not appear in one place
 * and jump to another when that fetch lands.
 */
export function compareTasks(a: TaskItem, b: TaskItem): number {
  return (
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    a.priority - b.priority ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/**
 * The order a plan panel lays its rows out in: priority, then newest, and
 * deliberately not status. `compareTasks` puts open tasks first, which is right
 * for choosing what to show but wrong for a checklist: ticking a row would move
 * it out from under the pointer, and so would the refetch that lands after the
 * tick. Ties fall back to the id so two renders of one list always agree.
 */
export function comparePlanRows(a: TaskItem, b: TaskItem): number {
  return (
    a.priority - b.priority ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** How far through the period's plan the user is. Dismissed tasks count as neither. */
export function planProgress(tasks: readonly TaskItem[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    if (!isOnPlan(task)) continue;
    total += 1;
    if (task.status === "done") done += 1;
  }
  return { done, total };
}

// The backend's TASK_HREF_PATTERN (remoteworldwidebackend/src/types/tasks.ts),
// mirrored. The backend already refuses anything else, so this is the second
// lock rather than the first: a task's link renders as a Next <Link>, and a
// `//host` path there would be an off-site navigation the user never chose.
const TASK_HREF_PATTERN = /^\/dashboard(\/[A-Za-z0-9_-]+)*\/?(\?[A-Za-z0-9._~=&%-]*)?$/;

/** The task's link when it is an internal dashboard path, and null otherwise. */
export function taskHref(task: Pick<TaskItem, "href">): string | null {
  return task.href && TASK_HREF_PATTERN.test(task.href) ? task.href : null;
}
