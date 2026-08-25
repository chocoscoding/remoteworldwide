"use client";

import { FC, useMemo } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";

/**
 * Small celebration overlay shown right after `ShareWinModal` confirms a
 * share — a confetti burst, a big "+N credits" badge, and the new running
 * balance. Purely a visual payoff: dismissing it (via "Nice" or the dialog's
 * own close affordances) just flips `open` back to false, no real credit
 * ledger exists behind this.
 */
export interface RewardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Credits earned this time, shown as "+{amount} credits". */
  amount: number;
  /** Headline, e.g. "Three wins shared". */
  title: string;
  /** Supporting copy under the headline. */
  body: string;
  /** Running total shown as "New balance: {balance} credits". */
  balance: number;
}

const CONFETTI_COLORS = ["#e1f073", "#cddd54", "#f0c86a", "#222325"];
const CONFETTI_COUNT = 26;

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

const RewardModal: FC<RewardModalProps> = ({ open, onOpenChange, amount, title, body, balance }) => {
  // Radix unmounts DialogContent's subtree while closed, so this component
  // remounts fresh (new random confetti paths) each time it opens.
  const confetti = useMemo(() => makeConfetti(), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-[20px] border-0 p-0 max-w-md overflow-hidden gap-0">
        {/* Falling confetti, concentrated near the top of the card */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
          {confetti.map((piece) => (
            <motion.span
              key={piece.id}
              initial={{ y: -16, x: 0, opacity: 0, rotate: 0 }}
              animate={{ y: 260, x: piece.drift, opacity: [0, 1, 1, 0], rotate: piece.rotate }}
              transition={{ duration: piece.duration, delay: piece.delay, ease: "easeIn" }}
              className="absolute top-0 rounded-[1.5px]"
              style={{
                left: `${piece.leftPct}%`,
                width: piece.width,
                height: piece.height,
                backgroundColor: piece.color,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 26 }}
          className="relative z-10 flex flex-col items-center px-8 pt-10 pb-8 text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 380, damping: 20 }}
            className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-secondary px-5 py-2.5"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-2xl font-extrabold leading-none text-primary tabular-nums">+{amount}</span>
            <span className="text-sm font-bold text-primary/70">credits</span>
          </motion.div>

          <DialogTitle className="mb-2 text-xl font-bold text-primary">{title}</DialogTitle>
          <DialogDescription className="mb-6 max-w-[300px] text-sm leading-relaxed text-black/55">{body}</DialogDescription>

          <div className="mb-7 w-full rounded-xl bg-[#f0f0ea] px-5 py-3">
            <span className="text-sm font-semibold text-black/55">
              New balance: <span className="font-bold text-primary">{balance} credits</span>
            </span>
          </div>

          <StickerButton variant="primary" size="lg" className="w-full" onClick={() => onOpenChange(false)}>
            Nice
          </StickerButton>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default RewardModal;
