// The recommendations wire contract, mirroring
// remoteworldwidebackend/src/types/recommendations.ts. Change it there first.
//
// Reviewers on the Remote Worldwide team put a candidate straight in front of a
// company; the company asks a question or two; the candidate answers once and
// they're connected. No messaging model — answering IS the conversation.

/** The stages, in order — the index is the meaning. */
export const RECOMMENDATION_STAGES = ["reviewed", "questions", "interview"] as const;
export type RecommendationStage = (typeof RECOMMENDATION_STAGES)[number];

/**
 * What the stage tracker prints, index for index with RECOMMENDATION_STAGES.
 * Three, not five: a recommendation skips the funnel — reviewers put you
 * forward, the company asks, you answer, you talk. (This was `INTRO_STAGES` in
 * the old mock data.)
 */
export const RECOMMENDATION_STAGE_LABELS = ["Reviewed", "Their questions", "Interview"] as const;

export const RECOMMENDATION_OUTCOMES = ["connected", "passed", "expired"] as const;
export type RecommendationOutcome = (typeof RECOMMENDATION_OUTCOMES)[number];

/** Credits paid, once, for answering a company's questions. The server decides; this is for copy. */
export const RECOMMENDATION_ANSWER_CREDITS = 5;
export const RECOMMENDATION_ANSWER_MAX_CHARS = 5_000;
export const RECOMMENDATION_QUESTIONS_MAX = 5;
export const RECOMMENDATION_QUESTION_MAX_CHARS = 600;
export const RECOMMENDATION_NOTE_MAX_CHARS = 1_000;
export const RECOMMENDATION_DEFAULT_EXPIRY_DAYS = 7;

/**
 * Reviewers only pick from complete profiles with a master resume. The server
 * owns the rule (and the labels); the ids are here so the screen can link each
 * one to where it is fixed.
 */
export const ELIGIBILITY_REQUIREMENTS = ["fullName", "headline", "summary", "location", "timezone", "skills", "targetRoles", "masterResume"] as const;
export type EligibilityRequirement = (typeof ELIGIBILITY_REQUIREMENTS)[number];

export interface EligibilityItem {
  id: EligibilityRequirement;
  label: string;
  done: boolean;
}

/** `GET /api/recommendations/eligibility`. */
export interface RecommendationEligibility {
  eligible: boolean;
  /** Every requirement, done or not, in checklist order. */
  requirements: EligibilityItem[];
  /** The resume reviewers read, when one is set. */
  masterResume: { id: string; name: string } | null;
}

export interface RecommendationQuestionItem {
  id: string;
  question: string;
  answer: string | null;
  /** ISO 8601. */
  answeredAt: string | null;
}

/** The candidate's view. Dates are ISO strings (none of these keys are revived by app/lib/api/core.ts). */
export interface RecommendationItem {
  id: string;
  company: string;
  role: string;
  platformJobId: string | null;
  jobUrl: string | null;
  stage: RecommendationStage;
  stageIndex: number;
  questions: RecommendationQuestionItem[];
  reviewer: { name: string };
  note: string | null;
  expiresAt: string | null;
  answeredAt: string | null;
  outcome: RecommendationOutcome | null;
  outcomeAt: string | null;
  /** Revived to a Date by the API layer (`createdAt` is one of its date keys). */
  createdAt: Date;
  updatedAt: Date;
}

export interface AnswerRecommendationInput {
  answers: { questionId: string; answer: string }[];
}

export interface AnswerRecommendationResult {
  recommendation: RecommendationItem;
  /** Credits this call paid — 0 when the answers had already been sent. */
  credited: number;
  /** True when the answers had already been sent — a second tab, a retry. Nothing changed. */
  alreadySent: boolean;
}

// ---------------------------------------------------------------------------
// Admin — the reviewers' screens under /heroshima/recommendations
// ---------------------------------------------------------------------------

export interface RecommendationCandidate {
  id: string;
  name: string | null;
  email: string | null;
}

/** A row in the create form's candidate picker: who they are, and whether they can be picked yet. */
export interface RecommendationCandidateMatch extends RecommendationCandidate {
  eligible: boolean;
  /** Labels of the requirements still open, in checklist order. Empty when eligible. */
  missing: string[];
  masterResume: { id: string; name: string } | null;
}

export interface AdminRecommendationItem extends Omit<RecommendationItem, "reviewer"> {
  candidate: RecommendationCandidate | null;
  reviewer: { userId: string | null; name: string };
}

export interface AdminRecommendationList {
  data: AdminRecommendationItem[];
  count: number;
}

export const ADMIN_RECOMMENDATION_FILTERS = ["open", "closed", "all"] as const;
export type AdminRecommendationFilter = (typeof ADMIN_RECOMMENDATION_FILTERS)[number];

export interface CreateRecommendationInput {
  candidateId: string;
  company?: string;
  role?: string;
  platformJobId?: string | null;
  jobUrl?: string | null;
  questions?: string[];
  note?: string | null;
  expiresAt?: string | null;
  reviewerName?: string | null;
}

export interface UpdateRecommendationInput {
  company?: string;
  role?: string;
  platformJobId?: string | null;
  jobUrl?: string | null;
  questions?: { id?: string | null; question: string }[];
  note?: string | null;
  expiresAt?: string | null;
  reviewerName?: string | null;
  stage?: RecommendationStage;
  outcome?: RecommendationOutcome | null;
}
