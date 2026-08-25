"use client";

import { FC, useMemo, useState } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Check, Copy, Instagram, Link2, Linkedin, MessageCircle, Trophy, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";

/**
 * Shared "share a win" overlay — opened from the Pod screen (tier
 * "Interview") and the Invites screen (tier "Weekly goal"), and reused for
 * "Offer" wherever that milestone fires. Purely local state: `onConfirm` is
 * called when the user commits to sharing (the parent screen decides what
 * happens next, typically opening RewardModal) — this component never talks
 * to a backend.
 */
export type ShareWinTier = "Interview" | "Offer" | "Weekly goal";

export interface ShareWinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: ShareWinTier;
  onConfirm: () => void;
}

interface TierStyle {
  title: string;
  subtitle: string;
  badgeBg: string;
  badgeText: string;
  slug: string;
}

// Full literal Tailwind classes per key (not built from template strings) so
// every class is visible to Tailwind's static build-time scan — same
// convention as StickerButton's STICKER_SHADOW_HOVER map.
const TIER_STYLES: Record<ShareWinTier, TierStyle> = {
  Interview: {
    title: "Interview booked",
    subtitle: "Round two at Deel.",
    badgeBg: "bg-[#e1f073]",
    badgeText: "text-[#222325]",
    slug: "interview",
  },
  Offer: {
    title: "Offer received",
    subtitle: "Offer from Deel.",
    badgeBg: "bg-[#f0c86a]",
    badgeText: "text-[#222325]",
    slug: "offer",
  },
  "Weekly goal": {
    title: "Weekly goal hit",
    subtitle: "10 applications, 5 days.",
    badgeBg: "bg-[#cddd54]",
    badgeText: "text-[#222325]",
    slug: "weekly-goal",
  },
};

const CONFETTI_COLORS = ["bg-[#e1f073]", "bg-[#f0c86a]", "bg-[#cddd54]", "bg-[#222325]", "bg-white"];
const CONFETTI_SIZES = ["h-1.5 w-1.5", "h-2 w-1", "h-1 w-2.5", "h-2 w-2"];
const CONFETTI_COUNT = 24;
// Falls the full height of the card before the overlay clips it — comfortably
// taller than this modal ever renders at `max-w-md`.
const CONFETTI_FALL_DISTANCE = 520;

interface ConfettiPiece {
  id: number;
  left: number;
  colorClass: string;
  sizeClass: string;
  rotate: number;
  duration: number;
  delay: number;
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 100),
    colorClass: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    sizeClass: CONFETTI_SIZES[Math.floor(Math.random() * CONFETTI_SIZES.length)],
    rotate: Math.round((Math.random() - 0.5) * 540),
    duration: 1.6 + Math.random() * 1.4,
    delay: Math.random() * 0.55,
  }));
}

const SHARE_TARGETS = [
  { id: "instagram", label: "Instagram story", icon: Instagram },
  { id: "whatsapp", label: "WhatsApp status", icon: MessageCircle },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "chain", label: "My invite chain", icon: Link2 },
] as const;

const ShareWinModal: FC<ShareWinModalProps> = ({ open, onOpenChange, tier, onConfirm }) => {
  const style = TIER_STYLES[tier];
  const [soundOn, setSoundOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedShare, setSelectedShare] = useState<(typeof SHARE_TARGETS)[number]["id"] | null>(null);

  // Recomputed every time the modal opens so the burst looks fresh each time,
  // rather than replaying the exact same positions.
  const confetti = useMemo(() => (open ? makeConfetti() : []), [open]);
  const winUrl = `remoteworldwide.net/w/amara-${style.slug}`;

  // Reset transient UI state (copy confirmation, selected share target) once
  // the dialog finishes closing. Adjusting state during render off a
  // ref-tracked previous value — rather than in a useEffect — is the pattern
  // React recommends for "reset state when a prop changes".
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setCopied(false);
      setSelectedShare(null);
    }
  }

  const handleCopy = () => {
    setCopied(true);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`https://${winUrl}`).catch(() => {});
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-[20px] border-0 p-0 max-w-md overflow-hidden">
        <DialogTitle className="sr-only">{style.title}</DialogTitle>
        <DialogDescription className="sr-only">Share this win with your pod or your network.</DialogDescription>

        <div className="relative">
          {/* Confetti layer — falls over the whole card, clipped by overflow-hidden above */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {confetti.map((p) => (
              <motion.span
                key={p.id}
                className={cn("absolute top-0 block rounded-[1px]", p.colorClass, p.sizeClass)}
                style={{ left: `${p.left}%` }}
                initial={{ y: -24, rotate: 0, opacity: 0 }}
                animate={{ y: CONFETTI_FALL_DISTANCE, rotate: p.rotate, opacity: [0, 1, 1, 0] }}
                transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
              />
            ))}
          </div>

          {/* Sound toggle — offset left of the dialog's built-in close (X) button */}
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-label={soundOn ? "Mute win sound" : "Unmute win sound"}
            className="absolute top-4 right-14 z-10 h-8 w-8 rounded-full bg-black/5 text-primary/70 flex items-center justify-center hover:bg-black/10 hover:text-primary transition-colors cursor-pointer">
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <div className="relative px-6 pt-9 pb-6 flex flex-col items-center text-center">
            {/* Tier-branded trophy panel */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.1 }}
              className={cn("h-16 w-16 rounded-2xl flex items-center justify-center mb-4", style.badgeBg)}>
              <Trophy className={cn("h-7 w-7", style.badgeText)} />
            </motion.div>

            <p className="text-lg font-bold text-primary">{style.title}</p>
            <p className="text-sm text-black/50 mt-1">{style.subtitle}</p>

            {/* Copyable verified win URL */}
            <p className="mt-5 mb-2 self-start flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40">
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified win link
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-[#f6f6f6] px-3 py-2.5 text-left cursor-pointer hover:border-black/20 transition-colors">
              <span className="text-xs font-medium text-black/60 truncate">{winUrl}</span>
              <span className={cn("flex-none inline-flex items-center gap-1 text-xs font-semibold", copied ? "text-[#6c7a1e]" : "text-primary")}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </span>
            </button>

            {/* Share targets */}
            <div className="mt-5 grid grid-cols-4 gap-2 w-full">
              {SHARE_TARGETS.map((t) => {
                const Icon = t.icon;
                const active = selectedShare === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedShare(t.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-3 cursor-pointer transition-colors",
                      active ? "border-primary bg-primary text-white" : "border-black/10 text-black/60 hover:border-black/25"
                    )}>
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-semibold leading-tight text-center">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Primary + dismiss actions */}
            <StickerButton variant="primary" size="lg" className="w-full mt-6" onClick={onConfirm}>
              Share this win
            </StickerButton>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-3 text-sm font-semibold text-black/45 hover:text-black/65 cursor-pointer">
              Not now
            </button>

            {/* Footer: monthly share progress */}
            <div className="mt-6 pt-5 border-t border-black/8 w-full flex items-center justify-between gap-3">
              <p className="text-xs text-black/45 text-left">Share 3 wins this month for 2 credits</p>
              <div className="flex-none flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={cn("h-1.5 w-4 rounded-full", i < 2 ? "bg-secondary" : "bg-[#f0f0ea]")} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareWinModal;
