"use client";

import { useEffect, useRef, type FC, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import type { PlanGateSpec } from "@/app/lib/settings/planGates";
import { PLAN_TIER_NAMES } from "@/app/lib/settings/types";
import { PlanChip } from "./UpgradeModal";
import { usePlanLock } from "./PlanLock";

export interface PlanPageLockProps {
  gate: PlanGateSpec;
  /** The page's own title, kept in its header so the sidebar and the header still agree. */
  title: string;
  /** The card's heading: what the plan gives, in a few words. */
  heading: string;
  body: ReactNode;
  /** Anything the page still lets a lower plan do, under the buttons (the pod's "Leave it"). */
  footer?: ReactNode;
}

/** Shapes standing in for the page under the card. Never the page itself: nothing of it is fetched or rendered. */
const Ghost: FC = () => (
  <div aria-hidden className="pointer-events-none select-none px-4 py-7 md:px-8">
    <div className="mx-auto grid max-w-[1180px] gap-5 md:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="h-28 rounded-xl border border-black/10 bg-white" />
        <div className="h-44 rounded-xl border border-black/10 bg-white" />
        <div className="h-32 rounded-xl border border-black/10 bg-white" />
      </div>
      <div className="hidden flex-col gap-4 md:flex">
        <div className="h-52 rounded-xl border border-black/10 bg-white" />
        <div className="h-24 rounded-xl border border-black/10 bg-white" />
      </div>
    </div>
  </div>
);

/**
 * A whole dashboard page a lower plan has none of (owner, 2026-10-28): the page's header, a modal
 * card over a faded stand-in, and no page content at all, since nothing below the plan should be
 * fetched or shown. "Upgrade" opens the same upgrade popup a locked control does; the card can't be
 * closed, only left, because there is nothing behind it to go back to.
 */
const PlanPageLock: FC<PlanPageLockProps> = ({ gate, title, heading, body, footer }) => {
  const { upgrade } = usePlanLock(gate);
  const card = useRef<HTMLDivElement>(null);
  const plan = PLAN_TIER_NAMES[gate.plan];

  // Focus starts in the card, so a keyboard lands on what the page is now.
  useEffect(() => {
    card.current?.focus();
  }, []);

  return (
    <div className="relative min-h-screen bg-[#f6f6f6]" data-plan-page-lock={gate.plan}>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-4 backdrop-blur-sm md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate whitespace-nowrap text-[17px] font-bold text-primary">{title}</h1>
          <PlanChip plan={gate.plan} />
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <NotificationBell />
        </div>
      </header>

      <div className="opacity-50 blur-[2px]">
        <Ghost />
      </div>

      <div className="absolute inset-x-0 bottom-0 top-16 z-10 flex items-start justify-center bg-[#f6f6f6]/40 px-4 pt-16 md:pt-24">
        <div
          ref={card}
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-page-lock-heading"
          tabIndex={-1}
          className="w-full max-w-md rounded-2xl border border-[#222325] bg-white p-6 text-center br-shadow focus:outline-none sm:p-8">
          <PlanChip plan={gate.plan} className="mx-auto" />
          <h2 id="plan-page-lock-heading" className="mt-3 text-xl font-extrabold text-primary">
            {heading}
          </h2>
          <div className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-black/55">{body}</div>
          <div className="mt-6 flex flex-col items-center gap-3">
            <StickerButton variant="primary" size="md" onClick={upgrade}>
              Upgrade to {plan}
            </StickerButton>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <Link href="/pricing" className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                Compare plans
              </Link>
              <Link href="/dashboard" className="inline-flex items-center gap-1 text-black/50 hover:text-primary">
                <ArrowLeft className="h-3 w-3" aria-hidden />
                Back to home
              </Link>
            </div>
          </div>
          {footer ? <div className="mt-5 border-t border-black/10 pt-4 text-xs text-black/50">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
};

export default PlanPageLock;
