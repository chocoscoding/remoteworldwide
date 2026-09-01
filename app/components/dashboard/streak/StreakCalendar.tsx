"use client";

// Month calendar of streak history. A logged day is a soft tinted tile with a
// dark tick; rest days sleep, absorbed misses freeze, plain misses stay
// hollow and dashed.
//
// Micro-interactions: cells stagger in when the month changes, lift on hover,
// and today's cell keeps a slow pulsing ring until it has been logged.

import { useMemo, useState, type FC } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_HEADERS,
  buildMonthGrid,
  dayVisual,
  fromDayKey,
  monthLabel,
  shortDateLabel,
  tierFor,
} from "@/app/lib/dashboard/streak";
import { useStreak } from "./StreakContext";

export interface StreakCalendarProps {
  /** Renders on a dark surface — flips the chrome to light-on-ink. */
  dark?: boolean;
  className?: string;
}

const StreakCalendar: FC<StreakCalendarProps> = ({ dark = false, className }) => {
  const { byKey, current, todayKey, loggedToday, dailyTarget } = useStreak();
  const reduceMotion = useReducedMotion();
  const today = useMemo(() => fromDayKey(todayKey), [todayKey]);
  const [monthOffset, setMonthOffset] = useState(0);

  const tier = tierFor(current);
  const month = useMemo(() => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1), [today, monthOffset]);
  const cells = useMemo(() => buildMonthGrid(month, byKey, today), [month, byKey, today]);

  // Only the weeks that actually contain days of this month — a 42-cell grid
  // otherwise trails an empty sixth row on most months.
  const weeks = useMemo(() => {
    const rows: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows.filter((row) => row.some((c) => c.inMonth));
  }, [cells]);

  const monthDone = cells.filter((c) => c.inMonth && (c.day?.status === "logged" || c.day?.status === "backfilled")).length;

  return (
    // Capped rather than fluid: `aspect-square` cells in a full-width column
    // blow up to ~100px each, which reads as a wall of tiles instead of a
    // calendar. ~44px per cell is the sweet spot for glyph legibility.
    <div className={cn("min-w-0 w-full max-w-[340px]", className)}>
      {/* Month nav */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className={cn("text-sm font-bold truncate", dark ? "text-white" : "text-primary")}>{monthLabel(month)}</p>
          <p className={cn("text-[11px]", dark ? "text-white/45" : "text-black/45")}>
            {monthDone} {monthDone === 1 ? "day" : "days"} logged
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <button
            type="button"
            onClick={() => setMonthOffset((n) => n - 1)}
            aria-label="Previous month"
            className={cn(
              "h-7 w-7 rounded-md border-[1.5px] flex items-center justify-center transition-all cursor-pointer active:translate-x-px active:translate-y-px",
              dark
                ? "border-white/20 text-white/60 hover:border-white hover:text-white"
                : "border-black/15 text-black/50 hover:border-[#222325] hover:text-primary hover:shadow-[2px_2px_0_0_#222325]"
            )}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMonthOffset((n) => Math.min(0, n + 1))}
            disabled={monthOffset >= 0}
            aria-label="Next month"
            className={cn(
              "h-7 w-7 rounded-md border-[1.5px] flex items-center justify-center transition-all cursor-pointer active:translate-x-px active:translate-y-px disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none",
              dark
                ? "border-white/20 text-white/60 hover:border-white hover:text-white"
                : "border-black/15 text-black/50 hover:border-[#222325] hover:text-primary hover:shadow-[2px_2px_0_0_#222325]"
            )}>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={i}
            className={cn("h-5 flex items-center justify-center text-[10px] font-bold uppercase", dark ? "text-white/35" : "text-black/35")}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={monthOffset}
          initial={reduceMotion ? undefined : { opacity: 0, x: 8 }}
          animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex flex-col gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((cell, di) => {
                const status = cell.day?.status ?? "missed";
                const visual = dayVisual(status, tier);
                // A day that met the daily bar reads stronger than one merely
                // kept alive — intensity is optional on seeded history.
                const fullDay =
                  (status === "logged" || status === "backfilled") && (cell.day?.intensity ?? 0) >= dailyTarget;
                const isOpenToday = cell.isToday && !loggedToday;
                const muted = !cell.inMonth;

                return (
                  <motion.div
                    key={cell.key}
                    initial={reduceMotion ? undefined : { opacity: 0, scale: 0.82 }}
                    animate={reduceMotion ? undefined : { opacity: muted ? 0.3 : 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: reduceMotion ? 0 : (wi * 7 + di) * 0.006, ease: "easeOut" }}
                    whileHover={reduceMotion ? undefined : { scale: 1.14, zIndex: 1 }}
                    title={`${shortDateLabel(cell.key)} — ${fullDay ? "Full day" : visual.label}${cell.day?.count ? ` (${cell.day.count})` : ""}`}
                    className={cn(
                      "relative aspect-square rounded-md border-[1.5px] flex items-center justify-center text-[11px] font-bold cursor-default select-none",
                      visual.cell,
                      muted && "opacity-30",
                      isOpenToday && "ring-2 ring-offset-1 ring-[#222325]",
                      dark && status === "missed" && "bg-white/5 border-white/15 text-white/30",
                      dark && status === "future" && "text-white/20",
                      dark && status === "rest" && "bg-white/10 text-white/40",
                      fullDay && "border-[#222325] ring-1 ring-[#222325]"
                    )}>
                    {/* Today's unlogged cell keeps a slow breathing ring */}
                    {isOpenToday && !reduceMotion && (
                      <motion.span
                        aria-hidden
                        animate={{ opacity: [0.55, 0.12, 0.55], scale: [1, 1.22, 1] }}
                        transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
                        className="pointer-events-none absolute inset-0 rounded-md border-2 border-[#e1f073]"
                      />
                    )}
                    <span className="relative inline-flex items-center justify-center" style={visual.kind === "emoji" ? { fontSize: 12 } : undefined}>
                      {visual.kind === "check" ? (
                        <Check className="h-3.5 w-3.5 text-[#222325]" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                      ) : visual.kind === "emoji" ? (
                        visual.glyph
                      ) : (
                        cell.date.getDate()
                      )}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[10px]", dark ? "text-white/40" : "text-black/40")}>
        <span className="inline-flex items-center gap-1">
          <span className={cn("inline-flex h-3 w-3 items-center justify-center rounded-[2px]", tier.cell)}>
            <Check className="h-2 w-2 text-[#222325]" strokeWidth={5} />
          </span>
          Logged
        </span>
        <span className="inline-flex items-center gap-1">💤 Rest</span>
        <span className="inline-flex items-center gap-1">❄️ Freeze</span>
        <span className="inline-flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-[2px] border border-dashed", dark ? "border-white/30" : "border-black/25")} />
          Missed
        </span>
      </div>
    </div>
  );
};

export default StreakCalendar;
