import type { Subscription } from "./types";

/**
 * How much of this period's credits are used, as the billing screen and the sidebar ring show it.
 * Measured against everything held this period (what is left plus what was spent), so bought,
 * invite and reward credits count beside the plan's allowance: 400 held and nothing spent is 0%.
 * An older backend sends no `periodSpent`; then it falls back to the plan's allowance.
 */
export function creditMeter(subscription: Pick<Subscription, "creditBalance" | "monthlyCredits" | "periodSpent">): {
  left: number;
  total: number;
  usedPct: number;
} {
  const left = subscription.creditBalance;
  const spent = subscription.periodSpent ?? Math.max(0, (subscription.monthlyCredits || left) - left);
  const total = left + spent;
  const usedPct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  return { left, total, usedPct };
}
