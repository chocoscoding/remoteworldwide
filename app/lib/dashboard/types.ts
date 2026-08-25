// Shared TypeScript types for the Job Seeker Dashboard feature.
// Every dashboard screen imports its content shapes from here and its mock
// content from "./mock-data". Keep this file dependency-free aside from the
// lucide-react icon type used by the sidebar nav config.

import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Core / foundation types (used across many screens)
// ---------------------------------------------------------------------------

/** A single saved application-question answer, shown on the Questions screen. */
export interface QaItem {
  id: string;
  q: string;
  a: string;
  kind: "saved" | "ai" | "review";
  cat: "screening" | "demographics";
  /** Only present on kind "review" items — the AI's new draft that differs from the saved answer. */
  draft?: string;
}

/** A single Q&A pair attached to a specific application. */
export interface ApplicationQa {
  q: string;
  a: string;
}

/** One tracked/applied-to job, with the question/answer pairs that application asked. */
export interface Application {
  id: string;
  title: string;
  meta: string;
  /** true when this application was sourced/submitted through Remote Worldwide. */
  rww?: boolean;
  qs: ApplicationQa[];
}

/** One row in the pod activity feed. */
export interface FeedItem {
  id: string;
  text: string;
  time: string;
  n: number;
  hot?: boolean;
}

/** One row of the pod leaderboard. */
export interface BoardRow {
  rank: number;
  name: string;
  streak: number;
  apps: number;
  me?: boolean;
}

/** One row of the invite/referral chain. */
export interface ChainRow {
  name: string;
  meta: string;
  tag: string;
  depth: number;
  pending?: boolean;
}

/** Config for one step of the 5-step Apply wizard's step tracker. */
export interface ApplyStepConfig {
  n: number;
  label: string;
}

/** One card in the Application Tracker Kanban board. */
export interface TrackerCard {
  id: string;
  title: string;
  company: string;
  daysAgo?: number;
  statusChip?: string;
  rww?: boolean;
  highlighted?: boolean;
}

/** One entry in the dashboard sidebar navigation. */
export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/** One labeled (or unlabeled) group of nav items in the sidebar. */
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export interface ResumeExperienceEntry {
  id: string;
  role: string;
  company: string;
  dates: string;
  bullets: string[];
}

export interface ResumeEducationEntry {
  id: string;
  school: string;
  degree: string;
  dates: string;
  location?: string;
  /** Optional single line under the degree, e.g. honours or a thesis title. */
  detail?: string;
}

export interface ResumeProjectEntry {
  id: string;
  name: string;
  detail: string;
  link?: string;
}

export interface ResumeCertEntry {
  id: string;
  name: string;
  issuer?: string;
  year?: string;
}

/** One labeled URL in the header contact block (portfolio, LinkedIn, GitHub…). */
export interface ResumeLink {
  label: string;
  url: string;
}

export interface ResumeContent {
  name: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  portfolio: string;
  links: ResumeLink[];
  summary: string;
  experience: ResumeExperienceEntry[];
  education: ResumeEducationEntry[];
  projects: ResumeProjectEntry[];
  certifications: ResumeCertEntry[];
  skills: string[];
}

// ---------------------------------------------------------------------------
// Cover letter
// ---------------------------------------------------------------------------

export interface CoverLetterContent {
  company: string;
  role: string;
  /** e.g. "Draft 2" — shown as a pill next to the header title. */
  draftLabel: string;
  greeting: string;
  paragraphs: string[];
  signOff: string;
  wordCount: number;
}

// ---------------------------------------------------------------------------
// Application tracker (Kanban)
// ---------------------------------------------------------------------------

export type TrackerColumnId =
  | "saved"
  | "applied"
  | "conversation"
  | "interviewing"
  | "offer";

export interface TrackerColumn {
  id: TrackerColumnId;
  label: string;
  /** Total count for the column header, e.g. "Applied (34)" — may exceed cards.length (cards is a representative sample). */
  count: number;
  cards: TrackerCard[];
}

// ---------------------------------------------------------------------------
// ATS scorer
// ---------------------------------------------------------------------------

export interface AtsMetric {
  id: string;
  label: string;
  /** 0-100 */
  value: number;
}

export interface AtsKeyword {
  id: string;
  label: string;
  present: boolean;
}

export interface AtsFixItem {
  id: string;
  label: string;
  detail: string;
  action: string;
}

export interface AtsResumeRow {
  id: string;
  name: string;
  generalScore: number | null;
  jdScore: number | null;
  action: string;
  archived?: boolean;
}

// ---------------------------------------------------------------------------
// Career coach
// ---------------------------------------------------------------------------

export interface CoachMessageCard {
  title: string;
  cta: string;
  href: string;
}

export interface CoachMessage {
  id: string;
  from: "coach" | "user";
  text: string;
  /** Optional embedded action card, e.g. the "6 warm paths found" referrals card. */
  card?: CoachMessageCard;
}

