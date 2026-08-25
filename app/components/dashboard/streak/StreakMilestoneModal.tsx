"use client";

// Celebration shown the moment a streak crosses a reward rung. Mounted once
// by `StreakProvider`'s consumer in `DashboardShell`, and driven entirely by
// `celebrating` — milestones queue up, so a jump that clears two rungs shows
// two celebrations back to back.
//
// Follows `RewardModal`'s established pattern (confetti burst + spring-in
// card), with the flame and the day count as the hero instead of a credit
// badge.

import { useMemo, type FC } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Flame, Snowflake } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { tierFor } from "@/app/lib/dashboard/streak";
import { useStreak } from "./StreakContext";

const CONFETTI_COLORS = ["#e1f073", "#cddd54", "#f0c86a", "#222325"];
const CONFETTI_COUNT = 30;

interface ConfettiPiece {
  id: number;
  leftPct: number;
  color: string;
  width: number;
  height: number;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    leftPct: Math.random() * 100,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    width: 5 + Math.random() * 5,
    height: 8 + Math.random() * 6,
    delay: Math.random() * 0.35,
    duration: 1.4 + Math.random() * 1.1,
    rotate: Math.random() * 320 - 160,
    drift: Math.random() * 70 - 35,
  }));
}

const StreakMilestoneModal: FC = () => {
  const { celebrating, dismissCelebration, credits, freezes, longest } = useStreak();
  const reduceMotion = useReducedMotion();

  // Radix unmounts DialogContent's subtree while closed, so this remounts
  // fresh (new confetti paths) each time a milestone opens it.
  const confetti = useMemo(() => makeConfetti(), []);

  if (!celebrating) return null;
  const tier = tierFor(celebrating.days);
  const isRecord = celebrating.days >= longest;

  return (
    <Dialog open onOpenChange={(open) => !open && dismissCelebration()}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 max-w-md overflow-hidden gap-0">
        {/* Falling confetti, concentrated near the top of the card */}
        {!reduceMotion && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
            {confetti.map((piece) => (
              <motion.span
                key={piece.id}
                initial={{ y: -16, x: 0, opacity: 0, rotate: 0 }}
                animate={{ y: 280, x: piece.drift, opacity: [0, 1, 1, 0], rotate: piece.rotate }}
                transition={{ duration: piece.duration, delay: piece.delay, ease: "easeIn" }}
                className="absolute top-0 rounded-[1.5px]"
                style={{ left: `${piece.leftPct}%`, width: piece.width, height: piece.height, backgroundColor: piece.color }}
              />
            ))}
          </div>
        )}

        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.92, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 26 }}
          className="relative z-10 flex flex-col items-center px-8 pt-10 pb-8 text-center">
          {/* Hero flame + day count */}
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, scale: 0.5, rotate: -12 }}
            animate={reduceMotion ? undefined : { opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.12, type: "spring", stiffness: 380, damping: 18 }}
            className="mb-1 text-[64px] leading-none select-none">
            {celebrating.emoji}
          </motion.div>

          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mb-4 flex items-baseline gap-2">
            <span className="text-[52px] font-extrabold leading-none text-primary tabular-nums">{celebrating.days}</span>
            <span className="text-base font-bold text-black/45">day streak</span>
          </motion.div>

          <DialogTitle className="mb-1.5 text-xl font-bold text-primary">{celebrating.label}</DialogTitle>
          <DialogDescription className="mb-5 max-w-[300px] text-sm leading-relaxed text-black/55">
            {celebrating.blurb} You are officially at <span className="font-bold text-primary">{tier.label}</span>.
          </DialogDescription>

          {/* Reward payout */}
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
            animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={{ delay: 0.36, type: "spring", stiffness: 360, damping: 22 }}
            className="mb-3 w-full rounded-xl border-2 border-[#222325] bg-[#e1f073] px-5 py-3.5 shadow-[4px_4px_0_0_#222325]">
            <div className="flex items-center justify-center gap-2">
              <Flame className="h-4 w-4 text-primary" />
              <span className="text-lg font-extrabold text-primary tabular-nums">+{celebrating.credits}</span>
              <span className="text-sm font-bold text-primary/70">credits</span>
            </div>
            {celebrating.perk && (
              <div className="mt-1.5 flex items-center justify-center gap-1.5 border-t border-[#222325]/20 pt-1.5">
                <Snowflake className="h-3 w-3 text-primary/70" />
                <span className="text-xs font-semibold text-primary/75">{celebrating.perk}</span>
              </div>
            )}
          </motion.div>

          <div className="mb-6 flex w-full items-center gap-2 text-[11px] font-semibold text-black/45">
            <span className="flex-1 rounded-lg bg-[#f0f0ea] px-3 py-2">{credits} credits total</span>
            <span className="flex-1 rounded-lg bg-[#f0f0ea] px-3 py-2">{freezes} freezes left</span>
          </div>

          {isRecord && <p className="mb-4 -mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">🏆 New personal best</p>}

          <StickerButton variant="primary" size="lg" className="w-full" onClick={dismissCelebration}>
            Keep it going
          </StickerButton>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default StreakMilestoneModal;
