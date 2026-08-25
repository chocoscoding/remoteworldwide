"use client";

// The animated flame that every streak surface shares.
//
// Two layered behaviours:
// It sits still by default — a permanently pulsating flame in a fixed header
// is a distraction, not a signal. The only motion is a one-shot burst (a pop
// plus radiating sparks) replayed whenever the `pulse` prop changes, so the
// animation means "you just logged something" rather than "this page is on".
// Driven by a changing key rather than a boolean so two logs animate twice.
//
// Honours `prefers-reduced-motion`, which collapses the burst too.

import { useEffect, useState, type FC } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import type { StreakTier } from "@/app/lib/dashboard/streak";

/** Fixed spark geometry — deterministic so server and client agree. */
const SPARKS = [
  { x: 0, y: -26 },
  { x: 20, y: -18 },
  { x: 26, y: 2 },
  { x: 17, y: 20 },
  { x: -2, y: 27 },
  { x: -19, y: 19 },
  { x: -26, y: 1 },
  { x: -18, y: -18 },
];

export interface StreakFlameProps {
  tier: StreakTier;
  /** Font size of the emoji, in px. */
  size?: number;
  /**
   * Changing this value replays the burst. Leave undefined for a
   * flicker-only flame.
   */
  pulse?: number;
  /** Renders the flame greyed out and still — for a broken/unstarted streak. */
  dimmed?: boolean;
  className?: string;
}

const StreakFlame: FC<StreakFlameProps> = ({ tier, size = 18, pulse, dimmed = false, className }) => {
  const reduceMotion = useReducedMotion();
  const [burstKey, setBurstKey] = useState<number | null>(null);

  // Fire the burst only on a *change* of `pulse`, never on first mount —
  // otherwise every page load would look like a fresh achievement. This is
  // React's documented "adjusting state when a prop changes" pattern: setting
  // state during render is cheaper than an effect, which would paint the
  // un-burst frame first and then immediately re-render.
  const [seenPulse, setSeenPulse] = useState(pulse);
  if (pulse !== undefined && pulse !== seenPulse) {
    setSeenPulse(pulse);
    setBurstKey(pulse);
  }

  // Clearing the burst *is* a timer, so it belongs in an effect — the
  // setState here runs from the timeout callback, never synchronously.
  useEffect(() => {
    if (burstKey === null) return;
    const t = setTimeout(() => setBurstKey(null), 900);
    return () => clearTimeout(t);
  }, [burstKey]);

  return (
    <span className={cn("relative inline-flex items-center justify-center leading-none", className)} style={{ width: size, height: size }}>
      {/* Radiating sparks on burst */}
      <AnimatePresence>
        {burstKey !== null && !reduceMotion && (
          <>
            {SPARKS.map((spark, i) => (
              <motion.span
                key={`${burstKey}-${i}`}
                aria-hidden
                initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
                animate={{ opacity: 0, x: spark.x, y: spark.y, scale: 0.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: "easeOut", delay: i * 0.012 }}
                className="pointer-events-none absolute h-1 w-1 rounded-full bg-[#e1f073]"
              />
            ))}
            {/* Expanding ring */}
            <motion.span
              key={`ring-${burstKey}`}
              aria-hidden
              initial={{ opacity: 0.55, scale: 0.4 }}
              animate={{ opacity: 0, scale: 2.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#e1f073]"
            />
          </>
        )}
      </AnimatePresence>

      <motion.span
        aria-hidden
        className={cn("inline-flex select-none", dimmed && "grayscale opacity-40")}
        style={{ fontSize: size, lineHeight: 1 }}>
        <motion.span
          className="inline-block"
          animate={burstKey !== null && !reduceMotion ? { scale: [1, 1.75, 1] } : { scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}>
          {tier.emoji}
        </motion.span>
      </motion.span>
    </span>
  );
};

export default StreakFlame;
