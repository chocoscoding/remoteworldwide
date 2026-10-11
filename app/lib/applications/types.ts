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
import type { HabitItem } from "@/app/lib/streak/types";

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
  coverLetterMax: 8_000,
  answersMax: 40,
  questionMax: 400,
  answerMax: 4_000,
} as const;

/** One form question and the answer sent with it: a snapshot, not a link into the saved-answer library. */
export interface ApplicationAnswer {
  question: string;
  answer: string;
}

/**
 * A record's link to a Remote Worldwide listing, fixed by the server when the job was on the site
 * at the record's moment, and never changed afterwards. The listing page is `/jobs/<slug>`. The
 * "On Remote Worldwide" link follows this, not `source`.
 */
export interface ListingLink {
  platformJobId: string;
  slug: string;
  companyLogo: string | null;
}

export interface ApplicationItem {
  id: string;
  company: string;
  role: string;
  location: string | null;
  url: string | null;
  savedJobId: string | null;
  /** The linked saved job's logo, joined on read so it can't go stale against the job; with no job, the linked listing's; else null. */
  companyLogo: string | null;
  /** What the client said when it was logged. The server never rewrites it; whether it is on Remote Worldwide is `listing`. */
  source: ApplicationSource;
  /**
   * The Remote Worldwide listing it was applied to, when that job was live on the site at the moment
   * it was logged — or, for one logged as saved, at its first move into a stage. Server-decided, set
   * once, never changed; a client never sends it.
   */
  listing: ListingLink | null;
  status: ApplicationStatus;
  closedFrom: ApplicationStage | null;
  closedAt: string | null;
  loggedAt: string;
  lastTouchedAt: string;
  roundsReached: number | null;
  duplicateOf: string | null;
  atsScore: number | null;
  /** The ingested resume (`GET /api/ai/resume`) it was sent with, when it went through the apply wizard. */
  resumeId: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

/** `GET /api/applications/:id`: the row plus what was sent, which the list leaves out. */
export interface ApplicationDetail extends ApplicationItem {
  coverLetter: string | null;
  answers: ApplicationAnswer[];
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
  resumeId?: string | null;
  coverLetter?: string | null;
  answers?: ApplicationAnswer[] | null;
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
  resumeId?: string | null;
  coverLetter?: string | null;
  answers?: ApplicationAnswer[] | null;
}

export interface DuplicateCheckQuery {
  company: string;
  role: string;
  url?: string;
}

/** How a duplicate matched. "link" and "posting" both mean the same posting; "name" only the same company and role. */
export type DuplicateMatchKind = "link" | "posting" | "name";

/**
 * `GET /api/applications/duplicate`'s answer. "posting" is a prior for the same Remote Worldwide
 * posting found through its listings — the extension's application on the ATS page and the site's
 * RWW card find each other. A row found several ways carries the strongest kind: link > posting > name.
 */
export interface DuplicateApplicationItem extends ApplicationItem {
  matchedBy: DuplicateMatchKind;
  /**
   * When it was sent (ISO), or null while it never was. A card saved on the board and applied to
   * later was sent then, not at `loggedAt` (the saving day), so "sent this week" reads this. A row
   * from before the server recorded it answers its `loggedAt`.
   */
  sentAt: string | null;
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
  /** The day a pause ends (`YYYY-MM-DD`, the user's calendar); null when not paused, or paused with no end. */
  pauseEndsOn: string | null;
  /** The daily habits, each ticked by the action kind it is bound to. The defaults until the user edits them. */
  habits: HabitItem[];
  boardImportedAt: string | null;
  /**
   * A rest-day change counts from tomorrow: until `restDaysFrom` the streak keeps
   * `restDaysBefore`. Null when none is waiting; absent from older backends.
   */
  restDaysBefore?: number[] | null;
  restDaysFrom?: string | null;
}

export type UpdateGoalsInput = Partial<Pick<GoalsItem, "weeklyTarget" | "restDays" | "huntHour" | "paused" | "pauseEndsOn" | "habits">>;

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
