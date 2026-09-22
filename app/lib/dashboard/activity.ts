// Activity engine — the artifact layer under the streak.
//
// The rule this file exists to enforce: a day only counts if something real was
// created. Every `QualifyingAction` carries a non-optional `artifactId` pointing
// at the thing that proves it happened — an application, a message, a prep
// session, a status transition. Opening the app is not an action. Ticking a
// checkbox with nothing behind it is not an action.
//
// Pure and React-free, like `streak.ts`. The rule is enforced on the server
// now: the backend's append-only `activity_events` log records each action in
// the same request that writes its artifact, and derives the streak from it
// (remoteworldwidebackend/src/types/streak.ts). This module keeps the action
// registry the dashboard renders from, the habits, dedupe and pod quorum.

import { addDays, fromDayKey } from "./streak";
import type { StreakDay, TrackerColumnId } from "./types";

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

/** One logged application. The primary artifact in the system. */
export interface Application {
  id: string;
  company: string;
  role: string;
  location?: string;
  /** The posting URL, when the user pasted one. Used for exact-match dedupe. */
  url?: string;
  /** Job description text, when we could parse or the user pasted it. */
  jdText?: string;
  /**
   * `internal` = applied through our own board (auto-recorded).
   * `external` = logged by hand. Same record shape either way — there is
   * deliberately one application type, not two paths.
   */
  source: "internal" | "external";
  /** ISO timestamp of when it was logged. */
  loggedAt: string;
  /** Which tracker column it currently sits in. */
  status: TrackerColumnId;
  /** Set when the user saved past a duplicate warning — points at the original. */
  duplicateOf?: string;
  /** ATS score at log time, from the scoring seam. */
  atsScore?: number;
}

/** A sent message — follow-up, referral ask, or pod nudge. */
export interface MessageRecord {
  id: string;
  to: string;
  kind: "follow-up" | "referral" | "pod";
  at: string;
  /** Application this follow-up relates to, when there is one. */
  applicationId?: string;
}

/** A completed interview-prep session. Must be >= 10 minutes to qualify. */
export interface PrepSession {
  id: string;
  minutes: number;
  at: string;
  completed: boolean;
}

/** A tracker status transition, e.g. applied -> conversation. */
export interface StatusChange {
  id: string;
  applicationId: string;
  from: TrackerColumnId;
  to: TrackerColumnId;
  at: string;
}

// ---------------------------------------------------------------------------
// Qualifying actions
// ---------------------------------------------------------------------------

export type ActionKind = "application" | "follow-up" | "message" | "prep" | "status-change";

export interface ActionKindSpec {
  kind: ActionKind;
  /** Shown in the day's tooltip and the audit trail. */
  label: string;
  /** What must exist for this action to be valid. Enforced by the server, which records it with the artifact. */
  artifact: string;
  /** The daily-habit row this action satisfies, so habits tick themselves. */
  habitLabel: string;
  /** Where to go to actually produce the artifact. `null` opens the log dialog. */
  href: string | null;
  /** Two-word name for tight controls, where `artifact` would truncate. */
  short: string;
  /**
   * How much this action contributes to a day's INTENSITY, which is what the
   * credit rewards read. Keeping a streak alive and earning from it are
   * deliberately different bars: `prep` and `status-change` weigh 0, so a
   * tracker drag preserves your streak and pays nothing. Remote Worldwide
   * vets the jobs, so the seeker's binding constraint is volume of real
   * outreach — that is what this weights.
   */
  intensityWeight: number;
}

/**
 * The five qualifying actions. This list is the contract: if a UI wants to
 * mark a day logged, it has to produce one of these, with an artifact.
 */
export const ACTION_KINDS: Record<ActionKind, ActionKindSpec> = {
  application: {
    kind: "application",
    label: "Application logged",
    artifact: "Application",
    habitLabel: "Apply to 1 role",
    href: null,
    short: "Application",
    intensityWeight: 1,
  },
  "follow-up": {
    kind: "follow-up",
    label: "Follow-up sent",
    artifact: "Message with recipient and timestamp",
    habitLabel: "Follow up on an application",
    href: "/dashboard/tracker",
    short: "Follow-up",
    intensityWeight: 0.5,
  },
  message: {
    kind: "message",
    label: "Referral or pod message sent",
    artifact: "Message",
    habitLabel: "Message a referral or pod member",
    href: "/dashboard/referrals",
    short: "Message",
    intensityWeight: 0.5,
  },
  prep: {
    kind: "prep",
    label: "Interview prep completed",
    artifact: "Session of 10 minutes or more",
    habitLabel: "15 minutes of interview prep",
    href: "/dashboard/prep",
    short: "Prep session",
    intensityWeight: 0,
  },
  "status-change": {
    kind: "status-change",
    label: "Tracker updated",
    artifact: "Application status transition",
    habitLabel: "Update your tracker",
    href: "/dashboard/tracker",
    short: "Status change",
    intensityWeight: 0,
  },
};

