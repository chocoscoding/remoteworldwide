"use client";

// The full streak surface, opened from the header pill: a dark hero with the
// live count and tier, the month calendar, and the reward ladder.
//
// Deliberately two columns on desktop so the calendar and the ladder are
// visible together — the whole point of the ladder is to be read against the
// days you have actually logged.

import { type FC } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Gift, Flame, Snowflake, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { milestoneProgress, nextMilestone, nextTier, tierFor } from "@/app/lib/dashboard/streak";
import { useStreak } from "./StreakContext";
import StreakFlame from "./StreakFlame";
import StreakCalendar from "./StreakCalendar";
import StreakRewards from "./StreakRewards";

export interface StreakPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StreakPanel: FC<StreakPanelProps> = ({ open, onOpenChange }) => {
  const { current, longest, freezes, freeFreezes, giftsWaiting, loggedToday, openLog, logPulse, openGifts, simulateBreak } = useStreak();
  const reduceMotion = useReducedMotion();

  const tier = tierFor(current);
  const upNext = nextTier(current);
  const upcoming = nextMilestone(current);
  const progress = milestoneProgress(current);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 max-w-3xl overflow-hidden gap-0 max-h-[92vh] overflow-y-auto scrollbar-neo">
        {/* Dark hero */}
        <div className="relative overflow-hidden bg-primary text-white px-7 pt-7 pb-6">
          {/* Kept low and left of the close button so it reads as texture
              rather than colliding with the dismiss affordance. */}
          <div aria-hidden className="pointer-events-none absolute -bottom-10 right-6 h-28 w-28 rotate-12 rounded-2xl bg-secondary/10" />

          <div className="relative">
            <DialogTitle className="text-[11px] font-bold tracking-[0.12em] uppercase text-secondary mb-4">Your streak</DialogTitle>

            <div className="flex items-end gap-4 mb-1">
              <motion.div
                initial={reduceMotion ? undefined : { scale: 0.7, opacity: 0 }}
                animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}>
                <StreakFlame tier={tier} size={46} pulse={logPulse} dimmed={current === 0} />
              </motion.div>
              <div className="flex items-baseline gap-2">
                <span className="text-[56px] font-extrabold leading-none tabular-nums">{current}</span>
                <span className="text-base text-white/55">{current === 1 ? "day" : "days"}</span>
              </div>
              <span className="mb-2 inline-flex items-center rounded-full border-[1.5px] border-secondary bg-secondary/15 px-2.5 py-1 text-[11px] font-bold text-secondary">
                {tier.label}
              </span>
            </div>

            <DialogDescription className="text-sm text-white/55 mb-5">
              {loggedToday
                ? "Today is logged. Come back tomorrow to keep it going."
                : "Today is still open — log one application to keep the streak."}
            </DialogDescription>

            {/* Progress to the next rung */}
            {upcoming && (
              <div className="mb-5">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/45">
                    Next: {upcoming.label}
                  </span>
                  <span className="text-[11px] font-bold text-secondary">{upcoming.days - current} days to go</span>
                </div>
                <ProgressBar value={progress} dark height="h-[9px]" />
                {upNext && <p className="mt-1.5 text-[11px] text-white/40">Reaching {upNext.min} days unlocks the {upNext.label} flame.</p>}
              </div>
            )}

            {/* Stat strip */}
            <div className={cn("grid gap-2 mb-5", longest > current ? "grid-cols-3" : "grid-cols-2")}>
              {[
                // Best-ever is hidden while it equals the current streak — until
                // they diverge it's the same number printed twice.
                ...(longest > current ? [{ icon: <Trophy className="h-3.5 w-3.5" />, label: "Best ever", value: `${longest}d` }] : []),
                // Total, with the free-weekly share spelled out — the free
                // tier expires Sunday, so it deserves its own mention.
                { icon: <Snowflake className="h-3.5 w-3.5" />, label: "Freezes", value: `${freezes}`, hint: `${freeFreezes} free this week` },
                { icon: <Gift className="h-3.5 w-3.5" />, label: "Gifts", value: `${giftsWaiting}`, hint: "waiting for you" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white/40">
                    {stat.icon}
                    {stat.label}
                  </span>
                  <span className="mt-0.5 block text-lg font-bold tabular-nums">{stat.value}</span>
                  {"hint" in stat && stat.hint && <span className="block text-[10px] text-white/35">{stat.hint}</span>}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <StickerButton variant="secondary" size="md" shadowColor="#ffffff" onClick={openLog}>
                <Flame className="h-4 w-4" />
                {loggedToday ? "Log another" : "Log an application"}
              </StickerButton>
              <StickerButton variant="outline" size="md" shadowColor="#ffffff" onClick={openGifts}>
                Your gifts
              </StickerButton>
            </div>
          </div>
        </div>

        {/* Calendar + rewards */}
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-7 px-7 py-6">
          <StreakCalendar />

          <div className="min-w-0">
            <p className="text-[15px] font-bold text-primary mb-1">Rewards</p>
            <p className="text-xs text-black/45 mb-3">Each reward pays out once, the day you reach it.</p>
            <StreakRewards />

            {/* Only here because a mock has no clock: a streak breaks at local
                midnight, which can't happen inside one session, so without this
                the repair and comeback screens are unreachable. */}
            {current > 0 && (
              <button
                type="button"
                onClick={simulateBreak}
                className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-black/25 px-3.5 py-2.5 text-xs font-bold text-black/60 transition-colors hover:border-[#222325] hover:text-primary">
                <Snowflake className="h-3.5 w-3.5" />
                Preview what happens if you miss a day
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StreakPanel;
