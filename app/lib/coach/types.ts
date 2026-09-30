// Career coach — the frontend's copy of the contract.
//
// The AI service owns it: remoteworldwideai/src/types/coach.ts. Keep the two in
// step. `createdAt` arrives as a real Date (see `revive` in
// app/lib/api/core.ts); `lastMessageAt` stays an ISO string.

import type { CoachMessageCard as DashboardCoachMessageCard } from "@/app/lib/dashboard/types";
import type { TaskPriority, TaskRejection } from "@/app/lib/tasks/types";

export const COACH_LIMITS = {
  messageMax: 2_000,
  proposalTasksMax: 5,
} as const;

/** Same shape the existing message card renders; the service narrows `href` to real dashboard screens. */
export type CoachMessageCard = DashboardCoachMessageCard;

export interface CoachSessionItem {
  id: string;
  title: string | null;
  lastMessageAt: string;
  createdAt: Date;
}

export interface CoachProposalTask {
  title: string;
  detail: string | null;
  href: string | null;
  priority: TaskPriority;
}

export type CoachProposalStatus = "open" | "accepted" | "dismissed";

export interface CoachProposalItem {
  id: string;
  sessionId: string;
  messageId: string;
  status: CoachProposalStatus;
  tasks: CoachProposalTask[];
  acceptedTaskIds: string[];
}

export interface CoachMessageItem {
  id: string;
  sessionId: string;
  from: "coach" | "user";
  text: string;
  card: CoachMessageCard | null;
  proposal: CoachProposalItem | null;
  createdAt: Date;
  /** "voice" when it was spoken in talk mode. */
  channel?: "text" | "voice";
}

export interface CoachUsage {
  day: string;
  freeRepliesPerDay: number;
  freeRepliesUsed: number;
  freeRepliesLeft: number;
  creditsPerReply: number;
}

export interface CoachSessionList {
  sessions: CoachSessionItem[];
  usage: CoachUsage;
}

export interface CoachSessionDetail {
  session: CoachSessionItem;
  messages: CoachMessageItem[];
  usage: CoachUsage;
}

/** `POST /api/ai/coach/sessions` — 201. */
export interface CreateCoachSessionResult {
  session: CoachSessionItem;
  usage: CoachUsage;
}

export interface SendCoachMessageInput {
  text: string;
  clientMessageId: string;
}

export type CoachErrorCode = "insufficient-credits" | "limited" | "unavailable" | "failed" | "too-long";

/**
 * One turn's SSE events, in order: `accepted`, `delta`s, at most one `card`,
 * at most one `proposal`, then `done` — or `error` after `accepted`. Refusals
 * before generation starts (400, 402, 404, 429, 503) are ordinary JSON
 * responses, not events.
 */
export type CoachStreamEvent =
  | { event: "accepted"; data: { userMessage: CoachMessageItem; session: CoachSessionItem } }
  | { event: "delta"; data: { text: string } }
  | { event: "card"; data: CoachMessageCard }
  | { event: "proposal"; data: CoachProposalItem }
  | { event: "done"; data: { message: CoachMessageItem; usage: CoachUsage; charged: boolean; balance: number | null } }
  | { event: "error"; data: { code: CoachErrorCode; message: string; retryAfterMs: number | null } };

export interface AcceptProposalInput {
  taskIndexes?: number[];
  /**
   * `YYYY-MM`: the plan month the tasks are filed under — the month the user is
   * looking at. Omitted, the backend files them under the current month.
   */
  period?: string;
}

export interface AcceptProposalResult {
  proposal: CoachProposalItem;
  created: number;
  existing: number;
  rejected: TaskRejection[];
}

/** `POST /api/ai/coach/proposals/:id/dismiss` — the proposal, now dismissed. */
export type DismissProposalResult = CoachProposalItem;
