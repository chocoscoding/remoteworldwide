"use client";

import type { FC } from "react";
import { cn } from "@/lib/utils";
import { useFreeUsage } from "@/hooks/queries/useFreeUsage";
import { PLAN_TIER_NAMES, freeLeftLabel, freeResetsLabel, type FreeFeature } from "@/app/lib/settings/types";
import { usePlanGate } from "./UpgradeModal";

/**
 * "2 of 3 free AI resume help left this month", for an account below the tool's plan. Once they are
 * used it says when they come back and offers the plan, which opens the upgrade popup (Pro leads
 * there). Renders nothing on a plan that has the tool, or when the count is unknown.
 */
const FreeUsesNote: FC<{ feature: FreeFeature; noun: string; tone?: "light" | "dark"; className?: string }> = ({ feature, noun, tone = "light", className }) => {
  const usage = useFreeUsage();
  const { openUpgrade } = usePlanGate();
  const allowance = usage.of(feature);
  if (!allowance || !usage.month) return null;

  const spent = allowance.left === 0;
  const plan = PLAN_TIER_NAMES[allowance.plan];
  return (
    <p
      data-free-uses={feature}
      className={cn("text-xs leading-relaxed tabular-nums", tone === "dark" ? "text-white/55" : "text-black/50", className)}>
      {freeLeftLabel(allowance, noun)}
      {spent ? `. More on ${freeResetsLabel(usage.month)}, or ` : ". "}
      <button
        type="button"
        onClick={() =>
          openUpgrade({
            kind: "plan",
            requiredPlan: allowance.plan,
            message: spent ? `You've used this month's free ${noun}. ${plan} and up have no monthly cap.` : `${plan} and up have no monthly cap on this.`,
          })
        }
        className={cn("cursor-pointer font-bold underline underline-offset-2", tone === "dark" ? "text-[#e1f073]" : "text-primary")}>
        {spent ? `upgrade now` : `No cap on ${plan}`}
      </button>
    </p>
  );
};

export default FreeUsesNote;
