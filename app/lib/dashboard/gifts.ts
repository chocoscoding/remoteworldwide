// The gift economy — what the streak system actually hands out.
//
// There is no shop and no price list: the things users used to buy with
// credits (freezes, backfills, rewrites, Pro days, priority intros, restores)
// are now GIFTED by milestones and strong moments, held in an inventory, and
// redeemed whenever the owner chooses. Referral credits are a separate story
// that lives on the invites page, not here.
//
// Pure and dependency-free; `rng` is injectable everywhere for the same
// reasons as rewards past: testability, and never tempting a caller into
// Math.random() during render.

import type { LucideIcon } from "lucide-react";
import { CalendarPlus, Crown, RotateCcw, Snowflake, Sparkles, Users } from "lucide-react";

export type GiftKind = "freeze" | "backfill" | "rewrite" | "pro-day" | "referral-intro" | "restore";

export interface GiftSpec {
  kind: GiftKind;
  label: string;
  /** What using it does — shown on the inventory row. */
  detail: string;
  icon: LucideIcon;
}

export const GIFT_CATALOGUE: Record<GiftKind, GiftSpec> = {
  freeze: { kind: "freeze", label: "Streak freeze", detail: "Covers one unplanned missed day.", icon: Snowflake },
  backfill: { kind: "backfill", label: "Backfill", detail: "Logs a day you forgot to record.", icon: CalendarPlus },
  rewrite: { kind: "rewrite", label: "Resume rewrite", detail: "One free full AI rewrite of a saved resume.", icon: Sparkles },
  "pro-day": { kind: "pro-day", label: "1 day of Pro", detail: "Interview prep, likely questions and every Pro feature for 24 hours.", icon: Crown },
  "referral-intro": {
    kind: "referral-intro",
    label: "Priority referral intro",
    detail: "You go to the top of the list for one recommendation to a company.",
    icon: Users,
  },
  restore: { kind: "restore", label: "Streak restore", detail: "Brings a broken streak back whole.", icon: RotateCcw },
};

/**
 * Gift rarity tiers. Which gift you get is drawn at the moment it's earned —
 * the surprise is the point — but the tier scales with the moment: routine
 * wins pull from the small pool, a reached offer pulls from the big one.
 */
export type GiftTier = "small" | "mid" | "big";

export const GIFT_POOLS: Record<GiftTier, GiftKind[]> = {
  small: ["backfill", "freeze"],
  mid: ["freeze", "rewrite"],
  big: ["pro-day", "referral-intro", "restore"],
};

/** Draws one gift from a tier's pool. `rng` returns [0, 1). */
export function drawGift(tier: GiftTier, rng: () => number = Math.random): GiftKind {
  const pool = GIFT_POOLS[tier];
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/**
 * One gift's life: granted with a reason, later used (or still waiting).
 * `refId` carries the same dedupe keys the credit ledger used — an
 * application id, an ISO week, a milestone's day count — so nothing can be
 * earned twice.
 */
export interface GiftEvent {
  id: string;
  kind: GiftKind;
  reason: string;
  refId?: string;
  at: string;
  usedAt?: string;
  /** A used service gift delivered: the day of Pro started, the rewrite built, the intro made. */
  deliveredAt?: string;
  /** What it produced: a day of Pro's end (ISO), "waiting" for a priority intro. */
  detail?: string;
  /** An interview or offer gift on hold until then (ISO): listed, not usable yet. */
  pendingUntil?: string;
}

/** Ready to use: not used, and not on hold. */
export const isWaiting = (gift: Pick<GiftEvent, "usedAt" | "pendingUntil">): boolean => !gift.usedAt && !gift.pendingUntil;

/** What a priority intro's `detail` reads while it waits for a reviewer. */
export const INTRO_WAITING = "waiting";

/**
 * A gift's state for the history list: "waiting" while unused, then what using it did. `when`
 * formats a day of Pro's end ("Oct 7, 3:45 PM"), so the time zone is the caller's.
 */
export function giftStatusLabel(gift: GiftEvent, when: (iso: string) => string): string {
  if (!gift.usedAt && gift.pendingUntil) return `lands ${when(gift.pendingUntil)} if the card is still there`;
  if (!gift.usedAt) return "waiting";
  switch (gift.kind) {
    case "pro-day": {
      const ends = gift.detail && !Number.isNaN(Date.parse(gift.detail)) ? gift.detail : null;
      return ends ? `used, Pro until ${when(ends)}` : "used";
    }
    case "rewrite":
      return gift.deliveredAt ? "used, rewrite ready" : "used";
    case "referral-intro":
      return gift.deliveredAt ? "used, recommendation sent" : "used, top of the list";
    default:
      return "used";
  }
}

/** Unused gifts, oldest first — redemption consumes from the front. */
export function heldGifts(gifts: GiftEvent[]): GiftEvent[] {
  return gifts.filter(isWaiting);
}

/**
 * A priority referral intro has been redeemed (waiting for a reviewer, or delivered). The backend
 * lets such an account read and answer its recommendations on any plan, so the screens that lock
 * recommendations below Basic stay open for it.
 */
export function holdsPriorityIntro(gifts: GiftEvent[]): boolean {
  return gifts.some((g) => g.kind === "referral-intro" && Boolean(g.usedAt));
}

/** Held count for one kind. */
export function heldOf(gifts: GiftEvent[], kind: GiftKind): number {
  return gifts.reduce((n, g) => (g.kind === kind && isWaiting(g) ? n + 1 : n), 0);
}
