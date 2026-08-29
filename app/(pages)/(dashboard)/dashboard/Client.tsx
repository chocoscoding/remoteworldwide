"use client";

import { FC, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import type { ProgressBarFillColor } from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import StreakPill from "@/app/components/dashboard/streak/StreakPill";
import AtRiskBanner from "@/app/components/dashboard/streak/AtRiskBanner";
import ProofOfProgress from "@/app/components/dashboard/ProofOfProgress";
import StreakFlame from "@/app/components/dashboard/streak/StreakFlame";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { ACTION_KINDS, type ActionKind } from "@/app/lib/dashboard/activity";
import { dayKey, fromDayKey, addDays, weekdayIndex, dayVisual, tierFor } from "@/app/lib/dashboard/streak";
import { clampTarget, dailyMath, TARGET_STEP, HIGH_VOLUME_THRESHOLD, TARGET_MAX, TARGET_MIN } from "@/app/lib/dashboard/goals";
import { TRACKER_COLUMNS, WEEKLY_GOAL } from "@/app/lib/dashboard/mock-data";
import type { TrackerColumnId } from "@/app/lib/dashboard/types";

// ---------------------------------------------------------------------------
// Local content that isn't shared with any other screen yet — kept here
// rather than in mock-data.ts.
// ---------------------------------------------------------------------------

interface NextAction {
  id: string;
  title: string;
  detail: string;
  href: string;
}

const NEXT_ACTIONS: NextAction[] = [
  {
    id: "action-linear",
    title: "Tailor resume to Linear",
    detail: "Closes in 2 days · ATS 71 → 89",
    href: "/dashboard/resume",
  },
  {
    id: "action-deel",
    title: "Follow up with Deel",
    detail: "Applied 8 days ago",
    href: "/dashboard/tracker",
  },
  {
    id: "action-vercel",
    title: 'Practise "why remote?" answer',
    detail: "Vercel screen · Thu 14:00",
    href: "/dashboard/prep",
  },
];

const PIPELINE_MAX = Math.max(...TRACKER_COLUMNS.map((col) => col.count), 1);

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

  // The Monday-first week that contains today, resolved against real streak
  // history rather than WEEKLY_GOAL.doneDays — the strip and the calendar now
  // read from one source, so logging a day lights up both at once.
  const weekDays = useMemo(() => {
    const today = fromDayKey(todayKey);
    const monday = addDays(today, -weekdayIndex(today));
    return WEEKLY_GOAL.allDays.map((label, i) => {
      const date = addDays(monday, i);
      const key = dayKey(date);
      return { label, key, index: i, day: byKey.get(key) ?? null, isToday: key === todayKey };
    });
  }, [byKey, todayKey]);

  // Reads the live count of applications logged this week instead of the frozen
  // WEEKLY_GOAL.current, which never moved no matter how much you logged.
  const goalPct = weeklyTarget > 0 ? Math.min(100, Math.round((weeklyLogged / weeklyTarget) * 100)) : 0;
  const math = dailyMath(weeklyTarget, restDays);
  const highVolume = weeklyTarget > HIGH_VOLUME_THRESHOLD;

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Your week</h1>
          <span className="text-sm text-black/45 truncate">Mon 3 — Sun 9 Aug</span>
        </div>
        <div className="flex items-center gap-3 flex-none">
          <StreakPill />
          <StickerButton variant="primary" size="md" onClick={() => openLog()}>
            Log an application
          </StickerButton>
        </div>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1240px] mx-auto">
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
                <p className="text-xs text-white/45 text-right">{math.sentence}</p>
              </div>

              <div className="flex items-baseline gap-2.5 mb-5">
                <span className="text-[56px] font-bold leading-none tabular-nums">{weeklyLogged}</span>
                <span className="text-base text-white/55">of {weeklyTarget} applications</span>
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
              <p className="text-xs text-black/45 mb-3 flex-none">Any one of these keeps your streak alive.</p>

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
                    {WEEKLY_GOAL.allDays.map((day, i) => {
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

        <div className="mt-6">
          <ProofOfProgress />
        </div>

        {/* Footer row: next best actions + pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          {/* Next best actions */}
          <DashCard className="p-6">
            <p className="text-[15px] font-bold text-primary mb-1">Next best actions</p>
            <p className="text-xs text-black/45 mb-4">Ranked by what moves the needle this week.</p>
            <div className="flex flex-col divide-y divide-black/8">
              {NEXT_ACTIONS.map((action, i) => (
                <div key={action.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                  <span className="h-6 w-6 flex-none rounded-full bg-[#f0f0ea] text-xs font-bold text-primary flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary truncate">{action.title}</p>
                    <p className="text-xs text-black/45 truncate">{action.detail}</p>
                  </div>
                  <Link href={action.href} className="flex-none">
                    <StickerButton variant="outline" size="sm">
                      Open
                    </StickerButton>
                  </Link>
                </div>
              ))}
            </div>
          </DashCard>

          {/* Your pipeline */}
          <DashCard className="p-6 flex flex-col">
            <p className="text-[15px] font-bold text-primary mb-4">Your pipeline</p>
            <div className="flex flex-col gap-3.5 flex-1">
              {TRACKER_COLUMNS.map((col) => (
                <div key={col.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-black/60">{col.label}</span>
                    <span className="text-xs font-bold text-primary">{col.count}</span>
                  </div>
                  <ProgressBar value={(col.count / PIPELINE_MAX) * 100} fillColor={PIPELINE_FILL[col.id]} />
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
