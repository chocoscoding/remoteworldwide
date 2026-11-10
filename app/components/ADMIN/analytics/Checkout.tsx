import type { FC } from "react";
import { cn } from "@/lib/utils";
import { money } from "@/app/lib/pricing/catalogue";
import { CHECKOUT_STATUS_LABELS, type CheckoutBrief } from "@/app/lib/tracking/types";

// How a payment someone started ended, for the admin's user page and the activity drill-down.

const STATUS_STYLE: Record<CheckoutBrief["status"], string> = {
  completed: "bg-[#e1f073] text-black",
  pending: "border border-black bg-white text-black",
  canceled: "bg-gray-100 text-gray-600",
  failed: "bg-[#fdeae6] text-[#b23c26]",
};

const INTERVALS: Record<string, string> = { month: "monthly", quarter: "quarterly", year: "yearly" };

/** What was being bought, in words: "Pro, monthly, $15" or "50 credits, $5". */
export const checkoutWhat = (c: CheckoutBrief): string => {
  const item =
    c.kind === "subscription"
      ? [c.planKey ? c.planKey[0].toUpperCase() + c.planKey.slice(1) : "Plan", c.interval ? INTERVALS[c.interval] ?? c.interval : null].filter(Boolean).join(", ")
      : c.credits
        ? `${c.credits.toLocaleString("en-GB")} credits`
        : c.packKey ?? "Credits";
  return `${item}, ${money(c.amountCents, c.currency)}`;
};

export const CheckoutBadge: FC<{ checkout: CheckoutBrief; className?: string }> = ({ checkout, className }) => {
  const { label, hint } = CHECKOUT_STATUS_LABELS[checkout.status];
  return (
    <span title={checkout.provider ? hint : `${hint} (reserved while card payments were off)`} className={cn("inline-flex flex-none rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", STATUS_STYLE[checkout.status], className)}>
      {label}
    </span>
  );
};
