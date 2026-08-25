"use client";

// The streak chip that lives in a screen header. Shows the live flame + day
// count, escalates its colour with the tier, and opens the full streak panel
// on click.
//
// Micro-interactions: the chip presses down into its own offset shadow on
// hover — it slides by exactly the shadow's offset while the shadow collapses
// to nothing, so it reads as being pushed into the surface rather than
// sliding across it. The number rolls when it changes, and the flame bursts
// whenever a day is logged from anywhere in the app.

import { useState, type FC } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { tierFor } from "@/app/lib/dashboard/streak";
import { useStreak } from "./StreakContext";
import StreakFlame from "./StreakFlame";
import StreakPanel from "./StreakPanel";

export interface StreakPillProps {
  className?: string;
}

const StreakPill: FC<StreakPillProps> = ({ className }) => {
  const { current, logPulse, loggedToday } = useStreak();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const tier = tierFor(current);

  return (
    <>
      {/* A plain button, not a `motion.button`: the press is the tier's CSS
          classes moving the chip onto its own shadow while the shadow
          collapses, and motion's inline `transform` would fight those. The
          count roll below keeps its own AnimatePresence regardless. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${current}-day streak — open streak details`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer",
          "transition-[transform,box-shadow] duration-100 ease-out",
          tier.chip,
          tier.shadow,
          !reduceMotion && tier.press,
          className,
        )}>
        <StreakFlame tier={tier} size={15} pulse={logPulse} dimmed={current === 0} />

        {/* The count rolls up when the streak grows */}
        <span className="relative inline-flex h-4 items-center overflow-hidden tabular-nums">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={current}
              initial={reduceMotion ? undefined : { y: 12, opacity: 0 }}
              animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
              exit={reduceMotion ? undefined : { y: -12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 480, damping: 32 }}
              className="inline-block">
              {current}
            </motion.span>
          </AnimatePresence>
        </span>
        <span>{current === 1 ? "day" : "days"}</span>

        {/* A quiet dot marks today as still open */}
        {!loggedToday && (
          <motion.span
            aria-hidden
            animate={reduceMotion ? undefined : { opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              tier.id === "wildfire" || tier.id === "supernova" || tier.id === "legend" ? "bg-[#e1f073]" : "bg-[#222325]",
            )}
          />
        )}
      </button>

      <StreakPanel open={open} onOpenChange={setOpen} />
    </>
  );
};

export default StreakPill;
