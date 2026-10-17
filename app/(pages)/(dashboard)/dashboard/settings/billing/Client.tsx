"use client";

import { FC, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { qk } from "@/app/lib/query/keys";
import { apiPost } from "@/app/lib/api/client";
import { Check, CreditCard, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { BillingSwitch } from "@/app/components/pricing/BillingInterval";
import { RECOMMENDED_PLAN, perCredit, yearlyCents, yearlySavingLabel } from "@/app/lib/pricing/catalogue";
import { boostEndsAt, proUntilLabel } from "@/app/lib/settings/boost";
import type { BillingInterval, Plan } from "@/app/lib/settings/types";
import { useBilling } from "../BillingProvider";
import { creditMeter } from "@/app/lib/settings/creditMeter";
import { BUTTON_OUTLINE, BUTTON_SOLID, CARD, SettingsRow, SettingsSection } from "@/app/components/dashboard/settings/settings-ui";

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

const day = (date: Date | null) => (date ? date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : null);

/** A plan feature that only restates its monthly credits ("200 AI credits a month"), shown once under the price instead. */
const CREDITS_FEATURE = /^\s*[\d,]+\s+(ai\s+)?credits\b/i;

/** What one period of a plan costs on the given billing. */
const periodPrice = (p: Plan, billing: BillingInterval) => (billing === "year" ? yearlyCents(p) : p.priceCents);

/** "Ultra", or "Ultra, billed yearly". */
const planLabel = (name: string, billing: BillingInterval | null) => (billing === "year" ? `${name}, billed yearly` : name);

/** If the confirm call is slow or the webhook is what lands, look again a few times. */
const RETURN_REFETCH_MS = [1500, 4000, 9000];

/**
 * @param initialBilling The billing picked on /pricing, when the visitor came from there (`?billing=year`).
 * @param returned Back from Stripe: Checkout paid ("success"), abandoned ("canceled"), or the portal ("portal").
 * @param sessionId The Checkout session Stripe sent back with "success", which the backend confirms.
 */
const BillingClient: FC<{ initialBilling?: BillingInterval; returned?: "success" | "canceled" | "portal"; sessionId?: string }> = ({
  initialBilling,
  returned,
  sessionId,
}) => {
  const { subscription, plan, plans, creditPacks, invoices, busy, buyPlan, buyCredits, cancelPlan, openPortal, payments = false, manageBilling = false } = useBilling();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Coming back from Stripe: ask the backend to check with Stripe (so it works without the webhook),
  // say what happened, refetch, and drop the query so a reload doesn't say it again.
  useEffect(() => {
    if (!returned) return;
    toast.dismiss();
    const refresh = () => void queryClient.invalidateQueries({ queryKey: qk.billing.all });
    if (returned === "success") {
      toast.success("Payment received", { description: "Your plan and credits will show here in a moment." });
      if (sessionId) void apiPost("/api/billing/checkout/confirm", { sessionId }).then(refresh, refresh);
    } else if (returned === "canceled") {
      toast("Checkout closed", { description: "Nothing was charged." });
    } else {
      void apiPost("/api/billing/sync").then(refresh, refresh);
    }
    const timers = RETURN_REFETCH_MS.map((ms) => setTimeout(refresh, ms));
    router.replace("/dashboard/settings/billing", { scroll: false });
    return () => timers.forEach(clearTimeout);
  }, [returned, sessionId, router, queryClient]);

  // A card subscriber opening this screen: re-read the subscription from Stripe once, so an upgrade
  // paid on Stripe's invoice page, a renewal or a cancellation shows without waiting on the webhook.
  useEffect(() => {
    if (!manageBilling || returned) return;
    void apiPost("/api/billing/sync").then(() => queryClient.invalidateQueries({ queryKey: qk.billing.all }), () => undefined);
    // Once per visit: the overview it refreshes must not trigger it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { creditBalance, monthlyCredits, pendingPlanKey } = subscription;
  // A streak gift's day of Pro raises `tier` while it runs, but not the plan paid for, which is
  // what this screen is about: a Free account on a day of Pro is still on Free here.
  // Read once per visit: render stays pure, and a day of Pro that ends mid-visit shows until the next one.
  const [now] = useState(() => Date.now());
  const boostEnds = boostEndsAt(subscription.boostUntil, now);
  const paidPlanless =
    subscription.status !== "active" ||
    !subscription.planKey ||
    subscription.planKey === "free" ||
    (subscription.provider === "waitlist" && subscription.periodEnd !== null && new Date(subscription.periodEnd).getTime() <= now);
  // Free is everyone without an active paid plan; its allowance comes from the Free plan row.
  const onFree = (subscription.tier ?? "free") === "free" || (boostEnds !== null && paidPlanless);
  const currentKey = onFree ? "free" : subscription.planKey;
  const interval: BillingInterval = subscription.interval ?? "month";
  const pendingInterval: BillingInterval = subscription.pendingInterval ?? "month";
  // Which prices the plan cards show: what they picked on /pricing, else how they pay now.
  const [billing, setBilling] = useState<BillingInterval>(initialBilling ?? (onFree ? "month" : interval));
  // Where the plan paid for sits in the catalogue; nothing below it is offered.
  const currentIndex = Math.max(0, plans.findIndex((p) => p.key === currentKey));
  const nextRefill = !onFree ? day(subscription.nextRefillAt) : null;
  // Used against everything held this period: the allowance plus bought and earned credits.
  const { total: heldThisPeriod, usedPct } = creditMeter(subscription);
  const renews = onFree ? null : day(subscription.periodEnd);
  // Packs cost several times a plan's credit: say so, with Pro's own number, while Pro is above them.
  const pro = plans.find((p) => p.key === RECOMMENDED_PLAN);
  const cheapestPlanLine =
    pro && pro.monthlyCredits > 0 && plans.findIndex((p) => p.key === RECOMMENDED_PLAN) > currentIndex
      ? `On ${pro.name} a credit works out at ${perCredit(pro.priceCents, pro.monthlyCredits, pro.currency)}.`
      : null;

  return (
    <>
      <SettingsSection
        title="Your plan"
        description={
          onFree
            ? `You're on Free: ${monthlyCredits || "a few"} credits a month, topped back up at the start of each month. Pick a plan below for more.`
            : plan
              ? `${plan.name}: ${money(periodPrice(plan, interval), plan.currency)} a ${interval === "year" ? "year" : plan.interval}. Credits refill every month and don't roll over.`
              : "Your plan is active."
        }
        action={
          manageBilling ? (
            <button type="button" className={BUTTON_OUTLINE} onClick={openPortal} disabled={busy}>
              <CreditCard className="h-3.5 w-3.5" />
              Manage billing
            </button>
          ) : !onFree && !subscription.cancelAtPeriodEnd ? (
            <button type="button" className={BUTTON_OUTLINE} onClick={cancelPlan} disabled={busy}>
              Cancel plan
            </button>
          ) : undefined
        }>
        {boostEnds ? (
          <div className={cn(CARD, "mb-4 flex items-center gap-2.5 border-[#cddd54] bg-[#f6faea] px-4 py-3")}>
            <Zap className="h-4 w-4 flex-none text-primary" aria-hidden />
            <p className="text-xs leading-relaxed text-black/65">
              {/* Local time: the server's render can't know the zone. */}
              <span className="font-bold text-primary" suppressHydrationWarning>
                Pro until {proUntilLabel(boostEnds)}
              </span>
              , from your streak gift. Interview prep, likely questions and every Pro feature are on till then.
            </p>
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-black/8 pb-4">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-black/40">Credits left</p>
            <p className="mt-1 text-3xl font-bold text-primary tabular-nums">{creditBalance}</p>
          </div>
          <div className="text-right text-xs text-black/45">
            {nextRefill ? (
              <p>
                Next {monthlyCredits} credits {nextRefill}
              </p>
            ) : null}
            {renews && !subscription.cancelAtPeriodEnd ? <p>Renews {renews}</p> : renews ? <p>Ends {renews}</p> : null}
          </div>
        </div>

        {heldThisPeriod > 0 ? (
          <>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-black/60">This period</span>
              <span className="text-xs text-black/45 tabular-nums">{usedPct}% used</span>
            </div>
            <ProgressBar value={usedPct} fillColor={usedPct > 80 ? "#cddd54" : "#e1f073"} height="h-2" />
          </>
        ) : (
          <p className="py-1 text-sm text-black/50">No credits yet. Subscribe or buy a top-up pack to start using the AI tools.</p>
        )}

        {pendingPlanKey && !payments ? (
          <div className={cn(CARD, "mt-4 bg-[#fbfbf7] px-4 py-3 text-xs leading-relaxed text-black/60")}>
            {planLabel(plans.find((p) => p.key === pendingPlanKey)?.name ?? pendingPlanKey, pendingInterval)} is reserved for you. Card payments aren&apos;t connected yet. We&apos;ll be
            in touch to finish it, and your credits land the moment it clears.
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        id="plans"
        title="Plans"
        description="Pay monthly, or yearly for less. Credits refill every month either way. Change or cancel whenever."
        action={<BillingSwitch value={billing} onChange={setBilling} saving={yearlySavingLabel(plans)} size="sm" />}>
        <div className="grid gap-3 py-1 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p, index) => {
            const samePlan = p.key === currentKey;
            // Free is current however it's shown; a paid plan only on the billing it's paid on.
            const current = samePlan && (onFree || billing === interval);
            // With card payments a pending row is only an open Checkout, which may have been closed.
            const pending = !payments && p.key === pendingPlanKey && pendingInterval === billing;
            const yearly = billing === "year" && p.priceCents > 0;
            // Plans only move up (the backend refuses the rest): a higher plan, or monthly to yearly.
            // Never a lower plan, never yearly back to monthly.
            const allowed = onFree || (interval === "year" && billing === "month" ? false : index > currentIndex || (samePlan && interval === "month" && billing === "year"));
            const action = current || !allowed || p.priceCents <= 0 ? null : samePlan ? "Switch to yearly" : onFree ? `Choose ${p.name}` : `Upgrade to ${p.name}`;
            // The credits line under the price says it once; the features don't repeat it.
            const features = p.features.filter((f) => !CREDITS_FEATURE.test(f));
            // Pro leads for anyone below it (owner, 2026-10-17), the way it does on /pricing.
            const recommended = p.key === RECOMMENDED_PLAN && index > currentIndex && !current;
            return (
              <div
                key={p.key}
                className={cn(
                  "flex flex-col rounded-2xl bg-white p-5",
                  current ? "br-shadow bg-[#fbfbf7]" : recommended ? "bg-[#e1f073] br-shadow" : "border border-black/10",
                )}>
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <p className="text-sm font-bold text-primary">{p.name}</p>
                  {current ? (
                    <span className="rounded-full bg-[#e1f073] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#222325]">Current</span>
                  ) : recommended ? (
                    <span className="rounded-full bg-[#222325] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#e1f073]">Recommended</span>
                  ) : null}
                </div>
                <p className="mt-3 text-3xl font-bold leading-none text-primary tabular-nums">
                  {money(yearly ? Math.round(yearlyCents(p) / 12) : p.priceCents, p.currency)}
                  <span className="ml-1 text-xs font-semibold text-black/45">/month</span>
                </p>
                <p className="mt-2 text-xs text-black/55 tabular-nums">
                  <span className="font-semibold text-primary">{p.monthlyCredits} credits</span> every month
                  {p.priceCents > 0 && p.monthlyCredits > 0 ? (
                    <span className="block text-black/45">{perCredit(periodPrice(p, billing) / (billing === "year" ? 12 : 1), p.monthlyCredits, p.currency)} per credit</span>
                  ) : null}
                  {yearly ? <span className="block text-black/45">{money(yearlyCents(p), p.currency)} billed yearly</span> : null}
                </p>
                <ul className="mt-4 flex flex-1 flex-col gap-2 border-t border-black/8 pt-4">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-black/70">
                      <span className="mt-0.5 grid h-3.5 w-3.5 flex-none place-content-center rounded-full border border-[#222325] bg-[#e1f073]">
                        <Check className="h-2 w-2 text-[#222325]" strokeWidth={4} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                {action ? (
                  <button type="button" className={cn(BUTTON_SOLID, "mt-5")} onClick={() => buyPlan(p.key, billing)} disabled={busy || pending}>
                    {pending ? "Reserved" : action}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        id="credits"
        title="Buy more credits"
        description={`Top-ups never expire. They are spent only after your monthly allowance runs out.${cheapestPlanLine ? ` ${cheapestPlanLine}` : ""}`}>
        <div className="grid gap-3 py-1 sm:grid-cols-3">
          {creditPacks.map((pack) => (
            <div key={pack.key} className={cn(CARD, "flex flex-col p-4")}>
              <p className="text-sm font-bold text-primary tabular-nums">{pack.credits} credits</p>
              <p className="mt-1 text-lg font-bold text-primary tabular-nums">{money(pack.priceCents, "USD")}</p>
              <p className="mb-4 text-xs text-black/45 tabular-nums">{perCredit(pack.priceCents, pack.credits)} per credit</p>
              <button type="button" className={BUTTON_OUTLINE} onClick={() => buyCredits(pack.key)} disabled={busy}>
                <Zap className="h-3.5 w-3.5" />
                Buy
              </button>
            </div>
          ))}
        </div>
      </SettingsSection>

      {payments ? (
        <SettingsSection title="Payment method" description="Cards are handled by Stripe. We never see or store your card number.">
          <SettingsRow
            label="Card, receipts and cancelling"
            hint={manageBilling ? "Update your card, download receipts, switch plan or cancel." : "You add a card when you choose a plan or buy credits."}>
            {manageBilling ? (
              <button type="button" className={BUTTON_OUTLINE} onClick={openPortal} disabled={busy}>
                <CreditCard className="h-3.5 w-3.5" />
                Manage billing
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/45">
                <CreditCard className="h-3.5 w-3.5" />
                None yet
              </span>
            )}
          </SettingsRow>
        </SettingsSection>
      ) : (
        <SettingsSection title="Payment method" description="Card payments are not connected yet.">
          <SettingsRow label="Card on file" hint="Choosing a plan reserves it; we settle payment with you directly for now.">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/45">
              <CreditCard className="h-3.5 w-3.5" />
              None
            </span>
          </SettingsRow>
        </SettingsSection>
      )}

      <SettingsSection title="Invoices">
        {invoices.length === 0 ? (
          <p className="py-2 text-sm text-black/50">Nothing yet. Completed payments show up here.</p>
        ) : (
          invoices.map((inv) => (
            <SettingsRow
              key={inv.id}
              label={day(inv.completedAt) ?? day(inv.createdAt) ?? ""}
              hint={
                inv.kind === "subscription"
                  ? `${plans.find((p) => p.key === inv.planKey)?.name ?? inv.planKey} plan${inv.interval === "year" ? ", yearly" : ""}`
                  : `${inv.credits} credits`
              }>
              <span className="text-sm font-semibold text-primary tabular-nums">{money(inv.amountCents, inv.currency)}</span>
            </SettingsRow>
          ))
        )}
      </SettingsSection>
    </>
  );
};

export default BillingClient;