/**
 * The per-day bar, derived from the weekly goal rather than configured twice —
 * 8 a week over 5 weekdays is the "2 a day, Mon-Fri" the Home card already
 * prints. Rounded up so the target is never fractional.
 */
export function dailyTargetFrom(weeklyTarget: number, weekdays = 5): number {
  return Math.max(1, Math.ceil(weeklyTarget / weekdays));
}

/**
 * A daily habit is only ever a *binding* to an artifact type — the label is the
 * user's words, the `kind` is what actually has to exist for it to tick. That
 * binding is required, not optional: a habit with nothing behind it is the
 * naked checkbox §2 rules out.
 */
export interface HabitDef {
  id: string;
  label: string;
  kind: ActionKind;
}

export const DEFAULT_HABITS: HabitDef[] = [
  { id: "habit-apply", label: "Apply to 1 role", kind: "application" },
  { id: "habit-referral", label: "Message a referral or pod member", kind: "message" },
  { id: "habit-tracker", label: "Update your tracker", kind: "status-change" },
  { id: "habit-prep", label: "15 minutes of interview prep", kind: "prep" },
];

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/**
 * Every streak state change has one of these. Nothing may silently reset a
 * streak — if the number moves, there is a row saying why. The server writes
 * them (`streak_days`) and the streak answer carries the newest.
 */
export interface AuditEntry {
  id: string;
  at: string;
  /** The day whose state changed. */
  day: string;
  from: StreakDay["status"] | "none";
  to: StreakDay["status"];
  reason: string;
}

// ---------------------------------------------------------------------------
// Dedupe
// ---------------------------------------------------------------------------

/** Case/punctuation-insensitive key for comparing two applications. */
export function normalizeKey(company: string, role: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return `${clean(company)}::${clean(role)}`;
}

/** How far back a company+role match still counts as a duplicate. */
export const DEDUPE_WINDOW_DAYS = 90;

/**
 * Finds a prior application that looks like the same one. Callers must **warn,
 * never block** — people genuinely re-apply, and a false positive that refuses
 * the save is far worse than a duplicate row.
 */
export function findDuplicate(
  candidate: { company: string; role: string; url?: string },
  applications: Application[],
  today: Date
): Application | null {
  const cutoff = addDays(today, -DEDUPE_WINDOW_DAYS).getTime();
  const key = normalizeKey(candidate.company, candidate.role);

  return (
    applications.find((a) => {
      // An exact URL match is a duplicate regardless of age.
      if (candidate.url && a.url && candidate.url === a.url) return true;
      if (new Date(a.loggedAt).getTime() < cutoff) return false;
      return normalizeKey(a.company, a.role) === key;
    }) ?? null
  );
}

/** Human label for a covered day, e.g. "Tuesday". */
export function weekdayName(day: string): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][fromDayKey(day).getDay()];
}

// ---------------------------------------------------------------------------
// Outcome roll-up (feeds the proof-of-progress panel in P1)
// ---------------------------------------------------------------------------

export interface ActivityTotals {
  applications: number;
  thisWeek: number;
  /** Median seconds spent logging, used by the time estimate. */
  medianLogSeconds: number;
}

/** Rolling median of how long a log actually took this user. */
export function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}


// ---------------------------------------------------------------------------
// Pod streaks (P2)
// ---------------------------------------------------------------------------

/**
 * Share of active members who must log for the pod's day to count.
 *
 * Not 100%: one person's bad day shouldn't cost six other people their streak,
 * and a threshold nobody can hold is a threshold everybody stops trying for.
 * 60% means the pod carries you sometimes and you carry it sometimes, which is
 * the entire point of a pod.
 */
export const POD_QUORUM = 0.6;

/** How many members must log today for the pod day to count. */
export function podQuorumCount(activeMembers: number): number {
  return Math.ceil(activeMembers * POD_QUORUM);
}

/** Whether the pod's day is logged. */
export function podDayLogged(loggedMembers: number, activeMembers: number): boolean {
  return activeMembers > 0 && loggedMembers >= podQuorumCount(activeMembers);
}

/** One nudge per member per day — a nudge you can spam is harassment. */
export const NUDGE_LIMIT_PER_MEMBER_PER_DAY = 1;
