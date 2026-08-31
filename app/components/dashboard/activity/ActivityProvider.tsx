"use client";

// App-wide activity state. Mounted once in `DashboardShell`.
//
// This replaces the old `StreakProvider`, which owned only a per-day counter.
// The streak is now a *derivation*: applications and other qualifying actions
// are the source of truth, and a day is logged because an artifact exists for
// it — never because a button was pressed.
//
// `useStreak()` is preserved as a thin selector so `StreakPill`, `StreakPanel`,
// `StreakCalendar`, `StreakRewards` and the pod screen keep working unchanged.
//
// Mock-only: nothing persists across a reload, by design.

import { createContext, useContext, useState, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ACTION_KINDS,
  DEFAULT_HABITS,
  absorbMissWithFreeze,
  findDuplicate,
  markDay,
  medianOf,
  resolveActionDay,
  weekdayName,
  type ActionKind,
  type Application,
  type AuditEntry,
  type HabitDef,
  type QualifyingAction,
} from "@/app/lib/dashboard/activity";
import { scoreApplication, type ApplicationScore } from "@/app/lib/dashboard/ats-stub";
import { MAX_STREAK_PROMPTS_PER_DAY, balanceOf, priceOf, restoreCost, type CreditEntry, type SpendItem } from "@/app/lib/dashboard/credits";
import { INVITE_CREDITS_EARNED, SUBSCRIBED_INVITES } from "@/app/lib/dashboard/invites";
import { DEFAULT_LOG_SECONDS, clampTarget } from "@/app/lib/dashboard/goals";
import {
  addDays,
  buildInitialStreak,
  computeLongest,
  computeStreak,
  dayKey,
  fromDayKey,
  milestonesCrossed,
  nextMilestone,
  tierFor,
  weekdayIndex,
} from "@/app/lib/dashboard/streak";
import type { StreakDay, StreakMilestone, StreakState, TrackerColumnId } from "@/app/lib/dashboard/types";

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export interface GoalsState {
  weeklyTarget: number;
  /** Monday-first indices, Mon = 0 … Sun = 6. */
  restDays: number[];
  /** Hour of day the user usually job hunts, 0-23. Feeds the at-risk banner. */
  huntHour: number;
  /** Suspends streak, goals and prompts without losing the count. */
  paused: boolean;
}

const DEFAULT_GOALS: GoalsState = { weeklyTarget: 8, restDays: [5, 6], huntHour: 19, paused: false };

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface LogApplicationInput {
  company: string;
  role: string;
  location?: string;
  url?: string;
  jdText?: string;
  source?: "internal" | "external";
  /** Set when the user saved past a duplicate warning. */
  duplicateOf?: string;
  /** When the log flow opened, so the provider can time it off its own clock. */
  startedAtMs?: number;
  /** Which saved resume to score against. */
  resumeId?: string;
}

export interface LogApplicationResult {
  application: Application;
  score: ApplicationScore;
  /** Day the follow-up reminder is set for. */
  followUpOn: string;
}

interface ActivityContextValue extends StreakState {
  // --- streak slice (the old useStreak shape) ---
  todayKey: string;
  byKey: Map<string, StreakDay>;
  loggedToday: boolean;
  logPulse: number;
  logToday: () => void;
  celebrating: StreakMilestone | null;
  dismissCelebration: () => void;
  /** The milestone earned by the in-flight log, shown inline in the payoff. */
  pendingMilestone: StreakMilestone | null;

  // --- activity ---
  applications: Application[];
  actions: QualifyingAction[];
  audit: AuditEntry[];
  /** Applications logged in the current Mon-start week, duplicates excluded. */
  weeklyLogged: number;
  /** Rolling median seconds per log; falls back to the documented default. */
  medianLogSeconds: number;
  logApplication: (input: LogApplicationInput) => LogApplicationResult;
  recordAction: (kind: ActionKind, artifactId: string, label?: string) => void;
  checkDuplicate: (candidate: { company: string; role: string; url?: string }) => Application | null;

  // --- credits ---
  /** Append-only. The balance is always summed from this, never stored. */
  ledger: CreditEntry[];
  /** Spends against the ledger. Returns false when the balance won't cover it. */
  spend: (item: SpendItem, reason?: string) => boolean;
  /** What restoring the current streak would cost right now. */
  restorePrice: number;
  creditsOpen: boolean;
  openCredits: () => void;
  closeCredits: () => void;

