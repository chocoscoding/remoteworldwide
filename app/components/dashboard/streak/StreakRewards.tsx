"use client";

// The reward ladder. Each rung shows what it costs in days, what it pays in
// credits, and whether it is banked, in progress, or still locked.
//
// Micro-interactions: the in-progress rung fills its bar on mount and carries
// a soft breathing glow; unlocked rungs lift on hover; locked rungs stay flat
// and desaturated so the earned ones read as genuinely different.

import { type FC } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { STREAK_MILESTONES, milestoneProgress, nextMilestone } from "@/app/lib/dashboard/streak";
import { GIFT_CATALOGUE } from "@/app/lib/dashboard/gifts";
import { useStreak } from "./StreakContext";

export interface StreakRewardsProps {
  /** Renders on a dark surface. */
  dark?: boolean;
  className?: string;
}

const StreakRewards: FC<StreakRewardsProps> = ({ dark = false, className }) => {
  const { current, claimed, gifts } = useStreak();
  const reduceMotion = useReducedMotion();
  const upcoming = nextMilestone(current);
  const progress = milestoneProgress(current);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {STREAK_MILESTONES.map((m) => {
        const unlocked = claimed.includes(m.days) || current >= m.days;
        const isNext = upcoming?.days === m.days;
        const daysToGo = m.days - current;

        return (
          <motion.div
            key={m.days}
            whileHover={reduceMotion || (!unlocked && !isNext) ? undefined : { x: 2, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            // The ladder is where the colour lives. Banked rungs take a full
            // lime fill, the rung in progress is white with a lime shadow and a
            // partial lime track behind it, and locked rungs fade out — so the
            // column reads top-to-bottom as a descending ramp of earned → in
            // reach → far off. The calendar beside it stays deliberately quiet
            // so this is the panel that carries the weight.
            className={cn(
              "relative overflow-hidden rounded-lg border-[1.5px] px-3.5 py-3",
              unlocked
                ? dark
                  ? "border-secondary bg-secondary/15"
                  : "border-[#222325] bg-[#e1f073] shadow-[3px_3px_0_0_#222325]"
                : isNext
                  ? dark
                    ? "border-white/40 bg-white/[0.07]"
                    : "border-[#222325] bg-white shadow-[3px_3px_0_0_#e1f073]"
                  : dark
                    ? "border-white/12 bg-white/[0.03]"
                    : "border-black/12 bg-[#fbfbf7]"
            )}>
            {/* The in-progress rung fills a track behind its content */}
            {isNext && (
              <motion.div
                aria-hidden
                initial={reduceMotion ? { width: `${progress}%` } : { width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className={cn("pointer-events-none absolute inset-y-0 left-0", dark ? "bg-secondary/12" : "bg-[#e1f073]/35")}
              />
            )}

            <div className="relative flex items-center gap-3">
              {/* Badge */}
              <span
                className={cn(
                  "h-8 w-8 flex-none rounded-md border-[1.5px] flex items-center justify-center text-base",
                  unlocked
                    ? "border-[#222325] bg-white"
                    : isNext
                      ? dark
                        ? "border-white/40 bg-white/10"
                        : "border-[#222325] bg-white"
                      : dark
                        ? "border-white/15 bg-transparent grayscale opacity-45"
                        : "border-black/12 bg-white grayscale opacity-45"
                )}>
                {m.emoji}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "text-[13px] font-bold truncate",
                      unlocked ? (dark ? "text-white" : "text-primary") : dark ? "text-white/70" : "text-black/60"
                    )}>
                    {m.label}
                  </p>
                  <span
                    className={cn(
                      "flex-none text-[10px] font-bold uppercase tracking-[0.06em]",
                      unlocked ? (dark ? "text-white/55" : "text-primary/60") : dark ? "text-white/35" : "text-black/35"
                    )}>
                    {m.days}d
                  </span>
                </div>
                <p className={cn("text-[11px] truncate", unlocked ? (dark ? "text-white/55" : "text-primary/65") : dark ? "text-white/40" : "text-black/40")}>
                  {/* Unearned rungs promise a surprise; earned ones show the
                      gift actually drawn (the inventory holds the roll).
                      Seeded history has no entry — fall back to the promise. */}
                  {(() => {
                    const drawn = gifts.find((g) => g.refId === String(m.days));
                    const what = unlocked && drawn ? `\u{1F381} ${GIFT_CATALOGUE[drawn.kind].label}` : "\u{1F381} Surprise gift";
                    return `${what}${m.perk ? ` · ${m.perk}` : ""}`;
                  })()}
                </p>
              </div>

              {/* Right-hand state */}
              <span className="flex-none">
                {unlocked ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold",
                      dark ? "bg-secondary text-primary" : "bg-[#222325] text-[#e1f073]"
                    )}>
                    <Check className="h-3 w-3" />
                    Earned
                  </span>
                ) : isNext ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border-[1.5px] px-2 py-1 text-[10px] font-bold",
                      dark ? "border-white/40 text-white" : "border-[#222325] text-primary"
                    )}>
                    {daysToGo} to go
                  </span>
                ) : (
                  <Lock className={cn("h-3.5 w-3.5", dark ? "text-white/25" : "text-black/25")} />
                )}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default StreakRewards;
