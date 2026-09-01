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
  rewrite: { kind: "rewrite", label: "Resume rewrite", detail: "A full pass over one saved resume.", icon: Sparkles },
  "pro-day": { kind: "pro-day", label: "1 day of Pro", detail: "Unlimited tailoring for 24 hours.", icon: Crown },
  "referral-intro": { kind: "referral-intro", label: "Priority referral intro", detail: "Jump the queue on one warm intro.", icon: Users },
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
}

/** Unused gifts, oldest first — redemption consumes from the front. */
export function heldGifts(gifts: GiftEvent[]): GiftEvent[] {
  return gifts.filter((g) => !g.usedAt);
}

/** Held count for one kind. */
export function heldOf(gifts: GiftEvent[], kind: GiftKind): number {
  return gifts.reduce((n, g) => (g.kind === kind && !g.usedAt ? n + 1 : n), 0);
}