  // --- repair ---
  /**
   * Set when a streak has just been broken and is still inside the buy-back
   * window. Null the rest of the time.
   */
  repair: { brokenStreak: number; hoursSinceBreak: number } | null;
  /** Buys the broken streak back at full price. False if unaffordable. */
  restoreStreak: () => boolean;
  /** The once-a-month free fallback: restores half, rounded down. */
  halfRestoreStreak: () => void;
  freeRestoreUsed: boolean;
  dismissRepair: () => void;
  /**
   * Breaks the streak on demand.
   *
   * Only exists because this build has no clock: a streak breaks at local
   * midnight after a day with no qualifying action, which can never happen
   * inside one mock session. Without it the repair and comeback screens are
   * unreachable dead code. Delete this the moment there's a real scheduler.
   */
  simulateBreak: () => void;

  // --- at-risk prompting ---
  /** Local hour, read once on mount. Gates the after-8pm banner. */
  nowHour: number;
  atRiskDismissed: boolean;
  dismissAtRisk: () => void;
  /** Prompts shown today, capped per §8 so this never becomes nagging. */
  promptsToday: number;

  // --- log dialog ---
  /**
   * Owned here rather than per-screen so the dialog is mounted once, and so the
   * milestone celebration can hold off while it's open — stacking a second
   * modal on top of the payoff panel buries the very thing the user just earned.
   */
  logOpen: boolean;
  openLog: () => void;
  closeLog: () => void;

  // --- daily habits ---
  /** The user's habit definitions, each bound to an artifact type. */
  habits: HabitDef[];
  /** Habits with today's completion resolved from the action log. */
  habitsToday: (HabitDef & { done: boolean })[];
  addHabit: () => void;
  updateHabit: (id: string, patch: Partial<Omit<HabitDef, "id">>) => void;
  removeHabit: (id: string) => void;

  // --- goals ---
  goals: GoalsState;
  setWeeklyTarget: (n: number) => void;
  /** Moves the target by `delta`, clamped. Used by press-and-hold. */
  nudgeWeeklyTarget: (delta: number) => void;
  toggleRestDay: (index: number) => void;
  setHuntHour: (h: number) => void;
  setPaused: (p: boolean) => void;
  /** Pauses the search for N days: streak held, prompts silenced. */
  pauseSearch: (days: number) => void;
  resumeSearch: () => void;
  /** Days remaining on a pause, or null when not paused. */
  pausedDaysLeft: number | null;

  // --- hired ---
  hired: boolean;
  /** Retires the streak with its final count preserved. */
  markHired: () => void;
  /** The count the streak was retired at. */
  retiredStreak: number | null;
}

const ActivityCtx = createContext<ActivityContextValue | null>(null);

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

