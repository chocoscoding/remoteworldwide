"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FC, type ReactNode } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Coins, Lock, Plus, X } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useBilling } from "@/app/(pages)/(dashboard)/dashboard/settings/BillingProvider";
import { PLAN_LIMIT_EVENT, type PlanLimitDetail } from "@/app/lib/api/core";
import { money, perCredit } from "@/app/lib/pricing/catalogue";
import { PLAN_TIER_NAMES, isPlanTier, leadTierFor, tierAllows, upgradeTierFor, type Plan, type PlanTier } from "@/app/lib/settings/types";

/**
 * The one upgrade popup. It opens two ways:
 *
 * - on its own, when any call is refused for the account's plan (`rww:plan-limit`, dispatched by
 *   `unwrapEnvelope` for a 402 or a 403 "plan_required"), so no screen wires it by hand;
 * - from a locked control, via `usePlanGate().openUpgrade`, before any request is made.
 *
 * Out of credits: the next tier up and the top-up packs (Ultra sees packs only). A feature above the
 * tier: the plan that unlocks it. Below Pro, Pro leads either way and the smaller plan is the second
 * choice (`leadTierFor`). Choosing either goes through the same `buyPlan` / `buyCredits`
 * the billing screen uses: Stripe Checkout with payments on, a reservation without.
 */

interface PlanGate {
  tier: PlanTier;
  /** True when the account's tier is `min` or above, or the backend has the plan gates switched off. */
  allows: (min: PlanTier) => boolean;
  openUpgrade: (detail: PlanLimitDetail) => void;
}

const PlanGateContext = createContext<PlanGate | null>(null);

export function usePlanGate(): PlanGate {
  const ctx = useContext(PlanGateContext);
  if (!ctx) throw new Error("usePlanGate must be used within PlanGateProvider");
  return ctx;
}

const PlanOffer: FC<{ plan: Plan; reserved: boolean; busy: boolean; onChoose: () => void; why?: string | null }> = ({ plan, reserved, busy, onChoose, why }) => (
  <div className={why ? "rounded-xl bg-[#e1f073] p-4 br-shadow" : "rounded-xl border-[1.5px] border-[#222325] bg-[#fbfbf7] p-4"}>
    {why ? (
      <span className="mb-2 inline-flex rounded-full bg-[#222325] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#e1f073]">Recommended</span>
    ) : null}
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-base font-bold text-primary">{plan.name}</p>
      <p className="text-sm font-semibold text-primary tabular-nums">
        {money(plan.priceCents, plan.currency)}
        <span className="text-xs font-medium text-black/45">/{plan.interval}</span>
      </p>
    </div>
    <p className="mt-0.5 text-xs text-black/50 tabular-nums">
      {plan.monthlyCredits} credits a month · {perCredit(plan.priceCents, plan.monthlyCredits, plan.currency)} per credit
    </p>
    {why ? <p className="mt-2 text-xs font-semibold leading-relaxed text-[#222325]">{why}</p> : null}
    <ul className="mt-3 flex flex-col gap-1.5">
      {plan.features.slice(0, 4).map((feature) => (
        <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-black/70">
          <span className="mt-0.5 grid h-3.5 w-3.5 flex-none place-content-center rounded-full border border-[#222325] bg-[#e1f073]">
            <Check className="h-2 w-2 text-[#222325]" strokeWidth={4} />
          </span>
          {feature}
        </li>
      ))}
    </ul>
    <StickerButton variant="primary" size="md" className="mt-4 w-full" onClick={onChoose} disabled={busy || reserved}>
      {reserved ? "Reserved" : `Choose ${plan.name}`}
    </StickerButton>
  </div>
);

/** Why the lead plan over the smaller one, in facts from the catalogue: credits and the price gap. */
const leadReason = (lead: Plan, smaller: Plan): string => {
  const gap = lead.priceCents - smaller.priceCents;
  const extra = lead.key === "pro" ? ", plus interview prep and voice mock interviews" : "";
  return `${lead.monthlyCredits} credits a month instead of ${smaller.monthlyCredits}${extra}${gap > 0 ? `, for ${money(gap, lead.currency)} more` : ""}.`;
};

