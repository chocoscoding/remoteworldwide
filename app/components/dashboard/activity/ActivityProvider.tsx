"use client";

// App-wide activity state. Mounted once in `DashboardShell`.
//
// A thin React Query layer over the server. The streak, freezes, gifts,
// repairs, habits and the audit trail used to be browser state seeded from a
// fabricated 13-day history; they are now the backend's, derived from the
// append-only activity log (remoteworldwidebackend/src/types/streak.ts):
//
//  - `GET /api/streak` answers with the run as the server decided it — in the
//    user's timezone, with the 4am grace hour, rest days, pauses and automatic
//    freezes applied. Nothing here computes a streak.
//  - A day counts because the server wrote an artifact for it. Logging an
//    application, moving a card, posting to the pod, asking for a referral and
//    finishing a prep session each record their own action where the artifact
//    is written, so `recordAction` sends nothing for those kinds — it would
//    count them twice. The one kind the server cannot see is a follow-up logged
//    from the tracker, which `recordAction` reports against its application.
//  - Gifts, freezes and repairs are server writes; this answers with what the
//    server stored.
//
// The context API is kept as it was, so every screen that calls
// `recordAction`, `awardStrongEvent` or reads the streak keeps working.
// `useStreak()` is a thin selector over the same value.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ACTION_KINDS,
  DEFAULT_HABITS,
  findDuplicate,
  medianOf,
  weekdayName,
  type ActionKind,
  type Application,
  type AuditEntry,
  type HabitDef,
  dailyTargetFrom,
} from "@/app/lib/dashboard/activity";
import { MAX_STREAK_PROMPTS_PER_DAY } from "@/app/lib/dashboard/credits";
import { GIFT_CATALOGUE, type GiftEvent, type GiftKind } from "@/app/lib/dashboard/gifts";
import type { StrongEventKind } from "@/app/lib/dashboard/rewards";
import { DEFAULT_LOG_SECONDS, clampTarget } from "@/app/lib/dashboard/goals";
import { addDays, dayKey, fromDayKey, milestonesUpTo, nextMilestone, tierFor, weekdayIndex } from "@/app/lib/dashboard/streak";
import { FOLLOW_UP_AFTER_APPLY_DAYS } from "@/app/lib/dashboard/follow-up";
import type { StreakDay, StreakMilestone, StreakState, TrackerColumnId } from "@/app/lib/dashboard/types";
import { applicationInput, isObjectId, newClientId, toActivityApplication, wasApplied } from "@/app/lib/applications/api";
import type { GoalsItem, UpdateGoalsInput } from "@/app/lib/applications/types";
import type { GiftItem, StreakDayItem, StreakItem } from "@/app/lib/streak/types";
import { useCreateApplication, useUpdateGoals } from "@/hooks/mutations/useApplicationMutations";
import {
  refreshStreak,
  useDismissRepair,
  useMarkStreakSeen,
  useRedeemGift,
  useRepairStreak,
  useReportFollowUp,
  useRetireStreak,
} from "@/hooks/mutations/useStreakMutations";
import { useApplications, useGoals } from "@/hooks/queries/useApplicationsQuery";
import { useGiftsQuery, useStreakQuery } from "@/hooks/queries/useStreakQuery";
import { qk } from "@/app/lib/query/keys";

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

function goalsStateOf(row: GoalsItem): GoalsState {
  return { weeklyTarget: row.weeklyTarget, restDays: row.restDays, huntHour: row.huntHour, paused: row.paused };
}

/** What `update` changed, as a PATCH body: a save carries only the fields that moved. */
function changedGoals(before: GoalsState, update: (g: GoalsState) => GoalsState): UpdateGoalsInput {
  const after = update(before);
  const patch: UpdateGoalsInput = {};
  if (after.weeklyTarget !== before.weeklyTarget) patch.weeklyTarget = after.weeklyTarget;
  if (after.huntHour !== before.huntHour) patch.huntHour = after.huntHour;
  if (after.paused !== before.paused) patch.paused = after.paused;
  if (after.restDays.join() !== before.restDays.join()) patch.restDays = after.restDays;
  return patch;
}

