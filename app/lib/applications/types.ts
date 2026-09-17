// Applications and goals — the frontend's copy of the contract.
//
// The backend owns it: remoteworldwidebackend/src/types/applications.ts. Keep
// the two in step. `createdAt` and `updatedAt` arrive as real Dates (see
// `revive` in app/lib/api/core.ts); `loggedAt`, `lastTouchedAt`, `closedAt`
// and `boardImportedAt` stay ISO strings.
//
// The stages and outcomes are the tracker's own unions, not copies of them, so
// the board and the table cannot drift apart.

import type { TrackerClosedReason, TrackerColumnId, TrackerStatus } from "@/app/lib/dashboard/types";

export const APPLICATION_STAGES = ["saved", "applied", "conversation", "interviewing", "offer"] as const satisfies readonly TrackerColumnId[];
export type ApplicationStage = TrackerColumnId;

export const CLOSED_REASONS = ["rejected", "ghosted", "withdrawn", "declined"] as const satisfies readonly TrackerClosedReason[];
export type ClosedReason = TrackerClosedReason;

export type ApplicationStatus = TrackerStatus;

/**
 * Compile-time guards: each fails to type-check if the tracker gains a stage
 * or an outcome that the lists above (and therefore the backend) do not know.
 */
export const STAGES_MATCH_TRACKER: [TrackerColumnId] extends [(typeof APPLICATION_STAGES)[number]] ? true : never = true;
export const OUTCOMES_MATCH_TRACKER: [TrackerClosedReason] extends [(typeof CLOSED_REASONS)[number]] ? true : never = true;

export type ApplicationSource = "internal" | "external";

export const APPLICATION_LIMITS = {
  companyMax: 120,
  roleMax: 160,
  locationMax: 120,
  urlMax: 2_000,
  idempotencyKeyMax: 120,
  importMax: 500,
} as const;

export interface ApplicationItem {
  id: string;
  company: string;
  role: string;
  location: string | null;
  url: string | null;
  savedJobId: string | null;
  source: ApplicationSource;
  status: ApplicationStatus;
  closedFrom: ApplicationStage | null;
  closedAt: string | null;
  loggedAt: string;
  lastTouchedAt: string;
  roundsReached: number | null;
  duplicateOf: string | null;
  atsScore: number | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApplicationInput {
  company: string;
  role: string;
  location?: string | null;
  url?: string | null;
  savedJobId?: string | null;
  source?: ApplicationSource;
  status?: ApplicationStage;
  duplicateOf?: string | null;
  atsScore?: number | null;
  idempotencyKey?: string | null;
  loggedAt?: string;
}

export interface UpdateApplicationInput {
  status?: ApplicationStatus;
  position?: number;
  company?: string;
  role?: string;
  location?: string | null;
  url?: string | null;
  roundsReached?: number | null;
  atsScore?: number | null;
  touch?: true;
}

export interface DuplicateCheckQuery {
  company: string;
  role: string;
  url?: string;
}

/**
 * One card from the browser board, for the one-time import. Seed cards from
 * `mock-data.ts` must be filtered out BEFORE posting — see the backend contract.
 */
export interface BoardImportCard {
  clientId: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  closedFrom?: ApplicationStage | null;
  daysAgo?: number | null;
  lastTouchedDaysAgo?: number | null;
  closedDaysAgo?: number | null;
  roundsReached?: number | null;
  rww?: boolean;
}

export interface BoardImportInput {
  cards: BoardImportCard[];
}

export interface BoardImportResult {
  imported: number;
  skipped: number;
  alreadyImported: boolean;
}

export interface GoalsItem {
  weeklyTarget: number;
  restDays: number[];
  huntHour: number;
  paused: boolean;
  boardImportedAt: string | null;
}

export type UpdateGoalsInput = Partial<Pick<GoalsItem, "weeklyTarget" | "restDays" | "huntHour" | "paused">>;

export interface FunnelStage {
  id: ApplicationStage;
  reached: number;
  conversion: number | null;
}

export interface SourceSplit {
  applied: number;
  reachedInterview: number;
  rate: number | null;
  reliable: boolean;
}

export interface Funnel {
  stages: FunnelStage[];
  closures: Array<{ reason: ClosedReason; n: number }>;
  open: number;
  closed: number;
  total: number;
  bySource: { rww: SourceSplit; elsewhere: SourceSplit };
}

export type FollowUpKind = "after-apply" | "in-play" | "long-silence";

export interface FollowUpDue {
  applicationId: string;
  kind: FollowUpKind;
  daysSilent: number;
  company: string;
  role: string;
  stage: ApplicationStage;
}

export interface ApplicationSummary {
  funnel: Funnel;
  diagnosis: string;
  followUps: FollowUpDue[];
  weeklyGoal: { target: number; loggedThisWeek: number; paused: boolean };
}
