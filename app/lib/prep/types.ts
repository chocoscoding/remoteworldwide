// Interview prep tracks and their likely questions — the frontend's copy of two
// contracts.
//
//  - Tracks: remoteworldwidebackend/src/types/prepTracks.ts owns them, served
//    at /api/prep-tracks. `createdAt` and `updatedAt` arrive as real Dates
//    because `revive` in app/lib/api/core.ts lists them; every other timestamp
//    here stays an ISO string.
//  - Likely questions: remoteworldwideai/src/types/prepQuestions.ts owns them,
//    served at /api/ai/prep/tracks/:trackId/questions through the session
//    proxy. remoteworldwideai/tests/contracts/prep-questions-types.test.ts
//    compares that half field for field.
//
// Keep both in step with their owners.

import type { ApplicationStage, ApplicationStatus } from "@/app/lib/applications/types";
import type { TaskItem } from "@/app/lib/tasks/types";
import type { PrepFormat } from "@/app/lib/voice/types";

// ---------------------------------------------------------------------------
// Tracks — /api/prep-tracks
// ---------------------------------------------------------------------------

export const PREP_ROUND_TYPES = [
  "recruiter-screen",
  "hiring-manager",
  "technical",
  "portfolio",
  "behavioural",
  "case-study",
  "panel",
  "final",
  "other",
] as const;
export type PrepRoundType = (typeof PREP_ROUND_TYPES)[number];

/** `null` (not in this list) means nothing is recorded yet. */
export const PREP_ROUND_OUTCOMES = ["waiting", "passed", "offer", "rejected"] as const;
export type PrepRoundOutcome = (typeof PREP_ROUND_OUTCOMES)[number];

export const PREP_TRACK_LIMITS = {
  companyMax: 120,
  roleMax: 160,
  locationMax: 120,
  roundsMax: 12,
  roundNotesMax: 2_000,
  jobDescriptionMax: 60_000,
} as const;

export interface PrepRound {
  id: string;
  type: PrepRoundType;
  /** ISO timestamp, or null when it is not booked yet. */
  scheduledAt: string | null;
  outcome: PrepRoundOutcome | null;
  notes: string;
}

/**
 * What a track's resume is while it names none of its own, worked out by the
 * backend: the resume its tracker application was sent with, else the master
 * document in My documents. A document is a file, not a parsed resume, so the
 * screens parse it once and store the result as the track's `resumeId`.
 */
export type PrepTrackDefaultResume =
  | { source: "application"; resumeId: string }
  | { source: "master"; documentId: string; name: string };

export interface PrepTrackItem {
  id: string;
  company: string;
  role: string;
  location: string | null;
  /** In the order the loop runs; the last one is the current round. */
  rounds: PrepRound[];
  applicationId: string | null;
  savedJobId: string | null;
  /** The linked saved job's logo, joined in on read. Null with no link, with a link to a job since deleted, or when the job has no logo. */
  companyLogo: string | null;
  /** Whether pasted posting text is stored on the track. The text comes only from the detail read. */
  hasJobDescription: boolean;
  /**
   * The resume sent for this job, as an `ai_resumes` id (the AI service's
   * parsed-resume store — the same kind of id as an application's
   * `resumeId`). Null means the default below.
   */
  resumeId: string | null;
  /** What stands in while `resumeId` is null; null when there is nothing. */
  defaultResume: PrepTrackDefaultResume | null;
  /** Plan tasks tied to this track (`source.kind: "prep"`, `metadata.trackId`), open and done, newest first. */
  actions: TaskItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PrepTrackDetail extends PrepTrackItem {
  jobDescription: string | null;
}

export interface PrepRoundInput {
  id?: string | null;
  type: PrepRoundType;
  scheduledAt?: string | null;
  outcome?: PrepRoundOutcome | null;
  notes?: string | null;
}

export interface CreatePrepTrackInput {
  company: string;
  role: string;
  location?: string | null;
  rounds?: PrepRoundInput[];
  /** Moved forward to interviewing on the tracker. */
  applicationId?: string | null;
  /** Without `applicationId`, its application is found or created, moved forward to interviewing, and linked. */
  savedJobId?: string | null;
  jobDescription?: string | null;
  /** An `ai_resumes` id; absent or null leaves the track on its default. */
  resumeId?: string | null;
}

/** The stages a new track moves an application forward from. Interviewing and offer are there already, or past it. */
export const PREP_TRACKER_EARLIER_STAGES = ["saved", "applied", "conversation"] as const satisfies readonly ApplicationStage[];
export type PrepTrackerEarlierStage = (typeof PREP_TRACKER_EARLIER_STAGES)[number];

/**
 * What adding a track did to the tracker — always what that one request did.
 * `unchanged` says why: `already-there` (interviewing or offer; forward only),
 * `closed` (an outcome is never reopened, though the track still links it) or
 * `already-tracked` (the job already had a track, which is what came back).
 */
export type PrepTrackerChange =
  | { kind: "none" }
  | { kind: "created"; applicationId: string }
  | { kind: "moved"; applicationId: string; from: PrepTrackerEarlierStage }
  | { kind: "unchanged"; applicationId: string; status: ApplicationStatus; reason: "already-there" | "closed" | "already-tracked" };

/** `POST /api/prep-tracks` — the track, plus what adding it did. */
export interface PrepTrackCreated extends PrepTrackItem {
  /** True when the job already had a track: this is that one (a 200), and nothing was written. */
  alreadyTracked: boolean;
  tracker: PrepTrackerChange;
}

export interface UpdatePrepTrackInput {
  company?: string;
  role?: string;
  location?: string | null;
  rounds?: PrepRoundInput[];
  applicationId?: string | null;
  savedJobId?: string | null;
  jobDescription?: string | null;
  /** `null` puts the track back on its default resume. */
  resumeId?: string | null;
}

// ---------------------------------------------------------------------------
// Likely questions — /api/ai/prep/tracks/:trackId/questions
// ---------------------------------------------------------------------------

export interface LikelyQuestion {
  id: string;
  text: string;
  why: string;
  format: PrepFormat;
  requirement: string | null;
}

export interface LikelyQuestionSet {
  trackId: string;
  company: string;
  role: string;
  questions: LikelyQuestion[];
  grounding: { resume: boolean; requirements: number };
  /** ISO timestamp. */
  generatedAt: string;
}

export interface LikelyQuestionsState {
  set: LikelyQuestionSet | null;
  /** The posting or the resume changed since the set was written. */
  stale: boolean;
  /** Credits one new set costs. */
  cost: number;
}

export interface GenerateLikelyQuestionsInput {
  refresh?: boolean;
}

export interface LikelyQuestionsResult extends LikelyQuestionsState {
  set: LikelyQuestionSet;
  charged: boolean;
  credits: number | null;
}