export const ActivityProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Read once, lazily — calling Date during render violates the react-hooks
  // purity rule, and this also keeps "today" stable if a tab is left open.
  const [today] = useState(() => new Date());
  const [goals, setGoals] = useState<GoalsState>(DEFAULT_GOALS);

  // Seeded from the default rest days so the calendar agrees with the "Sat &
  // Sun are rest days" copy. Changing rest days afterwards affects the daily
  // maths and future days but deliberately does not rewrite history —
  // retroactively re-colouring past days would be a lie.
  const [state, setState] = useState<StreakState>(() => buildInitialStreak(today, DEFAULT_GOALS.restDays));
  const [applications, setApplications] = useState<Application[]>([]);
  const [actions, setActions] = useState<QualifyingAction[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [logDurations, setLogDurations] = useState<number[]>([]);
  const [queue, setQueue] = useState<StreakMilestone[]>([]);
  const [logPulse, setLogPulse] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const [habits, setHabits] = useState<HabitDef[]>(DEFAULT_HABITS);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [freeRestoreUsed, setFreeRestoreUsed] = useState(false);
  const [repairDismissed, setRepairDismissed] = useState(false);
  /** Streak length at the moment it broke, so it can be bought back. */
  const [brokenStreak, setBrokenStreak] = useState<number | null>(null);
  const [atRiskDismissed, setAtRiskDismissed] = useState(false);
  const [pausedDaysLeft, setPausedDaysLeft] = useState<number | null>(null);
  const [retiredStreak, setRetiredStreak] = useState<number | null>(null);
  // Seeded from the invites that actually subscribed, as a single opening
  // entry — so the balance, the "Earned" block in the credit modal and the
  // invites screen are three views of one number rather than three constants
  // free to drift. The old seed was a hardcoded 18 that agreed with nothing.
  const [ledger, setLedger] = useState<CreditEntry[]>(() => [
    {
      id: "credit-invites",
      delta: INVITE_CREDITS_EARNED,
      reason: `${SUBSCRIBED_INVITES.length} invites subscribed`,
      at: today.toISOString(),
    },
  ]);

  const todayKey = dayKey(today);
  const byKey = new Map(state.days.map((d) => [d.date, d]));
  const loggedToday = byKey.get(todayKey)?.status === "logged" || byKey.get(todayKey)?.status === "backfilled";
  const medianLogSeconds = logDurations.length >= 3 ? medianOf(logDurations) : DEFAULT_LOG_SECONDS;

  // A habit is done when its bound artifact exists for today. There is no
  // habit "done" state to set — it is read from the action log, so the only
  // way to complete one is to do the thing.
  const habitsToday = habits.map((h) => ({
    ...h,
    done: actions.some((a) => a.kind === h.kind && a.day === todayKey),
  }));

  // Applications this week, Monday-start, duplicates excluded so re-logging the
  // same role can't inflate the weekly number.
  const weekStart = addDays(today, -weekdayIndex(today)).getTime();
  const weeklyLogged = applications.filter((a) => !a.duplicateOf && new Date(a.loggedAt).getTime() >= weekStart).length;

  /**
   * The single path by which a day becomes logged. Everything else — the
   * header button, the weekly strip, the pod's "Log one" — routes through here
   * or through `recordAction`, so there is exactly one place where the streak
   * can move and exactly one place that writes the audit trail.
   */
  function applyQualifyingAction(kind: ActionKind, artifactId: string, at: Date, reasonLabel?: string) {
    const day = resolveActionDay(at);
    const reason = reasonLabel ?? ACTION_KINDS[kind].label;

    setActions((prev) => [...prev, { id: nextId("act"), kind, artifactId, at: at.toISOString(), day }]);

    const before = state.current;
    const marked = markDay(state.days, day, "logged", reason, at);
    let days = marked.days;
    const auditRows: AuditEntry[] = marked.audit ? [marked.audit] : [];

    // If there's an unplanned miss sitting behind us and a freeze to spend,
    // absorb it and tell the user after the fact — never ask permission.
    const absorbed = absorbMissWithFreeze(days, state.freezes, at);
    let freezesSpent = 0;
    if (absorbed.coveredDay) {
      days = absorbed.days;
      freezesSpent = 1;
      if (absorbed.audit) auditRows.push(absorbed.audit);
    }

    const current = computeStreak(days);
    const earned = milestonesCrossed(before, current, state.claimed);
    const freezesEarned = earned.reduce((n, m) => {
      // "+2 streak freezes" grants two, not one — the old code counted rungs,
      // not freezes, so the 60-day reward silently paid out half.
      const match = m.perk?.match(/\+(\d+) streak freeze/);
      return n + (match ? Number(match[1]) : 0);
    }, 0);

    setState((prev) => ({
      ...prev,
      days,
      current,
      longest: Math.max(computeLongest(days), current),
      claimed: [...prev.claimed, ...earned.map((m) => m.days)],
      freezes: prev.freezes - freezesSpent + freezesEarned,
    }));
    if (earned.length > 0) {
      setLedger((prev) => [
        ...prev,
        ...earned.map((m) => ({
          id: nextId("credit"),
          delta: m.credits,
          reason: `${m.label} reached`,
          refId: String(m.days),
          at: at.toISOString(),
        })),
      ]);
    }
    if (auditRows.length) setAudit((prev) => [...prev, ...auditRows]);
    setLogPulse((n) => n + 1);

    // Side effects stay out of the setState updaters — React may run those more
    // than once in development.
    if (absorbed.coveredDay) {
      const left = state.freezes - 1 + freezesEarned;
      toast(`A freeze covered ${weekdayName(absorbed.coveredDay)}.`, {
        description: `${left} ${left === 1 ? "freeze" : "freezes"} left.`,
      });
    }

    if (earned.length > 0) {
      setQueue((prev) => [...prev, ...earned]);
      return;
    }

    if (marked.audit === null && kind === "application") return; // already logged today; the payoff panel is the feedback

    const upcoming = nextMilestone(current);
    toast.success(`${current}-day streak`, {
      description: upcoming
        ? `${upcoming.days - current} more ${upcoming.days - current === 1 ? "day" : "days"} to ${upcoming.label}.`
        : "You are past every milestone.",
    });
  }

  function logApplication(input: LogApplicationInput): LogApplicationResult {
    const at = new Date();
    const score = scoreApplication(input.resumeId ?? "res-master", input.jdText);

    const application: Application = {
      id: nextId("app"),
      company: input.company.trim(),
      role: input.role.trim(),
      location: input.location?.trim() || undefined,
      url: input.url?.trim() || undefined,
      jdText: input.jdText,
      source: input.source ?? "external",
      loggedAt: at.toISOString(),
      status: "applied" as TrackerColumnId,
      duplicateOf: input.duplicateOf,
      atsScore: score.score,
    };

    setApplications((prev) => [application, ...prev]);
    if (input.startedAtMs) {
      const seconds = Math.round((at.getTime() - input.startedAtMs) / 1000);
      if (seconds > 0) setLogDurations((prev) => [...prev, seconds].slice(-20));
    }
    applyQualifyingAction("application", application.id, at);

    return { application, score, followUpOn: dayKey(addDays(at, 7)) };
  }

  function recordAction(kind: ActionKind, artifactId: string, label?: string) {
    applyQualifyingAction(kind, artifactId, new Date(), label);
  }

  function checkDuplicate(candidate: { company: string; role: string; url?: string }) {
    return findDuplicate(candidate, applications, today);
  }

  /**
   * Legacy entry point kept so existing call sites compile. It is deliberately
   * NOT a naked day-marker any more — with no artifact it cannot qualify a day,
   * so it routes to the log dialog instead via the returned no-op plus a nudge.
   */
  function logToday() {
    toast("Log an application to keep your streak", {
      description: "A day counts when something real gets created.",
    });
  }

  function spend(item: SpendItem, reason?: string): boolean {
    const cost = priceOf(item, state.current);
    if (balanceOf(ledger) < cost) return false;
    setLedger((prev) => [
      ...prev,
      { id: nextId("credit"), delta: -cost, reason: reason ?? item.label, refId: item.id, at: new Date().toISOString() },
    ]);
    if (item.id === "freeze") setState((prev) => ({ ...prev, freezes: prev.freezes + 1 }));
    toast.success(`${item.label} — ${cost} credits`, { description: `${balanceOf(ledger) - cost} credits left.` });
    return true;
  }

  const value: ActivityContextValue = {
    ...state,
    // Derived, never stored. Four independent "balances" used to drift apart
    // the moment anything was earned; there is now one list and one sum.
    credits: balanceOf(ledger),
    ledger,
    spend,
    restorePrice: restoreCost(state.current),
    todayKey,
    byKey,
    loggedToday,
    logPulse,
    logToday,
    // Held back while the log dialog is open; the payoff panel surfaces the
    // milestone inline instead, and the full celebration plays on close.
    celebrating: logOpen ? null : (queue[0] ?? null),
    dismissCelebration: () => setQueue((prev) => prev.slice(1)),
    /** What was earned by the log currently being shown, for the payoff panel. */
    pendingMilestone: queue[0] ?? null,

    applications,
    actions,
    audit,
    weeklyLogged,
    medianLogSeconds,
    logApplication,
    recordAction,
    checkDuplicate,

    creditsOpen,
    openCredits: () => setCreditsOpen(true),
    closeCredits: () => setCreditsOpen(false),

    repair: brokenStreak !== null && !repairDismissed ? { brokenStreak, hoursSinceBreak: 6 } : null,
    freeRestoreUsed,
    dismissRepair: () => setRepairDismissed(true),
    nowHour: today.getHours(),
    atRiskDismissed,
    dismissAtRisk: () => setAtRiskDismissed(true),
    // One banner + one hunt-hour prompt is the daily ceiling.
    promptsToday: atRiskDismissed ? MAX_STREAK_PROMPTS_PER_DAY : 1,
    simulateBreak: () => {
      if (state.current === 0) return;
      setBrokenStreak(state.current);
      setRepairDismissed(false);
      setState((prev) => ({ ...prev, current: 0 }));
      setAudit((prev) => [
        ...prev,
        {
          id: nextId("audit"),
          at: new Date().toISOString(),
          day: todayKey,
          from: "logged",
          to: "missed",
          reason: "Streak broken — no qualifying action",
        },
      ]);
    },
    restoreStreak: () => {
      if (brokenStreak === null) return false;
      const cost = restoreCost(brokenStreak);
      if (balanceOf(ledger) < cost) return false;
      setLedger((prev) => [
        ...prev,
        { id: nextId("credit"), delta: -cost, reason: `Streak restored (${brokenStreak} days)`, at: new Date().toISOString() },
      ]);
      setState((prev) => ({ ...prev, current: brokenStreak }));
      setBrokenStreak(null);
      toast.success(`${brokenStreak}-day streak restored.`, { description: `${balanceOf(ledger) - cost} credits left.` });
      return true;
    },
    halfRestoreStreak: () => {
      if (brokenStreak === null) return;
      const half = Math.floor(brokenStreak / 2);
      setState((prev) => ({ ...prev, current: half }));
      setFreeRestoreUsed(true);
      setBrokenStreak(null);
      toast(`${half} days restored, free.`, { description: "One free restore every 30 days." });
    },

    habits,
    habitsToday,
    addHabit: () =>
      setHabits((prev) => [...prev, { id: nextId("habit"), label: "New habit", kind: "application" }]),
    updateHabit: (id, patch) => setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h))),
    removeHabit: (id) => setHabits((prev) => prev.filter((h) => h.id !== id)),

    logOpen,
    openLog: () => setLogOpen(true),
    closeLog: () => setLogOpen(false),

    goals,
    setWeeklyTarget: (n) => setGoals((g) => ({ ...g, weeklyTarget: clampTarget(n) })),
    nudgeWeeklyTarget: (delta) => setGoals((g) => ({ ...g, weeklyTarget: clampTarget(g.weeklyTarget + delta) })),
    toggleRestDay: (index) =>
      setGoals((g) => ({
        ...g,
        restDays: g.restDays.includes(index) ? g.restDays.filter((d) => d !== index) : [...g.restDays, index].sort(),
      })),
    setHuntHour: (h) => setGoals((g) => ({ ...g, huntHour: h })),
    setPaused: (p) => setGoals((g) => ({ ...g, paused: p })),
    pauseSearch: (days) => {
      // A pause is not a break: the count is held exactly where it is, and
      // every prompt goes quiet. People take time off; punishing that is how
      // you lose them for good.
      setPausedDaysLeft(days);
      setGoals((g) => ({ ...g, paused: true }));
      toast.success(`Search paused for ${days} days.`, { description: `Your ${state.current}-day streak is held.` });
    },
    resumeSearch: () => {
      setPausedDaysLeft(null);
      setGoals((g) => ({ ...g, paused: false }));
      toast.success("Welcome back.", { description: `Your ${state.current}-day streak is still yours.` });
    },
    pausedDaysLeft,

    hired: retiredStreak !== null,
    retiredStreak,
    markHired: () => {
      setRetiredStreak(state.current);
      setGoals((g) => ({ ...g, paused: true }));
    },
  };

  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
};

/** Full activity state. Throws outside the provider so misuse is loud. */
export function useActivity(): ActivityContextValue {
  const ctx = useContext(ActivityCtx);
  if (!ctx) throw new Error("useActivity must be used inside an ActivityProvider");
  return ctx;
}

/** Streak-only selector — the shape the streak components already consume. */
export function useStreak(): ActivityContextValue {
  return useActivity();
}

/** Convenience: the tier for the current streak. */
export function useStreakTier() {
  return tierFor(useActivity().current);
}

/** Re-exported so callers don't need a second import for day maths. */
export { fromDayKey };