export const PlanGateProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { subscription, plans, creditPacks, busy, buyPlan, buyCredits, planGates, payments } = useBilling();
  const [detail, setDetail] = useState<PlanLimitDetail | null>(null);

  const tier: PlanTier = isPlanTier(subscription.tier) ? subscription.tier : "free";
  // PLAN_GATES_ENABLED=false on the backend unlocks every locked control too, not just the routes.
  const gated = planGates !== false;
  const allows = useCallback((min: PlanTier) => !gated || tierAllows(tier, min), [gated, tier]);
  const openUpgrade = useCallback((next: PlanLimitDetail) => setDetail(next), []);

  useEffect(() => {
    const onLimit = (event: Event) => setDetail((event as CustomEvent<PlanLimitDetail>).detail);
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit);
    return () => window.removeEventListener(PLAN_LIMIT_EVENT, onLimit);
  }, []);

  // The plan that unlocks it: the one a refusal names, or else the next tier up. Below Pro, Pro leads
  // and that smaller plan is the second choice.
  const { offer, lead, alternative } = useMemo(() => {
    const none = { offer: null, lead: null, alternative: null };
    if (!detail) return none;
    const find = (key: PlanTier | null) => (key ? plans.find((plan) => plan.key === key) ?? null : null);
    const wanted = upgradeTierFor(tier, detail.kind === "plan" ? detail.requiredPlan : null);
    const pick = leadTierFor(tier, wanted);
    const offered = find(wanted);
    if (!pick) return { ...none, offer: offered };
    const leadPlan = find(pick.lead) ?? offered;
    return { offer: offered, lead: leadPlan, alternative: leadPlan === offered ? null : find(pick.alternative) };
  }, [detail, plans, tier]);

  const value = useMemo(() => ({ tier, allows, openUpgrade }), [tier, allows, openUpgrade]);
  const close = () => setDetail(null);
  const isReserved = (plan: Plan) => !payments && subscription.pendingPlanKey === plan.key && subscription.status === "pending";
  const outOfCredits = detail?.kind === "credits";

  return (
    <PlanGateContext.Provider value={value}>
      {children}
      <DialogPrimitive.Root open={detail !== null} onOpenChange={(open) => !open && close()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 br-bold duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 flex-none place-content-center rounded-xl border-[1.5px] border-[#222325] bg-[#e1f073] text-[#222325]">
                  {outOfCredits ? <Coins className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </span>
                <div>
                  <DialogPrimitive.Title className="text-lg font-bold text-primary">
                    {outOfCredits ? "You're out of credits" : offer ? `Unlock this with ${alternative && lead ? `${alternative.name} or ${lead.name}` : offer.name}` : "Upgrade your plan"}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-1 text-sm text-black/55">
                    {outOfCredits
                      ? lead
                        ? `Move up to ${lead.name} for a bigger monthly allowance, or top up once.`
                        : "Top up with a pack. Packs never expire and are used after your monthly allowance."
                      : detail?.message}
                  </DialogPrimitive.Description>
                </div>
              </div>
              <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md bg-white text-[#222325] br-shadow-press">
                <X className="h-3.5 w-3.5" strokeWidth={3} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            {lead ? (
              <div className="mt-5">
                <PlanOffer
                  plan={lead}
                  reserved={isReserved(lead)}
                  busy={busy}
                  why={alternative ? leadReason(lead, alternative) : null}
                  onChoose={() => {
                    buyPlan(lead.key);
                    close();
                  }}
                />
                {alternative ? (
                  <button
                    type="button"
                    disabled={busy || isReserved(alternative)}
                    onClick={() => {
                      buyPlan(alternative.key);
                      close();
                    }}
                    className="mt-2 flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-xl border border-black/12 bg-white px-4 py-2.5 text-left transition-colors hover:border-[#222325] disabled:opacity-50">
                    <span className="text-sm font-semibold text-primary">
                      {isReserved(alternative) ? `${alternative.name} reserved` : `Or just ${alternative.name}`}
                    </span>
                    <span className="text-xs text-black/50 tabular-nums">
                      {money(alternative.priceCents, alternative.currency)}/{alternative.interval} · {alternative.monthlyCredits} credits
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {outOfCredits && creditPacks.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-black/40">{lead ? "Or top up" : "Top up"}</p>
                <div className="grid grid-cols-3 gap-2">
                  {creditPacks.map((pack) => (
                    <button
                      key={pack.key}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        buyCredits(pack.key);
                        close();
                      }}
                      className="flex cursor-pointer flex-col items-start rounded-xl border-[1.5px] border-black/15 bg-white px-3 py-2.5 text-left transition-colors hover:border-[#222325] disabled:opacity-50">
                      <span className="flex items-center gap-1 text-xs font-semibold text-black/60 tabular-nums">
                        <Plus className="h-3 w-3" />
                        {pack.credits}
                      </span>
                      <span className="mt-0.5 text-sm font-bold text-primary tabular-nums">{money(pack.priceCents)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="mt-5 text-xs text-black/45">
              {payments ? "Secure card payment through Stripe. Change or cancel any time." : "Card payments aren't connected yet. Choosing reserves it and we'll be in touch."}{" "}
              <Link href="/pricing" onClick={close} className="font-semibold text-primary underline underline-offset-2">
                Compare plans
              </Link>
            </p>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </PlanGateContext.Provider>
  );
};

/** A small lock chip naming the plan a control needs, for Free and lower tiers to see what's gated. */
export const PlanChip: FC<{ plan: PlanTier; className?: string }> = ({ plan, className }) => (
  <span
    className={
      "inline-flex items-center gap-1 rounded-full border border-[#222325]/20 bg-[#f4f7d4] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-[#222325] " +
      (className ?? "")
    }>
    <Lock className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
    {PLAN_TIER_NAMES[plan]}
  </span>
);