// ---------------------------------------------------------------------------
// Reading the server's streak
// ---------------------------------------------------------------------------

/** Qualifying actions on one day, whatever their kind. */
const countOf = (kinds: StreakDayItem["kinds"]): number => Object.values(kinds).reduce<number>((sum, n) => sum + (n ?? 0), 0);

/**
 * A day's weighted intensity (`ACTION_KINDS[kind].intensityWeight`) — what the
 * full-day bar reads. The server counts actions; the weights stay the
 * browser's, beside the copy that explains them.
 */
const intensityOf = (kinds: StreakDayItem["kinds"]): number =>
  (Object.entries(kinds) as [ActionKind, number][]).reduce((sum, [kind, n]) => sum + (ACTION_KINDS[kind]?.intensityWeight ?? 0) * n, 0);

const dayOf = (item: StreakDayItem): StreakDay => ({ date: item.date, status: item.status, count: countOf(item.kinds), intensity: intensityOf(item.kinds) });

const giftEventOf = (gift: GiftItem): GiftEvent => ({
  id: gift.id,
  kind: gift.kind,
  reason: gift.reason,
  refId: gift.refId ?? undefined,
  at: gift.at,
  usedAt: gift.usedAt ?? undefined,
});

/** A reached rung as the celebration renders it: the ladder's copy, with the gift the server drew. */
function milestoneOf(days: number, gift: GiftKind): StreakMilestone | null {
  const rung = milestonesUpTo(days).find((m) => m.days === days);
  return rung ? { ...rung, gift } : null;
}

const EMPTY_DAYS: StreakDayItem[] = [];
const EMPTY_GIFTS: GiftItem[] = [];

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
  /**
   * The score of a REAL scan of this posting, when the log flow found one on
   * file (`useStoredScanQuery`) — stamped on the application as its ATS score.
   * Absent when the posting was never scanned: the application then carries no
   * score at all, rather than an estimate presented as one.
   */
  atsScore?: number | null;
}

/**
 * What the payoff panel opens on. There is no score here any more: logging
 * used to compute a keyword-overlap estimate and hand it over as the match. The
 * panel now reads the posting's stored scan itself — or says it has none.
 */
export interface LogApplicationResult {
  application: Application;
  /** Day the follow-up reminder is set for. */
  followUpOn: string;
}

/** The break that can still be bought back, as the repair panel renders it. */
export interface RepairOffer {
  brokenStreak: number;
  hoursSinceBreak: number;
  hoursLeft: number;
  /** Credits a repair costs — the server's price, never hard-coded here. */
  priceCredits: number;
  restoreHeld: boolean;
  freeHalfAvailable: boolean;
  halfDays: number;
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
  /** True until the first streak read has answered. */
  streakLoading: boolean;

  // --- activity ---
  applications: Application[];
  audit: AuditEntry[];
  /** Applications logged in the current Mon-start week, duplicates excluded. */
  weeklyLogged: number;
  /** Rolling median seconds per log; falls back to the documented default. */
  medianLogSeconds: number;
  logApplication: (input: LogApplicationInput) => LogApplicationResult;
  /**
   * Tells the streak an action happened. The server records every kind itself
   * where the artifact is written — except a follow-up logged from the
   * tracker, which is reported here against its application. Either way the
   * streak refreshes and the flame bursts.
   */
  recordAction: (kind: ActionKind, artifactId: string, label?: string) => void;
  checkDuplicate: (candidate: { company: string; role: string; url?: string }) => Application | null;

  // --- intensity (what the full-day bar reads) ---
  /** Per-day bar, derived from the weekly goal — 8/week => 2 a day. */
  dailyTarget: number;
  /** Today's weighted intensity so far. */
  todayIntensity: number;

  // --- freezes, two tiers ---
  /** Free weekly allowance left (2/week, use-it-or-lose-it, no rollover). */
  freeFreezes: number;
  /** Purchased + milestone-perk stock. Spent only after the free tier. */
  heldFreezes: number;