export interface CoachPlanItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CoachSession {
  id: string;
  title: string;
}

// ---------------------------------------------------------------------------
// JD Q&A ("Ask about a job")
// ---------------------------------------------------------------------------

export interface JdContent {
  company: string;
  role: string;
  salary: string;
  jdText: string;
  /** A short phrase that appears verbatim inside jdText, meant to be visually highlighted. */
  highlight: string;
}

export interface JdQuickQuestion {
  id: string;
  label: string;
}

export interface JdQaAnswer {
  /** Matches a JdQuickQuestion id. */
  id: string;
  question: string;
  verdict: string;
  missing: string;
  tips: string[];
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export interface ReferralContact {
  id: string;
  name: string;
  /** e.g. "Strong tie", "2nd degree", "Alumni" */
  tie: string;
  role: string;
  company: string;
  targetRole: string;
  status: string;
  /** Present for 2nd-degree contacts — the mutual connection's name. */
  via?: string;
  bio?: string;
}

// ---------------------------------------------------------------------------
// Landed / onboarding checklist
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export interface RecommendationCard {
  id: string;
  company: string;
  fitLabel: string;
  fitPct: number;
  action: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Home screen
// ---------------------------------------------------------------------------

export interface HomeStat {
  id: string;
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
}

export interface WeeklyGoal {
  current: number;
  target: number;
  /** Days of the M-S week that are marked done, e.g. ["M", "T", "Th"]. */
  doneDays: string[];
  /** All seven day labels in order, M through S. */
  allDays: string[];
}

// ---------------------------------------------------------------------------
// Pod goals (Your pod screen)
// ---------------------------------------------------------------------------

/** One member's vote on a proposed pod-goal change (add or remove). */
export interface PodGoalVote {
  memberName: string; // matches a BOARD row's `name`, or "You"
  choice: "for" | "against";
}

/** One pod-wide goal, shared by every member of the pod. */
export interface PodGoal {
  id: string;
  label: string;
  detail?: string;
  target: number;
  current: number;
  /** Trailing caption after the number, e.g. "applications today", "referrals this week". */
  unit: string;
  /** True only for the one goal that can never be voted out — see below. */
  protected: boolean;
  proposedBy?: string;
  votes: PodGoalVote[];
  status: "active" | "voting-add" | "voting-remove";
  /**
   * ISO timestamp a voting-add/voting-remove proposal was opened. A proposal
   * that hasn't reached a "for" majority within 7 real days of this is
   * dropped — voting against it doesn't resolve it early, it just leaves it
   * to run out the clock. Unused once status is "active".
   */
  proposedAt?: string;
}

// ---------------------------------------------------------------------------
// Daily streak (Home screen header, streak panel, pod leaderboard)
// ---------------------------------------------------------------------------

/**
 * What happened on one calendar day.
 *
 * - `done`   — you logged at least one application. Extends the streak.
 * - `rest`   — a scheduled rest day. Neutral: it neither extends nor breaks.
 * - `freeze` — a missed day that a streak freeze absorbed. Also neutral.
 * - `missed` — a plain miss. Breaks the streak.
 * - `today`  — the current day, still open. Becomes `done` when you log.
 * - `future` — hasn't happened yet; only ever rendered by the calendar.
 */
export type StreakDayStatus = "logged" | "backfilled" | "rest" | "freeze" | "missed" | "today" | "future";

/** One calendar day of streak history. */
export interface StreakDay {
  /** Local calendar date as `yyyy-mm-dd` — the stable key for a day. */
  date: string;
  status: StreakDayStatus;
  /** Applications logged that day. 0 for every non-`done` status. */
  count: number;
}

/**
 * One rung of the reward ladder. Reaching `days` consecutive days unlocks it
 * exactly once — `StreakState.claimed` records which rungs have already
 * fired their celebration so re-renders never re-trigger one.
 */
export interface StreakMilestone {
  days: number;
  label: string;
  blurb: string;
  /** Credits paid out on unlock. */
  credits: number;
  /** Which `StreakTier` this rung corresponds to. */
  tierId: string;
  emoji: string;
  /** Optional non-credit perk, e.g. an extra streak freeze. */
  perk?: string;
}

/** Everything the streak system tracks for the signed-in user. */
export interface StreakState {
  /** Consecutive qualifying days ending today (or yesterday, if today is still open). */
  current: number;
  /** Best run ever — never decreases. */
  longest: number;
  /** Unused streak freezes. One is spent automatically to absorb a miss. */
  freezes: number;
  /** Day history, oldest first. Covers roughly the last four months. */
  days: StreakDay[];
  /** `days` values of milestones already celebrated. */
  claimed: number[];
  /** Running credit balance, so milestone payouts have somewhere to land. */
  credits: number;
}
