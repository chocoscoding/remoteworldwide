"use client";

// The screen after a break.
//
// This is the highest-leverage moment in the whole system: the point right
// after a streak snaps is when people quit. So it never shows a bare zero.
// Inside the 48-hour window it offers the streak back; outside it, it shows
// what was actually built — best run, total applications — and one button to
// start again.
//
// The free half-restore exists so the offer isn't only for people who can pay.
// Losing a month of work because you're 12 credits short is exactly the kind
// of thing that ends a job search.

import { type FC } from "react";
import { motion, useReducedMotion } from "motion/react";
import { RotateCcw, Trophy, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { REPAIR_WINDOW_HOURS, restoreCost } from "@/app/lib/dashboard/credits";

const RepairStreakPanel: FC = () => {
  const { repair, credits, longest, applications, restoreStreak, halfRestoreStreak, freeRestoreUsed, dismissRepair, openCredits } =
    useActivity();
  const reduceMotion = useReducedMotion();

  if (!repair) return null;

  const { brokenStreak, hoursSinceBreak } = repair;
  const cost = restoreCost(brokenStreak);
  const inWindow = hoursSinceBreak <= REPAIR_WINDOW_HOURS;
  const hoursLeft = Math.max(0, Math.ceil(REPAIR_WINDOW_HOURS - hoursSinceBreak));
  const canPay = credits >= cost;
  const half = Math.floor(brokenStreak / 2);

  return (
    <Dialog open onOpenChange={(o) => !o && dismissRepair()}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 max-w-md overflow-hidden gap-0">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.94 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 340, damping: 26 }}>
          <div className="bg-primary px-7 pt-7 pb-6 text-white">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.12em] text-secondary mb-3">
              {inWindow ? "Your streak broke" : "Starting again"}
            </DialogTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-[52px] font-extrabold leading-none tabular-nums">{brokenStreak}</span>
              <span className="text-base text-white/55">days</span>
            </div>
            <DialogDescription className="mt-2 text-sm text-white/55">
              {inWindow
                ? `You can have them back for ${hoursLeft} more hours.`
                : "That run is done — but none of the work behind it is."}
            </DialogDescription>
          </div>

          <div className="px-7 py-6">
            {/* What was actually built. Shown either way: a streak is not the
                only thing that happened. */}
            <div className="mb-5 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-black/12 bg-[#fbfbf7] px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-black/40">
                  <Trophy className="h-3 w-3" />
                  Best ever
                </span>
                <span className="mt-0.5 block text-lg font-bold text-primary tabular-nums">{longest}d</span>
              </div>
              <div className="rounded-lg border border-black/12 bg-[#fbfbf7] px-3 py-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-black/40">Applications</span>
                <span className="mt-0.5 block text-lg font-bold text-primary tabular-nums">{applications.length}</span>
              </div>
            </div>

            {inWindow ? (
              <div className="flex flex-col gap-2.5">
                <StickerButton variant="primary" size="lg" className="w-full" disabled={!canPay} onClick={restoreStreak}>
                  <RotateCcw className="h-4 w-4" />
                  Restore {brokenStreak} days — {cost} credits
                </StickerButton>

                {!canPay && (
                  <p className="text-center text-xs text-black/50">
                    You have {credits}.{" "}
                    <button type="button" onClick={openCredits} className="font-semibold text-primary underline underline-offset-2 cursor-pointer">
                      See credits
                    </button>
                  </p>
                )}

                {/* The fallback, only offered when they genuinely can't pay. */}
                {!canPay && !freeRestoreUsed && half > 0 && (
                  <StickerButton variant="outline" size="md" className="w-full" onClick={halfRestoreStreak}>
                    Take {half} days back, free
                  </StickerButton>
                )}
                {!canPay && freeRestoreUsed && (
                  <p className="text-center text-[11px] text-black/40">Free restore already used this month.</p>
                )}

                <button
                  type="button"
                  onClick={dismissRepair}
                  className="mx-auto mt-1 text-xs font-semibold text-black/40 hover:text-primary cursor-pointer">
                  Start from zero instead
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-sm leading-relaxed text-black/60">
                  {longest} days is still your best run, and {applications.length} applications are still out there. Day one again.
                </p>
                <StickerButton variant="primary" size="lg" className="w-full" onClick={dismissRepair}>
                  Start again
                </StickerButton>
              </div>
            )}
          </div>
        </motion.div>

        {/* The default close is enough, but this panel is dismissible on purpose
            — trapping someone in a "you failed" modal is the opposite of the point. */}
        <button type="button" onClick={dismissRepair} className="sr-only">
          <X className="h-4 w-4" />
          Close
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default RepairStreakPanel;
