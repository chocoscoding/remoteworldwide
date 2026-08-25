// Activity engine — the artifact layer under the streak.
//
// The rule this file exists to enforce: a day only counts if something real was
// created. Every `QualifyingAction` carries a non-optional `artifactId` pointing
// at the thing that proves it happened — an application, a message, a prep
// session, a status transition. Opening the app is not an action. Ticking a
// checkbox with nothing behind it is not an action.
//
// Pure and React-free, like `streak.ts`. `ActivityProvider` owns the state;
// this module only does the maths and the rules.
//
// Mock-only: nothing here persists. The structures are append-only within a
// session so the model is honest and could be swapped onto a real store later,
// but a reload starts over.

import { addDays, dayKey, fromDayKey } from "./streak";
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
  /** What must exist for this action to be valid. Enforced by `recordAction`. */
  artifact: string;
  /** The daily-habit row this action satisfies, so habits tick themselves. */
  habitLabel: string;
  /** Where to go to actually produce the artifact. `null` opens the log dialog. */
  href: string | null;
  /** Two-word name for tight controls, where `artifact` would truncate. */
  short: string;
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
  },
  "follow-up": {
    kind: "follow-up",
    label: "Follow-up sent",
    artifact: "Message with recipient and timestamp",
    habitLabel: "Follow up on an application",
    href: "/dashboard/tracker",
    short: "Follow-up",
  },
  message: {
    kind: "message",
    label: "Referral or pod message sent",
    artifact: "Message",
    habitLabel: "Message a referral or pod member",
    href: "/dashboard/referrals",
    short: "Message",
  },
  prep: {
    kind: "prep",
    label: "Interview prep completed",
    artifact: "Session of 10 minutes or more",
    habitLabel: "15 minutes of interview prep",
    href: "/dashboard/prep",
    short: "Prep session",
  },
  "status-change": {
    kind: "status-change",
    label: "Tracker updated",
    artifact: "Application status transition",
    habitLabel: "Update your tracker",
    href: "/dashboard/tracker",
    short: "Status change",
  },
};

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

export interface QualifyingAction {
  id: string;
  kind: ActionKind;
  /** Non-optional by design — no artifact, no action. */
  artifactId: string;
  /** ISO timestamp of the action itself. */
  at: string;
  /** The day this counts toward, after the grace-period rule below. */
  day: string;
}

// ---------------------------------------------------------------------------
// Grace period
// ---------------------------------------------------------------------------

/** Actions before this local hour count toward the previous day. */
export const GRACE_HOUR = 4;

/**
 * Which day an action counts toward. Someone still applying at 1am is
 * finishing yesterday, not starting today — crediting it to the calendar date
 * would break a streak that the user plainly did not break.
 */
export function resolveActionDay(at: Date): string {
  return dayKey(at.getHours() < GRACE_HOUR ? addDays(at, -1) : at);
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/**
 * Every streak state change writes one of these. Nothing may silently reset a
 * streak — if the number moves, there is a row here saying why.
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

// ---------------------------------------------------------------------------
// Day derivation
// ---------------------------------------------------------------------------

/**
 * Marks a day as logged (or backfilled) and returns a new array plus the audit
 * entry describing the change. Returns `null` for `audit` when nothing moved,
 * so callers can tell a real transition from a no-op.
 *
 * `rest` days are deliberately overwritable — logging on a rest day is allowed
 * and upgrades it, but a rest day left alone never breaks anything.
 */
export function markDay(
  days: StreakDay[],
  day: string,
  status: Extract<StreakDay["status"], "logged" | "backfilled">,
  reason: string,
  at: Date
): { days: StreakDay[]; audit: AuditEntry | null } {
  const existing = days.find((d) => d.date === day);
  if (existing?.status === status) {
    // Already in this state — bump the count, but there is no transition.
    return {
      days: days.map((d) => (d.date === day ? { ...d, count: d.count + 1 } : d)),
      audit: null,
    };
  }

  return {
    days: days.map((d) => (d.date === day ? { ...d, status, count: d.count + 1 } : d)),
    audit: {
      id: `audit-${day}-${at.getTime()}`,
      at: at.toISOString(),
      day,
      from: existing?.status ?? "none",
      to: status,
      reason,
    },
  };
}

/**
 * Applies a freeze to the first unplanned miss, if the user has one to spend.
 * Returns the changed days, the audit entry, and the day that was covered so
 * the caller can tell the user after the fact — §5 requires notifying, not
 * asking.
 */
export function absorbMissWithFreeze(
  days: StreakDay[],
  freezes: number,
  at: Date
): { days: StreakDay[]; audit: AuditEntry | null; coveredDay: string | null } {
  if (freezes <= 0) return { days, audit: null, coveredDay: null };

  // Walk back from the most recent finished day looking for the first miss.
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.status === "today" || d.status === "future") continue;
    if (d.status === "missed") {
      return {
        days: days.map((x) => (x.date === d.date ? { ...x, status: "freeze" as const } : x)),
        audit: {
          id: `audit-${d.date}-${at.getTime()}`,
          at: at.toISOString(),
          day: d.date,
          from: "missed",
          to: "freeze",
          reason: "Streak freeze auto-applied",
        },
        coveredDay: d.date,
      };
    }
    // Anything else that isn't a miss means there's nothing to cover.
    break;
  }
  return { days, audit: null, coveredDay: null };
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
