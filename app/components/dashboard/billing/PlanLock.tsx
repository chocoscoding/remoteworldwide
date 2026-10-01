"use client";

import { useCallback, type FC, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import type { PlanGateSpec } from "@/app/lib/settings/planGates";
import { PLAN_TIER_NAMES } from "@/app/lib/settings/types";
import { PlanChip, usePlanGate } from "./UpgradeModal";

/**
 * Whether the account's plan is below `gate`, and the upgrade popup for it, opened before any
 * request is made. The control it guards stays on screen: pressing it is what offers the plan.
 */
export function usePlanLock(gate: PlanGateSpec) {
  const { allows, openUpgrade } = usePlanGate();
  const { plan, message } = gate;
  const upgrade = useCallback(() => openUpgrade({ kind: "plan", requiredPlan: plan, message }), [openUpgrade, plan, message]);
  return { locked: !allows(plan), upgrade };
}

export interface PlanLockNoteProps {
  gate: PlanGateSpec;
  title: string;
  body?: ReactNode;
  /** `dark` for the coach's ink rail; `light` everywhere else. */
  tone?: "light" | "dark";
  className?: string;
}

/**
 * The quiet stand-in for a feature the plan doesn't include: the plan chip, what it is, and one way
 * to get it. Hairlines and no shadow at rest; the button lifts on hover like every sticker button.
 */
export const PlanLockNote: FC<PlanLockNoteProps> = ({ gate, title, body, tone = "light", className }) => {
  const { upgrade } = usePlanLock(gate);
  const label = `Upgrade to ${PLAN_TIER_NAMES[gate.plan]}`;

  if (tone === "dark") {
    return (
      <div data-plan-lock className={cn("flex flex-col items-start gap-1.5 px-2 py-1.5", className)}>
        <PlanChip plan={gate.plan} />
        <p className="text-xs font-semibold leading-snug text-white/85">{title}</p>
        {body ? <p className="text-[11px] leading-relaxed text-white/45">{body}</p> : null}
        <button type="button" onClick={upgrade} className="mt-0.5 cursor-pointer rounded text-xs font-bold text-[#e1f073] hover:underline">
          {label}
        </button>
      </div>
    );
  }

  return (
    <div data-plan-lock className={cn("flex flex-col items-start gap-2 rounded-xl border border-black/12 bg-white px-5 py-4", className)}>
      <PlanChip plan={gate.plan} className="bg-white" />
      <div>
        <p className="text-sm font-bold text-primary">{title}</p>
        {body ? <p className="mt-0.5 text-xs leading-relaxed text-black/55">{body}</p> : null}
      </div>
      <StickerButton variant="outline" size="sm" onClick={upgrade}>
        {label}
      </StickerButton>
    </div>
  );
};
