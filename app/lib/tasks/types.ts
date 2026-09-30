// Plan tasks — the frontend's copy of the contract.
//
// The backend owns it: remoteworldwidebackend/src/types/tasks.ts. Keep the two
// in step. `createdAt`, `updatedAt` and `completedAt` arrive as real Dates
// because `revive` in app/lib/api/core.ts lists them; every other timestamp
// here stays an ISO string.

export const TASK_STATUSES = ["open", "done", "dismissed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_SOURCE_KINDS = ["user", "coach", "prep", "ats", "follow-up", "application", "system"] as const;
export type TaskSourceKind = (typeof TASK_SOURCE_KINDS)[number];

export type TaskActor = "user" | "service";

/** 1 is the most important. */
export type TaskPriority = 1 | 2 | 3;

export const TASK_LIMITS = {
  titleMax: 120,
  detailMax: 500,
  batchMax: 25,
  openPerPeriodMax: 30,
} as const;

export interface TaskSource {
  kind: TaskSourceKind;
  ref: string | null;
}

export type TaskMetadata = Record<string, string | number | boolean | null>;

export interface TaskInput {
  title: string;
  detail?: string | null;
  /** An internal `/dashboard/...` path; the backend rejects anything else. */
  href?: string | null;
  period?: string;
  priority?: TaskPriority;
  dueAt?: string | null;
  dedupeKey?: string | null;
  metadata?: TaskMetadata;
}

export interface TaskItem {
  id: string;
  title: string;
  detail: string | null;
  href: string | null;
  /** `YYYY-MM`. */
  period: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  source: TaskSource;
  createdBy: TaskActor;
  dedupeKey: string | null;
  /** Null on a task a service added that the user has not seen yet — the "New" marker. */
  seenAt: string | null;
  completedAt: Date | null;
  metadata: TaskMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskRejection {
  index: number;
  reason:
    | "invalid-title"
    | "invalid-detail"
    | "invalid-href"
    | "invalid-period"
    | "invalid-priority"
    | "invalid-due-at"
    | "invalid-dedupe-key"
    | "invalid-metadata"
    | "duplicate-in-batch"
    | "plan-full";
  message: string;
}

export interface AddTasksResult {
  created: TaskItem[];
  existing: TaskItem[];
  rejected: TaskRejection[];
}

export interface ListTasksQuery {
  period?: string;
  status?: TaskStatus;
}

/** Session routes may label a task only as the user's own, or from prep or the ATS screen. */
export type UserRouteSourceKind = "user" | "prep" | "ats";

export type CreateTasksBody = ({ task: TaskInput } | { tasks: TaskInput[] }) & {
  source?: { kind: UserRouteSourceKind; ref: string | null };
};

export interface UpdateTaskInput {
  title?: string;
  detail?: string | null;
  href?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  status?: TaskStatus;
  seen?: true;
}

/** The plan's month for a local date, `YYYY-MM` — what the plan panel asks for. */
export function periodOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