  // --- gifts (the reward economy: no shop, no prices) ---
  /** Every gift ever granted, used or not. History reads straight off this. */
  gifts: GiftEvent[];
  /** Unused gifts waiting to be redeemed. */
  giftsWaiting: number;
  /** Redeems the oldest unused gift of `kind`. Returns false when none is held. */
  redeemGift: (kind: GiftKind) => boolean;
  /**
   * Rare-event gifts are the server's now: reaching interview or offer pays
   * when the status change is saved, the weekly goal when the week's
   * applications meet it. Kept so existing call sites compile; always false.
   */
  awardStrongEvent: (kind: StrongEventKind, suffix: string, detail?: string) => boolean;
  giftsOpen: boolean;
  openGifts: () => void;
  closeGifts: () => void;
  /** @deprecated aliases kept while surfaces migrate — same modal. */
  creditsOpen: boolean;
  openCredits: () => void;
  closeCredits: () => void;

  // --- repair ---
  /** Set while a broken streak can still be bought back. Null the rest of the time. */
  repair: RepairOffer | null;
  /** Buys the broken streak back with a restore gift. False when none is held. */
  restoreStreak: () => boolean;
  /** Buys it back with credits — a ledger spend at the server's price. */
  repairWithCredits: () => void;
  /** The once-a-month free fallback: restores half, rounded down. */
  halfRestoreStreak: () => void;
  freeRestoreUsed: boolean;
  /** A repair is on its way to the server. */
  repairing: boolean;
  /** Hides the repair panel for now; the offer stands until its window closes. */
  dismissRepair: () => void;
  /** "Start from zero instead": the deliberate choice, remembered by the server. */
  startOverFromZero: () => void;

  // --- at-risk prompting ---
  /** The hour on the user's own clock. Gates the after-8pm banner. */
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
  /** The user's habit definitions, each bound to an artifact type. Saved on the goals row. */
  habits: HabitDef[];
  /** Habits with today's completion read from the server's day. */
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
  /** Days remaining on a pause, or null when not paused or paused with no end date. */
  pausedDaysLeft: number | null;

  // --- hired ---
  hired: boolean;
  /** Retires the streak with its final count preserved. */
  markHired: () => void;
  /** The count the streak was retired at. */
  retiredStreak: number | null;
}

const ActivityCtx = createContext<ActivityContextValue | null>(null);

