// The streak contract — mirrored from remoteworldwidebackend/src/types/streak.ts,
// which owns it. Change it there first.
//
// The streak is derived on the server from the activity log: a day counts
// because something real was written for it (an application, a status change,
// a follow-up, a referral ask or pod post, a finished prep session), in the
// user's own timezone, with the 4am grace hour, rest days and pauses applied,
// and freezes spent automatically. The browser reads it and never computes it.

import type { ActionKind } from "@/app/lib/dashboard/activity";
import type { GiftKind } from "@/app/lib/dashboard/gifts";

export type StreakDayStatus = "logged" | "backfilled" | "rest" | "freeze" | "missed" | "today";

/** One day of history; `kinds` counts that day's qualifying actions, which the browser weighs (`ACTION_KINDS`). */
export interface StreakDayItem {
  date: string;
  status: StreakDayStatus;
  kinds: Partial<Record<ActionKind, number>>;
  /** Why a neutral day is neutral ("Paused", "Repaired with credits"). */
  note: string | null;
}

export interface StreakMilestoneItem {
  days: number;
  gift: GiftKind;
  at: string;
  /** False until its celebration has been shown. */
  seen: boolean;
}

/** A freeze the server spent on its own — told once, after the fact. */
export interface StreakNotice {
  day: string;
  kind: "freeze";
  tier: "free" | "held";
}

/** Present while a break can still be bought back. */
export interface StreakRepairOffer {
  day: string;
  brokenStreak: number;
  hoursSinceBreak: number;
  hoursLeft: number;
  priceCredits: number;
  restoreHeld: boolean;
  freeHalfAvailable: boolean;
  halfDays: number;
}

export interface StreakAuditItem {
  id: string;
  at: string;
  day: string;
  from: StreakDayStatus | "none";
  to: StreakDayStatus;
  reason: string;
}

/** `GET /api/streak`. */
export interface StreakItem {
  timezone: string;
  /** Today's key after the grace hour. */
  today: string;
  /** The hour on the user's own clock. */
  localHour: number;
  current: number;
  longest: number;
  loggedToday: boolean;
  days: StreakDayItem[];
  freezes: { free: number; held: number; cap: number };
  milestones: StreakMilestoneItem[];
  notices: StreakNotice[];
  repair: StreakRepairOffer | null;
  freeRestoreUsed: boolean;
  giftsWaiting: number;
  retiredStreak: number | null;
  audit: StreakAuditItem[];
}

export interface GiftItem {
  id: string;
  kind: GiftKind;
  reason: string;
  refId: string | null;
  at: string;
  usedAt: string | null;
}

/** `GET /api/streak/gifts`, and every gift or repair write. */
export interface StreakWithGifts {
  streak: StreakItem;
  gifts: GiftItem[];
}

export type RepairMethod = "credits" | "gift" | "half";

/** A habit, stored on the goals row. */
export interface HabitItem {
  id: string;
  label: string;
  kind: ActionKind;
}

/** The ledger's `refId` for a milestone's gift. */
export const milestoneGiftRef = (days: number) => `milestone:${days}`;
