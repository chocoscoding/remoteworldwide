"use client";

import { FC, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ArrowRight, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import type { ProgressBarFillColor } from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import StreakPill from "@/app/components/dashboard/streak/StreakPill";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import AtRiskBanner from "@/app/components/dashboard/streak/AtRiskBanner";
import ProofOfProgress from "@/app/components/dashboard/ProofOfProgress";
import StreakFlame from "@/app/components/dashboard/streak/StreakFlame";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { COLUMN_LABELS, STATUS_ORDER } from "@/app/components/dashboard/tracker/tracker-meta";
import { ACTION_KINDS, type ActionKind } from "@/app/lib/dashboard/activity";
import { dayKey, fromDayKey, addDays, weekdayIndex, dayVisual, tierFor } from "@/app/lib/dashboard/streak";
import { clampTarget, dailyMath, TARGET_STEP, HIGH_VOLUME_THRESHOLD, TARGET_MAX, TARGET_MIN } from "@/app/lib/dashboard/goals";
import type { TrackerColumnId } from "@/app/lib/dashboard/types";
import { comparePlanRows, taskHref } from "@/app/lib/tasks/api";
import { periodOf, type TaskItem, type TaskSourceKind } from "@/app/lib/tasks/types";
import { useMarkTasksSeen } from "@/hooks/mutations/useTaskMutations";
import { useApplicationSummary, useApplications, useGoals } from "@/hooks/queries/useApplicationsQuery";
import { useTasks } from "@/hooks/queries/useTasksQuery";

// ---------------------------------------------------------------------------
// Next best actions — the top of this month's plan
// ---------------------------------------------------------------------------

/** Open tasks the card shows. The rest of the plan lives with the coach. */
const NEXT_ACTIONS_LIMIT = 3;

/** Where the whole plan lives: the empty state, the overflow link, and any task without a page of its own. */
const FULL_PLAN_HREF = "/dashboard/coach";

/**
 * The second line of a task that carries no detail: where it came from. Every
 * row keeps two lines, so the numbered list doesn't read ragged.
 */
const SOURCE_LINE: Record<TaskSourceKind, string> = {
  user: "Added by you",
  coach: "Agreed with your coach",
  prep: "From interview prep",
  ats: "From the ATS scorer",
  "follow-up": "A follow-up that's due",
  application: "From your tracker",
  system: "From Remote Worldwide",
};

/** A task a service added that hasn't been on screen yet. A task the user writes is seen as it's written. */
const isUnseen = (task: TaskItem) => task.createdBy === "service" && task.seenAt === null;

const NEXT_ACTION_SKELETON_WIDTHS = ["w-2/3", "w-1/2", "w-3/5"] as const;

/** The week's seven labels, Monday first — the order `goals.restDays` numbers them in. */
const WEEK_DAY_LABELS = ["M", "T", "W", "Th", "F", "S", "S"] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Mon 21 — Sun 27 Sep": the Monday-to-Sunday week containing `todayKey`, the
 * user's own today as the server counts it. The month is named once when the
 * week stays inside it, on both ends when it straddles two.
 */
function weekRangeLabel(todayKey: string): string {
  const today = fromDayKey(todayKey);
  const monday = addDays(today, -weekdayIndex(today));
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  return `Mon ${monday.getDate()}${sameMonth ? "" : ` ${MONTHS[monday.getMonth()]}`} — Sun ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;
}

// A link dressed as the outline sticker button. The old markup put a <button>
// inside the <Link>, which nests one control in another.
const outlineLink = cn(stickerButtonVariants({ variant: "outline", size: "sm" }), "flex-none hover:shadow-[3px_3px_0_0_#e1f073]");

/**
 * One green per pipeline stage, deepening toward the end of the funnel. Same
 * hue throughout so the row reads as one journey getting more valuable, not
 * five separate metrics.
 */
const PIPELINE_FILL: Record<TrackerColumnId, ProgressBarFillColor> = {
  saved: "#eaf2b8",
  applied: "#cfe08a",
  conversation: "#a8ca5f",
  interviewing: "#7fb04a",
  offer: "#5c8f39",
};

const HomeClient: FC = () => {
  const [goalsOpen, setGoalsOpen] = useState(false);

  const {
    current: streak,
    byKey,
    todayKey,
    logPulse,
    goals,
    setWeeklyTarget,
    nudgeWeeklyTarget,
    toggleRestDay,
    weeklyLogged,
    openLog,
    habits,
    habitsToday,
    addHabit,
    updateHabit,
    removeHabit,
  } = useActivity();
  const habitsDone = habitsToday.filter((h) => h.done).length;

  // Press-and-hold on the stepper repeats. Held in a ref rather than state so
  // the interval never re-renders anything, and cleared on unmount so a held
  // button can't outlive the screen.
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopHold = () => {
    if (holdRef.current) clearInterval(holdRef.current);
    holdRef.current = null;
  };
  const startHold = (delta: number) => {
    nudgeWeeklyTarget(delta);
    stopHold();
    holdRef.current = setInterval(() => nudgeWeeklyTarget(delta), 110);
  };
  useEffect(() => stopHold, []);
  // Rest days now live in the shared goal state rather than a local Set that
  // nothing ever read — the picker used to be purely decorative.
  const weeklyTarget = goals.weeklyTarget;
  const restDays = new Set(goals.restDays);
  const streakTier = tierFor(streak);

  // The Monday-first week that contains today, resolved against the server's
  // streak history — the strip and the calendar read from one source, so a
  // logged day lights up both at once.
  const weekDays = useMemo(() => {
    const today = fromDayKey(todayKey);
    const monday = addDays(today, -weekdayIndex(today));
    return WEEK_DAY_LABELS.map((label, i) => {
      const date = addDays(monday, i);
      const key = dayKey(date);
      return { label, key, index: i, day: byKey.get(key) ?? null, isToday: key === todayKey };
    });
  }, [byKey, todayKey]);

  // The week's count is ActivityProvider's, from the applications list: sent
  // applications only (a job added to Saved isn't one) in the user's own
  // Monday-to-Sunday week, the week the strip below lights up and the weekly
  // gift is judged on. The summary's count includes saved jobs and runs on the
  // UTC week, so it isn't the one shown. The target stays the goals row as
  // ActivityProvider holds it, which moves the instant the stepper below is
  // pressed; a hero one save behind the stepper under it would read as a
  // missed press.
  const summary = useApplicationSummary();
  // The same cached row ActivityProvider reads, watched here only to know
  // whether it has arrived: until it has, `goals` holds a stand-in target.
  const goalsRow = useGoals();
  const goalsKnown = goalsRow.data !== undefined || goalsRow.isError;
  // The list behind `weeklyLogged`, watched here to know whether it has
  // arrived: until it has, that count is a stand-in zero. A list that couldn't
  // load falls back to the summary's count, so the hero never sits on a
  // skeleton through an outage. The pipeline below reads the same list.
  const applications = useApplications();
  const loggedThisWeek =
    applications.data !== undefined ? weeklyLogged : applications.isError ? (summary.data?.weeklyGoal.loggedThisWeek ?? null) : null;
  const goalReady = goalsKnown && loggedThisWeek !== null;
  const goalPct =
    loggedThisWeek !== null && goalsKnown && weeklyTarget > 0 ? Math.min(100, Math.round((loggedThisWeek / weeklyTarget) * 100)) : 0;
  const math = dailyMath(weeklyTarget, restDays);
  const highVolume = weeklyTarget > HIGH_VOLUME_THRESHOLD;

  // Next best actions: this month's open tasks, most important first. The month
  // is fixed when Home opens, so a render just past midnight on the 1st can't
  // swap the list for next month's.
  const [planPeriod] = useState(() => periodOf(new Date()));
  // The unfiltered list: the cache entry the plan panel and every "Add to plan"
  // button already share, rather than a second request for open tasks alone.
  const plan = useTasks(planPeriod);
  const markTasksSeen = useMarkTasksSeen();
  const { nextActions, moreOnPlan } = useMemo(() => {
    const open = (plan.data ?? []).filter((task) => task.status === "open").sort(comparePlanRows);
    return { nextActions: open.slice(0, NEXT_ACTIONS_LIMIT), moreOnPlan: Math.max(0, open.length - NEXT_ACTIONS_LIMIT) };
  }, [plan.data]);
  // Only rows on screen are marked, so a new task below the top three keeps its
  // marker until it is shown. Keyed on the ids, so an unrelated render queues nothing.
  const unseenKey = nextActions
    .filter(isUnseen)
    .map((task) => task.id)
    .join(",");
  useEffect(() => {
    if (unseenKey) markTasksSeen(unseenKey.split(","));
  }, [unseenKey, markTasksSeen]);

  // Your pipeline: open applications per stage, the rows each tracker column
  // holds. The summary's funnel counts how far applications ever got, closed
  // ones included — a different number, so it isn't the one shown here.
  const pipeline = useMemo(() => {
    const rows = applications.data;
    if (!rows) return null;
    const stages = STATUS_ORDER.map((id) => ({ id, label: COLUMN_LABELS[id], count: rows.filter((row) => row.status === id).length }));
    return { stages, max: Math.max(...stages.map((stage) => stage.count), 1) };
  }, [applications.data]);

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Your week</h1>
          <span className="text-sm text-black/45 truncate">{weekRangeLabel(todayKey)}</span>
        </div>
        <div className="flex items-center gap-3 flex-none">
          <StreakPill />
          <StickerButton variant="primary" size="md" onClick={() => openLog()}>
            Log an application
          </StickerButton>
          <NotificationBell />
        </div>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1320px] mx-auto">
        <AtRiskBanner />

        {/* Hero row: weekly goal + today */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-stretch">
          {/* Weekly goal card */}
          <div className="relative overflow-hidden rounded-[18px] bg-[#222325] text-white p-5 flex flex-col">
            <div aria-hidden className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-secondary/25 blur-3xl pointer-events-none" />

            <div className="relative flex flex-col flex-1">
              {/* The derivation sits up here rather than under the bar: it's
                  context for the target, not a caption on the progress. */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-secondary">Weekly goal</p>
                {goalsKnown ? (
                  <p className="text-xs text-white/45 text-right">
                    {goals.paused ? "Paused. Nothing is expected until you're back." : math.sentence}
                  </p>
                ) : (
                  <span aria-hidden className="h-3 w-40 animate-pulse rounded bg-white/10" />
                )}
              </div>

              <div className="flex items-baseline gap-2.5 mb-5">
                {goalReady ? (
                  <>
                    <span className="text-[56px] font-bold leading-none tabular-nums">{loggedThisWeek}</span>
                    <span className="text-base text-white/55">of {weeklyTarget} applications</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden className="h-14 w-16 self-end animate-pulse rounded-lg bg-white/10" />
                    <span aria-hidden className="h-4 w-36 self-end animate-pulse rounded bg-white/10" />
                    <span className="sr-only">Loading your weekly goal</span>
                  </>
                )}
              </div>

              <ProgressBar value={goalPct} dark height="h-[9px]" className="mb-6" />

              {/* 7-day M–S strip, lit from the live streak history */}
              <div className="grid grid-cols-7 gap-1.5 mb-7">
                {weekDays.map((d) => {
                  const status = d.day?.status ?? "future";
                  const isDone = status === "logged" || status === "backfilled";
                  // A rest day is whatever the user marked as one, not whatever
                  // the seeded history happens to say.
                  const isRest = restDays.has(d.index);
                  const isOpenToday = d.isToday && !isDone && !isRest;
                  const glyph = dayVisual(status, streakTier).glyph;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={d.isToday && !isRest ? () => openLog() : undefined}
                      disabled={!d.isToday || isRest}
                      title={`${d.label} — ${isRest ? "rest day, nothing needed" : isDone ? "logged" : status === "freeze" ? "freeze used" : status === "missed" ? "missed" : d.isToday ? "still open, click to log" : "upcoming"}`}
                      className={cn(
                        "relative h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all",
                        // Rest days shrink back and fade out: they aren't days
                        // you're expected to work, so they shouldn't sit at the
                        // same visual weight as the ones you are. Scaled down
                        // and dimmed reads as "not in play" without removing
                        // them from the week.
                        isRest
                          ? "scale-90 bg-white/[0.04] text-white/25 cursor-not-allowed"
                          : isDone
                            ? "bg-secondary text-primary"
                            : status === "freeze"
                              ? "bg-white/15 text-white/55"
                              : "bg-white/10 text-white/45",
                        isOpenToday && "ring-2 ring-secondary cursor-pointer hover:bg-white/20",
                        d.isToday && isDone && !isRest && "cursor-pointer hover:opacity-90",
                      )}>
                      {isOpenToday && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-lg border-2 border-secondary animate-pulse"
                        />
                      )}
                      <span className="leading-none">{d.label}</span>
                      <span className="leading-none text-[11px]">
                        {isDone ? (
                          <StreakFlame tier={streakTier} size={12} pulse={d.isToday ? logPulse : undefined} />
                        ) : (
                          glyph || <span className="inline-block h-1 w-1 rounded-full bg-current opacity-50" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGoalsOpen((v) => !v)}
                  className="ml-auto text-sm font-semibold text-secondary hover:underline cursor-pointer">
                  {goalsOpen ? "Hide goals" : "Adjust goals"}
                </button>
              </div>
            </div>
          </div>

          {/* Today, in the hero's right column.
              At lg the card is absolutely positioned inside a stretched grid
              cell, so it takes exactly the row height set by the weekly card
              and never grows the row — that's what gives the list something
              finite to scroll inside. Below lg the grid stacks, the card
              returns to normal flow, and the overflow is dropped so nothing is
              hidden behind a scrollbar on a short viewport. */}
          <div className="lg:relative">
            <DashCard className="p-5 flex flex-col lg:absolute lg:inset-0">
              <div className="flex items-baseline justify-between gap-3 mb-1 flex-none">
                <p className="text-[15px] font-bold text-primary">Today</p>
                <span className="text-xs font-semibold text-black/45">
                  {habitsDone} of {habitsToday.length} done
                </span>
              </div>

              <div className="flex flex-col gap-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto scrollbar-neo lg:-mr-1 lg:pr-1">
                {habitsToday.map((h) => {
                  const spec = ACTION_KINDS[h.kind];
                  const row = (
                    <>
                      <NeoCheckbox checked={h.done} interactive={!h.done} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", h.done ? "text-primary font-medium" : "text-black/70")}>{h.label}</span>
                        <span className="block text-[11px] text-black/40">
                          {h.done ? "Done today" : `Needs: ${spec.artifact.toLowerCase()}`}
                        </span>
                      </span>
                      {!h.done && <ArrowRight className="h-3.5 w-3.5 flex-none text-black/30" />}
                    </>
                  );
                  const cls = cn(
                    "group flex flex-none items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    h.done ? "border-black/10 bg-[#f6faea] cursor-default" : "border-black/12 hover:bg-[#f6f6f6] cursor-pointer",
                  );
                  if (h.done)
                    return (
                      <div key={h.id} className={cls}>
                        {row}
                      </div>
                    );
                  return spec.href ? (
                    <Link key={h.id} href={spec.href} className={cls}>
                      {row}
                    </Link>
                  ) : (
                    <button key={h.id} type="button" onClick={() => openLog()} className={cls}>
                      {row}
                    </button>
                  );
                })}
              </div>
            </DashCard>
          </div>
        </div>

        {/* Expandable "Set your goals" panel */}
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            goalsOpen ? "max-h-[1000px] opacity-100 mt-5" : "max-h-0 opacity-0",
          )}>
          <div className="rounded-2xl border border-black bg-white shadow-[4px_4px_0_0_#e1f073] p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[15px] font-bold text-primary">Set your goals</p>
              <button
                type="button"
                onClick={() => setGoalsOpen(false)}
                className="text-xs font-semibold text-black/40 hover:text-black/60 cursor-pointer">
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7">
              <div className="flex flex-col gap-7">
                {/* Weekly target stepper */}
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2.5">Weekly target</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Decrease weekly target"
                      onPointerDown={() => startHold(-TARGET_STEP)}
                      onPointerUp={stopHold}
                      onPointerLeave={stopHold}
                      onPointerCancel={stopHold}
                      // Pointer clicks are already handled by onPointerDown;
                      // detail === 0 means the button was activated by keyboard.
                      onClick={(e) => e.detail === 0 && nudgeWeeklyTarget(-TARGET_STEP)}
                      disabled={weeklyTarget <= TARGET_MIN}
                      className={
                        "h-9 w-9 flex-none rounded-full border-[1.5px] border-[#222325] bg-white flex items-center justify-center shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:shadow-none"
                      }>
                      <Minus className="h-4 w-4" />
                    </button>
                    {/* Typed entry as well as stepping — nobody is pressing "+" 380 times. */}
                    <input
                      type="number"
                      aria-label="Weekly target"
                      value={weeklyTarget}
                      min={TARGET_MIN}
                      max={TARGET_MAX}
                      onChange={(e) => setWeeklyTarget(clampTarget(Number(e.target.value)))}
                      className="w-[72px] rounded-md border border-black/15 px-2 py-1 text-center text-3xl font-bold text-primary tabular-nums outline-none transition-colors focus:border-[#222325] focus:shadow-[2px_2px_0_0_#e1f073] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      aria-label="Increase weekly target"
                      onPointerDown={() => startHold(TARGET_STEP)}
                      onPointerUp={stopHold}
                      onPointerLeave={stopHold}
                      onPointerCancel={stopHold}
                      onClick={(e) => e.detail === 0 && nudgeWeeklyTarget(TARGET_STEP)}
                      disabled={weeklyTarget >= TARGET_MAX}
                      className={
                        "h-9 w-9 flex-none rounded-full border-[1.5px] border-[#222325] bg-white flex items-center justify-center shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:shadow-none"
                      }>
                      <Plus className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-black/50">applications / week</span>
                  </div>
                  <p className="mt-2 text-xs text-black/45">{math.sentence}</p>
                </div>

                {/* Rest-day picker */}
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-1">Working days</p>
                  <p className="text-xs text-black/45 mb-2.5">Filled days are the ones you work. Tap one to make it a rest day.</p>
                  <div className="flex gap-1.5">
                    {WEEK_DAY_LABELS.map((day, i) => {
                      // Filled means active. The picker used to fill the *rest*
                      // days, which read backwards — a solid chip says "on".
                      const working = !restDays.has(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleRestDay(i)}
                          className={cn(
                            // Squarer than the old rounded-lg, and it presses on
                            // click — but with no shadow to press into, so it
                            // reads as a toggle rather than a raised control.
                            "h-9 w-9 rounded-sm text-xs font-bold flex items-center justify-center cursor-pointer",
                            "transition-[transform,background-color] duration-100 ease-out active:translate-x-[1px] active:translate-y-[1px]",
                            working ? "bg-primary text-white" : "bg-[#f0f0ea] text-black/45 hover:bg-[#e7e7df]",
                          )}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Secondary goals */}
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2.5">
                    {highVolume ? "Quality signal" : "Secondary goals"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Pill variant="positive">Reply rate</Pill>
                    {/* At high volume nobody is individually crafting each application,
                        so the UI reports tailoring rate + median ATS instead of implying
                        they are. Avg ATS is never a *target* — it's an outcome, it's
                        gameable, and it dips for reasons the user didn't cause. */}
                    {highVolume && <Pill variant="positive">Tailoring rate</Pill>}
                    {highVolume && <Pill variant="positive">Median ATS</Pill>}
                  </div>
                  <p className="mt-2 text-xs text-black/45">
                    {highVolume
                      ? "At this volume we track how many you tailor, not whether each one was crafted."
                      : "Reported, not targeted."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                {/* Daily habits — the EDITING surface. The read-only "Today"
                    card below the hero is where you see what's outstanding;
                    this is where you decide what the habits are. */}
                {/* Boxed so the editable list reads as one block rather than
                    floating loose against the goals column beside it. */}
                <div className="rounded-lg border-[1.5px] border-[#222325] p-3.5">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40">Daily habits</p>
                    <span className="text-[11px] font-semibold text-black/45">{habits.length} habits</span>
                  </div>
                  <p className="text-xs text-black/45 mb-2.5">Each one ticks itself when the work exists.</p>
                  {/* A plain list that becomes editable on contact. Boxing every
                      field made five habits look like a form to fill in; at rest
                      this reads as the list it is. */}
                  <div className="flex flex-col gap-0.5 -mx-1">
                    {habits.map((h) => (
                      <div key={h.id} className="group flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-[#fbfbf7]">
                        <input
                          aria-label="Habit name"
                          value={h.label}
                          onChange={(e) => updateHabit(h.id, { label: e.target.value })}
                          className="min-w-0 flex-1 rounded bg-transparent px-1.5 py-1 text-sm text-primary outline-none transition-colors hover:bg-[#f3f3ef] focus:bg-white focus:ring-1 focus:ring-black/25"
                        />
                        <select
                          aria-label={`What completes ${h.label}`}
                          title="Counts when this exists"
                          value={h.kind}
                          onChange={(e) => updateHabit(h.id, { kind: e.target.value as ActionKind })}
                          // A lime chip rather than a bare select: it carries the
                          // brand colour, and dropping the native caret takes the
                          // last piece of chrome out of the row.
                          className="flex-none appearance-none rounded-full bg-[#eaf2b8] px-2.5 py-1 text-[11px] font-semibold text-[#222325] outline-none transition-colors hover:bg-secondary focus:ring-1 focus:ring-black/25 cursor-pointer">
                          {(Object.keys(ACTION_KINDS) as ActionKind[]).map((k) => (
                            <option key={k} value={k}>
                              {ACTION_KINDS[k].short}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          aria-label={`Remove ${h.label}`}
                          onClick={() => removeHabit(h.id)}
                          className="h-5 w-5 flex-none rounded text-black/30 flex items-center justify-center opacity-0 transition-opacity hover:text-black/70 group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addHabit}
                      className="mt-1 flex items-center gap-1.5 rounded-md border border-dashed border-black/20 px-2.5 py-1.5 text-xs font-semibold text-black/40 hover:border-black/40 hover:text-primary transition-colors cursor-pointer">
                      <Plus className="h-3 w-3 flex-none" />
                      Add your own habit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The nudge list sits ABOVE the outcomes panel on purpose: that
            panel reports what came back, and this is the highest-leverage
            thing the user can do to make more of it come back. */}
        {/* <div className="mt-6">
          <NeedsANudge />
        </div> */}

        <div className="mt-6">
          <ProofOfProgress />
        </div>

        {/* Footer row: next best actions + pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          {/* Next best actions — the top of this month's plan */}
          <DashCard className="p-6">
            <p className="text-[15px] font-bold text-primary mb-1">Next best actions</p>
            <p className="text-xs text-black/45 mb-4">The top of this month&apos;s plan, most important first.</p>
            <p role="status" className="sr-only">
              {plan.isPending ? "Loading your plan" : ""}
            </p>
            <div className="flex flex-col divide-y divide-black/8">
              {plan.isPending &&
                NEXT_ACTION_SKELETON_WIDTHS.map((width, i) => (
                  <div key={width} aria-hidden className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <span className="h-6 w-6 flex-none rounded-full bg-[#f0f0ea] text-xs font-bold text-black/25 flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                      <span className={cn("h-3 animate-pulse rounded bg-[#f0f0ea]", width)} />
                      <span className="h-2.5 w-1/3 animate-pulse rounded bg-[#f0f0ea]" />
                    </div>
                    <span className="h-8 w-14 flex-none animate-pulse rounded-lg bg-[#f0f0ea]" />
                  </div>
                ))}

              {plan.isError && !plan.data && (
                <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-[#f0f0ea]/70 px-4 py-3">
                  <span className="text-sm text-black/60">Couldn&apos;t load your plan.</span>
                  <button type="button" onClick={() => void plan.refetch()} disabled={plan.isFetching} className={outlineLink}>
                    <RotateCw aria-hidden className={cn("h-3.5 w-3.5", plan.isFetching && "animate-spin")} />
                    Retry
                  </button>
                </div>
              )}

              {plan.data && nextActions.length === 0 && (
                <div className="flex flex-col items-start gap-3 rounded-xl bg-[#f0f0ea]/70 px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">Nothing open on your plan</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-black/50">
                      Ask your coach what to focus on next. It can suggest steps to add.
                    </p>
                  </div>
                  <Link href={FULL_PLAN_HREF} className={outlineLink}>
                    Plan with your coach
                  </Link>
                </div>
              )}

              {nextActions.map((task, i) => (
                <div key={task.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                  <span className="h-6 w-6 flex-none rounded-full bg-[#f0f0ea] text-xs font-bold text-primary flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="text-sm font-semibold text-primary truncate">{task.title}</span>
                      {isUnseen(task) && (
                        <>
                          <span
                            aria-hidden
                            title="New"
                            className="h-2 w-2 flex-none rounded-full bg-[#e1f073] ring-[1.5px] ring-[#222325]"
                          />
                          <span className="sr-only">(new)</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-black/45 truncate">{task.detail || SOURCE_LINE[task.source.kind]}</p>
                  </div>
                  <Link href={taskHref(task) ?? FULL_PLAN_HREF} aria-label={`Open: ${task.title}`} className={outlineLink}>
                    Open
                  </Link>
                </div>
              ))}
            </div>
            {moreOnPlan > 0 && (
              <Link
                href={FULL_PLAN_HREF}
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-black/50 transition-colors hover:text-primary">
                +{moreOnPlan} more on your plan
                <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            )}
          </DashCard>

          {/* Your pipeline */}
          <DashCard className="p-6 flex flex-col">
            <p className="text-[15px] font-bold text-primary mb-4">Your pipeline</p>
            <div aria-busy={applications.isPending || undefined} className="flex flex-col gap-3.5 flex-1">
              {pipeline
                ? pipeline.stages.map((stage) => (
                    <div key={stage.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-black/60">{stage.label}</span>
                        <span className="text-xs font-bold text-primary">{stage.count}</span>
                      </div>
                      <ProgressBar value={(stage.count / pipeline.max) * 100} fillColor={PIPELINE_FILL[stage.id]} />
                    </div>
                  ))
                : // Loading, or a first read that failed (the board says so in a
                  // toast): each stage keeps its place, with no number to show.
                  STATUS_ORDER.map((id) => (
                    <div key={id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-black/60">{COLUMN_LABELS[id]}</span>
                        {applications.isPending ? (
                          <span aria-hidden className="h-3 w-5 animate-pulse rounded bg-[#f0f0ea]" />
                        ) : (
                          <span className="text-xs font-bold text-black/30">—</span>
                        )}
                      </div>
                      <div aria-hidden className={cn("h-2 w-full rounded-full bg-[#f0f0ea]", applications.isPending && "animate-pulse")} />
                    </div>
                  ))}
            </div>
            <Link href="/dashboard/tracker" className="mt-5 block">
              <StickerButton variant="outline" size="md" className="w-full">
                Open tracker
              </StickerButton>
            </Link>
          </DashCard>
        </div>
      </main>
    </div>
  );
};

export default HomeClient;
