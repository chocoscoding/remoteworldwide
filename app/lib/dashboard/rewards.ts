// Strong-moment rewards — which events earn a gift, and how each one is
// deduped forever. The credit bands that used to live here are gone: the
// streak pays in gifts now (see ./gifts), never in currency.

import type { GiftKind, GiftTier } from "./gifts";

export type StrongEventKind = "weekly-goal" | "answered-questions" | "reached-interview" | "reached-offer";

export interface StrongEventSpec {
  kind: StrongEventKind;
  /**
   * Either a fixed gift (answering a company's questions always earns a
   * rewrite — the two belong together) or a tier to draw from.
   */
  gift: GiftKind | { tier: GiftTier };
  reason: string;
}

export const STRONG_EVENTS: Record<StrongEventKind, StrongEventSpec> = {
  "weekly-goal": { kind: "weekly-goal", gift: { tier: "small" }, reason: "Weekly goal met" },
  "answered-questions": { kind: "answered-questions", gift: "rewrite", reason: "Answered a company's questions" },
  "reached-interview": { kind: "reached-interview", gift: { tier: "mid" }, reason: "Reached interview" },
  "reached-offer": { kind: "reached-offer", gift: { tier: "big" }, reason: "Offer reached" },
};

/**
 * `refId` for a rare event — the suffix is whatever makes it unique forever:
 * an ISO week for the weekly goal, an application id for a stage change, a
 * recommendation id for answered questions.
 */
export const strongRefId = (kind: StrongEventKind, suffix: string) => `${kind}:${suffix}`;

/** ISO-ish week key (`2026-W36`) — the weekly goal's dedupe suffix. */
export function weekKey(d: Date): string {
  const probe = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Thursday of this week decides the ISO year/week.
  probe.setDate(probe.getDate() + 3 - ((probe.getDay() + 6) % 7));
  const firstThursday = new Date(probe.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const week = 1 + Math.round((probe.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${probe.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