export const ActivityProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  // Read once, lazily — calling Date during render violates the react-hooks
  // purity rule. Only a stand-in until the server's own "today" arrives.
  const [now] = useState(() => new Date());

  // Goals are a row on the server. Until it loads the defaults stand in, the
  // same numbers a user who never set any gets back.
  const goalsQuery = useGoals();
  const goals = useMemo(() => (goalsQuery.data ? goalsStateOf(goalsQuery.data) : DEFAULT_GOALS), [goalsQuery.data]);
  const writeGoals = useUpdateGoals();

  /**
   * The old state setter's shape, so every goals setter below reads as it
   * always has. The updater runs against the goals cached at the moment of the
   * call, because press-and-hold keeps calling a setter captured on the render
   * the hold began; only the fields it changed are saved.
   */
  function setGoals(update: (g: GoalsState) => GoalsState) {
    writeGoals((current) => changedGoals(current ? goalsStateOf(current) : DEFAULT_GOALS, update));
  }

  // The streak and the gifts, as the server decided them.
  const streakQuery = useStreakQuery();
  const streak: StreakItem | undefined = streakQuery.data;
  const giftsQuery = useGiftsQuery();
  const giftItems = giftsQuery.data?.gifts ?? EMPTY_GIFTS;
  const redeem = useRedeemGift();
  const repairMutation = useRepairStreak();
  const dismiss = useDismissRepair();
  const markSeen = useMarkStreakSeen();
  const retire = useRetireStreak();
  const reportFollowUp = useReportFollowUp();

  // The applications table, as `activity.ts` records. Saved jobs are left out:
  // a job someone means to apply to is not an application yet, and counting one
  // would lift the weekly number, the applications-sent total and the duplicate
  // warning before anything was sent.
  const applicationsQuery = useApplications();
  const applications = useMemo(
    () => (applicationsQuery.data ?? []).filter(wasApplied).map(toActivityApplication),
    [applicationsQuery.data],
  );
  const createApplication = useCreateApplication();
  const [logDurations, setLogDurations] = useState<number[]>([]);
  const [logPulse, setLogPulse] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [atRiskDismissed, setAtRiskDismissed] = useState(false);
  // The break whose repair panel was closed this session. Closing is not a
  // decision — an overlay click must not throw a streak away — so only the
  // explicit "start from zero" is sent to the server.
  const [repairHiddenFor, setRepairHiddenFor] = useState<string | null>(null);

  const todayKey = streak?.today ?? dayKey(now);
  const streakDays = streak?.days ?? EMPTY_DAYS;
  const days = useMemo(() => streakDays.map(dayOf), [streakDays]);
  const byKey = new Map(days.map((d) => [d.date, d]));
  const todayItem = streakDays.find((d) => d.date === todayKey);
  const current = streak?.current ?? 0;
  const longest = streak?.longest ?? 0;
  const loggedToday = streak?.loggedToday ?? false;
  const freeFreezes = streak?.freezes.free ?? 0;
  const heldFreezes = streak?.freezes.held ?? 0;
  const gifts = useMemo(() => giftItems.map(giftEventOf), [giftItems]);
  const retiredStreak = streak?.retiredStreak ?? null;
  const medianLogSeconds = logDurations.length >= 3 ? medianOf(logDurations) : DEFAULT_LOG_SECONDS;

  // Rungs reached and not yet celebrated, in the order they were earned. Seen
  // is the server's, so a rung reached by a prep session finished elsewhere
  // still gets its moment, once, wherever the user looks next.
  const queue = (streak?.milestones ?? [])
    .filter((m) => !m.seen)
    .sort((a, b) => a.days - b.days)
    .map((m) => milestoneOf(m.days, m.gift))
    .filter((m): m is StreakMilestone => m !== null);

  // Habits live on the goals row; the defaults stand in until it loads.
  const habits: HabitDef[] = goalsQuery.data?.habits ?? DEFAULT_HABITS;
  // A habit is done when its bound artifact exists for today — read from the
  // server's day, so the only way to complete one is to do the thing.
  const habitsToday = habits.map((h) => ({ ...h, done: (todayItem?.kinds[h.kind] ?? 0) > 0 }));

  const dailyTarget = dailyTargetFrom(goals.weeklyTarget);
  const todayIntensity = todayItem ? intensityOf(todayItem.kinds) : 0;

  // Applications this week, Monday-start, duplicates excluded so re-logging the
  // same role can't inflate the weekly number.
  const today = fromDayKey(todayKey);
  const weekStart = addDays(today, -weekdayIndex(today)).getTime();
  const weeklyLogged = applications.filter((a) => !a.duplicateOf && new Date(a.loggedAt).getTime() >= weekStart).length;

  // Whole days to the pause's end, never below zero. Null when the search isn't
  // paused, and for a pause with no end date (hired, or paused from settings).
  const pauseEndsOn = goalsQuery.data?.pauseEndsOn ?? null;
  const pausedDaysLeft =
    goals.paused && pauseEndsOn !== null
      ? Math.max(0, Math.round((fromDayKey(pauseEndsOn).getTime() - fromDayKey(todayKey).getTime()) / 86_400_000))
      : null;

  // ------------------------------------------------------------------
  // Telling the user what the server did. Toasts are side effects, so they
  // live in effects keyed on the server's answer — never in render. Refs hold
  // what has already been said, so a re-render (or React's development double
  // run) cannot say it twice.
  // ------------------------------------------------------------------

  // The run grew: say so, pointing at the next rung. A rung reached is the
  // celebration's to announce, so the toast stays out of its way.
  const lastCount = useRef<number | null>(null);
  const hasUnseenRung = queue.length > 0;
  useEffect(() => {
    if (!streak) return;
    const before = lastCount.current;
    lastCount.current = streak.current;
    if (before === null || streak.current <= before || hasUnseenRung) return;
    const upcoming = nextMilestone(streak.current);
    toast.success(`${streak.current}-day streak`, {
      id: "streak-grew",
      description: `${upcoming.days - streak.current} more ${upcoming.days - streak.current === 1 ? "day" : "days"} to ${upcoming.label}.`,
    });
  }, [streak, hasUnseenRung]);

  // Freezes spent on their own: told after the fact, never asked (doc §4), once.
  const told = useRef(new Set<string>());
  const markSeenNow = markSeen.mutate;
  useEffect(() => {
    const fresh = (streak?.notices ?? []).filter((notice) => !told.current.has(notice.day));
    if (!streak || fresh.length === 0) return;
    for (const notice of fresh) told.current.add(notice.day);
    const left = streak.freezes.free + streak.freezes.held;
    toast(`Life happened — a freeze covered ${fresh.map((notice) => weekdayName(notice.day)).join(" and ")}.`, {
      description: `Your streak never broke. ${left} ${left === 1 ? "freeze" : "freezes"} left.`,
    });
    markSeenNow({ freezes: fresh.map((notice) => notice.day) });
  }, [streak, markSeenNow]);

  // The gift list follows the streak's count of waiting gifts: when the server
  // granted one (a status change reaching interview, the weekly goal), the list
  // is fetched again. New gifts get one quiet toast; a rung's gift is the
  // celebration's to announce.
  const waitingOnServer = streak?.giftsWaiting;
  const waitingInList = giftsQuery.data ? giftItems.filter((g) => !g.usedAt).length : undefined;
  const giftsFetching = giftsQuery.isFetching;
  // Once per count the server reports, so a list that can never match (one
  // capped at its page size) cannot turn this into a refetch loop.
  const refetchedFor = useRef<number | null>(null);
  useEffect(() => {
    if (waitingOnServer === undefined || waitingInList === undefined || waitingOnServer === waitingInList || giftsFetching) return;
    if (refetchedFor.current === waitingOnServer) return;
    refetchedFor.current = waitingOnServer;
    void queryClient.invalidateQueries({ queryKey: qkGifts });
  }, [waitingOnServer, waitingInList, giftsFetching, queryClient]);

  const knownGifts = useRef<Set<string> | null>(null);
  const giftsLoaded = giftsQuery.data !== undefined;
  useEffect(() => {
    if (!giftsLoaded) return;
    if (knownGifts.current === null) {
      knownGifts.current = new Set(giftItems.map((g) => g.id));
      return;
    }
    const known = knownGifts.current;
    const fresh = giftItems.filter((g) => !known.has(g.id));
    for (const g of fresh) known.add(g.id);
    const announce = fresh.filter((g) => !g.usedAt && !g.refId?.startsWith("milestone:"));
    if (announce.length === 0) return;
    toast.success(`\u{1F381} ${announce.map((g) => GIFT_CATALOGUE[g.kind].label).join(" · ")}`, {
      description: `${announce.map((g) => g.reason).join(" · ")} — waiting in your gifts.`,
    });
  }, [giftsLoaded, giftItems]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  function logApplication(input: LogApplicationInput): LogApplicationResult {
    const at = new Date();

    const application: Application = {
      id: newClientId("app"),
      company: input.company.trim(),
      role: input.role.trim(),
      location: input.location?.trim() || undefined,
      url: input.url?.trim() || undefined,
      jdText: input.jdText,
      source: input.source ?? "external",
      loggedAt: at.toISOString(),
      status: "applied" as TrackerColumnId,
      duplicateOf: input.duplicateOf,
      // Only ever a real scan's number, and only when the log flow found one.
      // This used to be a keyword-overlap estimate against mock keywords,
      // saved to the tracker as if it were a measurement.
      atsScore: typeof input.atsScore === "number" ? input.atsScore : undefined,
    };

    // Returned now, saved behind: the payoff panel never waits on a round trip.
    // The id doubles as the idempotency key, so the failure toast's Retry saves
    // this application once even if the first request did land. The server
    // records the day's action with the row, and the write refreshes the streak
    // once it settles.
    createApplication({
      clientId: application.id,
      input: applicationInput({
        company: application.company,
        role: application.role,
        location: application.location,
        url: application.url,
        source: application.source,
        status: "applied",
        duplicateOf: application.duplicateOf,
        atsScore: application.atsScore,
      }),
    });
    if (input.startedAtMs) {
      const seconds = Math.round((at.getTime() - input.startedAtMs) / 1000);
      if (seconds > 0) setLogDurations((prev) => [...prev, seconds].slice(-20));
    }
    setLogPulse((n) => n + 1);

    // The same constant the follow-up engine nudges on, so the promise made
    // here and the nudge that delivers it can never drift apart.
    return { application, followUpOn: dayKey(addDays(at, FOLLOW_UP_AFTER_APPLY_DAYS)) };
  }

  function recordAction(kind: ActionKind, artifactId: string, label?: string) {
    void label; // the server writes its own reason; nothing a user typed reaches the log
    setLogPulse((n) => n + 1);
    if (kind === "follow-up") {
      // The one action the server cannot see: reported against its application.
      // A row whose create is still in flight has no server id yet; the touch
      // the tracker sends with it records the same follow-up once it lands.
      if (isObjectId(artifactId)) reportFollowUp.mutate(artifactId);
      return;
    }
    // A referral ask or pod post has already been written — and its action with
    // it — by the time a screen calls this, so the streak can refresh now.
    // Applications and status changes refresh when their own write settles.
    if (kind === "message" || kind === "prep") refreshStreak(queryClient);
  }

  function awardStrongEvent(kind: StrongEventKind, suffix: string, detail?: string): boolean {
    void kind;
    void suffix;
    void detail;
    return false;
  }

  function redeemGift(kind: GiftKind): boolean {
    if (!gifts.some((g) => g.kind === kind && !g.usedAt)) return false;
    redeem.mutate(kind, {
      onSuccess: () =>
        toast.success(`${GIFT_CATALOGUE[kind].label} used`, {
          description:
            kind === "rewrite" || kind === "pro-day" || kind === "referral-intro"
              ? "It's noted on your account — we'll be in touch to deliver it."
              : undefined,
        }),
    });
    return true;
  }

  function checkDuplicate(candidate: { company: string; role: string; url?: string }) {
    return findDuplicate(candidate, applications, now);
  }

  /**
   * Legacy entry point kept so existing call sites compile. It is deliberately
   * NOT a naked day-marker — with no artifact it cannot qualify a day, so it
   * nudges toward logging something real.
   */
  function logToday() {
    toast("Log an application to keep your streak", {
      description: "A day counts when something real gets created.",
    });
  }

  const offer = streak?.repair && streak.repair.day !== repairHiddenFor ? streak.repair : null;
  const repair: RepairOffer | null = offer
    ? {
        brokenStreak: offer.brokenStreak,
        hoursSinceBreak: offer.hoursSinceBreak,
        hoursLeft: offer.hoursLeft,
        priceCredits: offer.priceCredits,
        restoreHeld: offer.restoreHeld,
        freeHalfAvailable: offer.freeHalfAvailable,
        halfDays: offer.halfDays,
      }
    : null;

  const audit: AuditEntry[] = (streak?.audit ?? []).map((row) => ({ id: row.id, at: row.at, day: row.day, from: row.from, to: row.to, reason: row.reason }));

  const value: ActivityContextValue = {
    current,
    longest,
    days,
    claimed: (streak?.milestones ?? []).map((m) => m.days),
    // Total across both tiers — existing consumers keep reading one number.
    freezes: freeFreezes + heldFreezes,
    // Referral credits are not this provider's: the invites page and the
    // sidebar's invite meter read them from the backend (useInviteSummary),
    // and the streak pays gifts, never currency. Kept at zero only because the
    // `StreakState` shape still carries the field.
    credits: 0,
    freeFreezes,
    heldFreezes,
    dailyTarget,
    todayIntensity,
    awardStrongEvent,
    gifts,
    giftsWaiting: streak?.giftsWaiting ?? gifts.filter((g) => !g.usedAt).length,
    redeemGift,
    giftsOpen,
    openGifts: () => setGiftsOpen(true),
    closeGifts: () => setGiftsOpen(false),
    creditsOpen: giftsOpen,
    openCredits: () => setGiftsOpen(true),
    closeCredits: () => setGiftsOpen(false),
    todayKey,
    byKey,
    loggedToday,
    logPulse,
    logToday,
    streakLoading: streakQuery.isPending,
    // Held back while the log dialog is open; the payoff panel surfaces the
    // milestone inline instead, and the full celebration plays on close.
    celebrating: logOpen ? null : (queue[0] ?? null),
    dismissCelebration: () => {
      if (queue[0]) markSeen.mutate({ milestones: [queue[0].days] });
    },
    /** What was earned by the log currently being shown, for the payoff panel. */
    pendingMilestone: queue[0] ?? null,

    applications,
    audit,
    weeklyLogged,
    medianLogSeconds,
    logApplication,
    recordAction,
    checkDuplicate,

    repair,
    freeRestoreUsed: streak?.freeRestoreUsed ?? false,
    repairing: repairMutation.isPending,
    dismissRepair: () => setRepairHiddenFor(streak?.repair?.day ?? null),
    startOverFromZero: () => {
      setRepairHiddenFor(streak?.repair?.day ?? null);
      dismiss.mutate();
    },
    nowHour: streak?.localHour ?? now.getHours(),
    atRiskDismissed,
    dismissAtRisk: () => setAtRiskDismissed(true),
    // One banner + one hunt-hour prompt is the daily ceiling.
    promptsToday: atRiskDismissed ? MAX_STREAK_PROMPTS_PER_DAY : 1,
    restoreStreak: () => {
      // A restore gift, never a purchase — earned at the big rungs and rare
      // events, redeemed here when it matters most.
      if (!repair || !repair.restoreHeld) return false;
      const days = repair.brokenStreak;
      repairMutation.mutate("gift", {
        onSuccess: () => toast.success(`${days}-day streak restored.`, { description: "Your restore gift brought it back whole." }),
      });
      return true;
    },
    repairWithCredits: () => {
      if (!repair) return;
      const { brokenStreak: days, priceCredits } = repair;
      repairMutation.mutate("credits", {
        onSuccess: () => toast.success(`${days}-day streak restored.`, { description: `${priceCredits} credits spent.` }),
      });
    },
    halfRestoreStreak: () => {
      if (!repair) return;
      const half = repair.halfDays;
      repairMutation.mutate("half", {
        onSuccess: () => toast(`${half} ${half === 1 ? "day" : "days"} restored, free.`, { description: "One free restore every 30 days." }),
      });
    },

    habits,
    habitsToday,
    // Saved whole on the goals row, gathered with the other goal edits into one
    // PATCH — a label typed a letter at a time is one save, not twenty.
    addHabit: () =>
      writeGoals((row) => ({ habits: [...(row?.habits ?? DEFAULT_HABITS), { id: newClientId("habit"), label: "New habit", kind: "application" }] })),
    updateHabit: (id, patch) => writeGoals((row) => ({ habits: (row?.habits ?? DEFAULT_HABITS).map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
    removeHabit: (id) => writeGoals((row) => ({ habits: (row?.habits ?? DEFAULT_HABITS).filter((h) => h.id !== id) })),

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
      // you lose them for good. The end day is saved with the pause, so every
      // device knows how long it runs, and the server holds the streak for it.
      writeGoals(() => ({ paused: true, pauseEndsOn: dayKey(addDays(fromDayKey(todayKey), days)) }));
      toast.success(`Search paused for ${days} days.`, { description: `Your ${current}-day streak is held.` });
    },
    resumeSearch: () => {
      writeGoals(() => ({ paused: false, pauseEndsOn: null }));
      toast.success("Welcome back.", { description: `Your ${current}-day streak is still yours.` });
    },
    pausedDaysLeft,

    hired: retiredStreak !== null,
    retiredStreak,
    markHired: () => retire.mutate(),
  };

  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
};

/** The gift list's key, built once: the effect that refetches it needs a stable reference. */
const qkGifts = qk.activity.gifts();

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
