// Credit ledger and the things credits are for.
//
// The ledger is append-only and the balance is always summed from it, never
// stored as a mutable integer. That's not ceremony: the dashboard previously
// had four independent "balances" (a hardcoded 18 in the sidebar, an 18 in
// streak state, a 40 passed to RewardModal, a 38 computed on the invites
// screen) which silently disagreed the moment anything was earned. One list,
// one derivation, no drift.
//
// The sink ships alongside the earning. A balance with nothing to spend it on
// is a currency users correctly read as fake.

import type { LucideIcon } from "lucide-react";
import { Bell, CalendarPlus, Crown, RotateCcw, Snowflake, Sparkles, Users } from "lucide-react";

export interface CreditEntry {
  id: string;
  /** Positive when earned, negative when spent. */
  delta: number;
  reason: string;
  /** Milestone day-count, application id, spend-item id — whatever caused it. */
  refId?: string;
  at: string;
}

/** The only way to read a balance. */
export function balanceOf(ledger: CreditEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.delta, 0);
}

export function canAfford(ledger: CreditEntry[], cost: number): boolean {
  return balanceOf(ledger) >= cost;
}

// ---------------------------------------------------------------------------
// Spend catalogue
// ---------------------------------------------------------------------------

export type SpendItemId = "backfill" | "restore" | "freeze" | "rewrite" | "pro-day" | "referral-intro";

export interface SpendItem {
  id: SpendItemId;
  label: string;
  detail: string;
  icon: LucideIcon;
  /** Fixed price, or null when the price depends on context (restore). */
  cost: number | null;
}

export const SPEND_CATALOGUE: SpendItem[] = [
  { id: "backfill", label: "Backfill yesterday", detail: "Log a day you forgot to record.", icon: CalendarPlus, cost: 10 },
  { id: "restore", label: "Restore your streak", detail: "Priced by how long the streak was.", icon: RotateCcw, cost: null },
  { id: "freeze", label: "Extra freeze", detail: "Covers one unplanned missed day.", icon: Snowflake, cost: 15 },
  { id: "rewrite", label: "Resume rewrite", detail: "A full pass over one saved resume.", icon: Sparkles, cost: 20 },
  { id: "pro-day", label: "1 day of Pro", detail: "Unlimited tailoring for 24 hours.", icon: Crown, cost: 25 },
  { id: "referral-intro", label: "Priority referral intro", detail: "Jump the queue on one warm intro.", icon: Users, cost: 40 },
];

/** Restoring costs more the more you'd be getting back. */
export function restoreCost(streakLength: number): number {
  return 10 + streakLength;
}

/** Resolved price for a catalogue item in the current context. */
export function priceOf(item: SpendItem, streakLength: number): number {
  return item.cost ?? restoreCost(streakLength);
}

// ---------------------------------------------------------------------------
// Repair window
// ---------------------------------------------------------------------------

/** How long after a break a streak can still be bought back. */
export const REPAIR_WINDOW_HOURS = 48;

/** A free half-restore is available once every this many days. */
export const FREE_RESTORE_COOLDOWN_DAYS = 30;

export interface RepairOffer {
  /** Whether the streak is still inside the 48h buy-back window. */
  available: boolean;
  /** Hours left to decide. */
  hoursLeft: number;
  /** What a full restore costs right now. */
  cost: number;
  /** Length that would be restored. */
  restores: number;
  /** Half the streak, rounded down — the free fallback when they can't pay. */
  halfRestores: number;
  freeRestoreAvailable: boolean;
}

/**
 * Works out what can be offered after a break. The moment after a break is
 * when people churn, so this always returns *something* — if the window has
 * closed the caller shows the comeback screen instead of a bare zero.
 */
export function repairOffer(opts: {
  brokenStreak: number;
  hoursSinceBreak: number;
  ledger: CreditEntry[];
  daysSinceFreeRestore: number | null;
}): RepairOffer {
  const { brokenStreak, hoursSinceBreak, ledger, daysSinceFreeRestore } = opts;
  const cost = restoreCost(brokenStreak);
  return {
    available: hoursSinceBreak <= REPAIR_WINDOW_HOURS,
    hoursLeft: Math.max(0, Math.ceil(REPAIR_WINDOW_HOURS - hoursSinceBreak)),
    cost,
    restores: brokenStreak,
    halfRestores: Math.floor(brokenStreak / 2),
    freeRestoreAvailable:
      !canAfford(ledger, cost) && (daysSinceFreeRestore === null || daysSinceFreeRestore >= FREE_RESTORE_COOLDOWN_DAYS),
  };
}

// ---------------------------------------------------------------------------
// At-risk prompting
// ---------------------------------------------------------------------------

/** Hour after which the in-app at-risk banner may appear. */
export const AT_RISK_HOUR = 20;

/** Hard cap on streak prompts per day, per §8. */
export const MAX_STREAK_PROMPTS_PER_DAY = 2;

export const NOTIFY_ICON: LucideIcon = Bell;
