"use client";

import { FC } from "react";
import { Check, CreditCard, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { useBilling } from "../BillingProvider";
import { BUTTON_OUTLINE, BUTTON_SOLID, CARD, SettingsRow, SettingsSection } from "@/app/components/dashboard/settings/settings-ui";

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

const day = (date: Date | null) => (date ? date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : null);

const BillingClient: FC = () => {
  const { subscription, plan, plans, creditPacks, invoices, busy, buyPlan, buyCredits, cancelPlan } = useBilling();

  const { creditBalance, monthlyCredits, status, pendingPlanKey } = subscription;
  // Without a plan there is no allowance to measure against, so the meter reads
  // against whatever is in the wallet instead of a made-up number.
  const allowance = monthlyCredits || creditBalance;
  const usedPct = allowance > 0 ? Math.min(100, Math.round(((allowance - creditBalance) / allowance) * 100)) : 0;
  const renews = day(subscription.periodEnd);

  return (
    <>
      <SettingsSection
        title="Your plan"
        description={
          plan
            ? `${plan.name} — ${money(plan.priceCents, plan.currency)} a ${plan.interval}. Credits refill each period and don't roll over.`
            : "You're on the free plan. Pick a plan below to get a monthly credit allowance."
        }
        action={
          plan && !subscription.cancelAtPeriodEnd ? (
            <button type="button" className={BUTTON_OUTLINE} onClick={cancelPlan} disabled={busy}>
              Cancel plan
            </button>
          ) : undefined
        }>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-black/8 pb-4">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-black/40">Credits left</p>
            <p className="mt-1 text-3xl font-bold text-primary tabular-nums">{creditBalance}</p>
          </div>
          {renews && !subscription.cancelAtPeriodEnd ? (
            <p className="text-xs text-black/45">Renews {renews}</p>
          ) : renews ? (
            <p className="text-xs text-black/45">Ends {renews}</p>
          ) : null}
        </div>

        {allowance > 0 ? (
          <>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-black/60">This period</span>
              <span className="text-xs text-black/45 tabular-nums">
                {Math.max(0, allowance - creditBalance)} of {allowance} used
              </span>
            </div>
            <ProgressBar value={usedPct} fillColor={usedPct > 80 ? "#cddd54" : "#e1f073"} height="h-2" />
          </>
        ) : (
          <p className="py-1 text-sm text-black/50">No credits yet. Subscribe or buy a top-up pack to start using the AI tools.</p>
        )}

        {status === "pending" && pendingPlanKey ? (
          <div className={cn(CARD, "mt-4 bg-[#fbfbf7] px-4 py-3 text-xs leading-relaxed text-black/60")}>
            {plans.find((p) => p.key === pendingPlanKey)?.name ?? pendingPlanKey} is reserved for you. Card payments aren&apos;t connected yet — we&apos;ll be
            in touch to finish it, and your credits land the moment it clears.
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Plans" description="Every plan is monthly. Change or cancel whenever — nothing is locked in.">
        <div className="grid gap-3 py-1 sm:grid-cols-3">
          {plans.map((p) => {
            const current = p.key === subscription.planKey;
            const pending = p.key === pendingPlanKey && status === "pending";
            return (
              <div
                key={p.key}
                className={cn(CARD, "flex flex-col p-4", current && "border-[#cddd54] bg-[#fbfbf7]", p.prioritySupport && !current && "border-black/20")}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-primary">{p.name}</p>
                  {current ? <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/45">Current</span> : null}
                </div>
                <p className="mt-1.5 text-2xl font-bold text-primary tabular-nums">
                  {money(p.priceCents, p.currency)}
                  <span className="ml-1 text-xs font-semibold text-black/45">/{p.interval}</span>
                </p>
                <p className="mt-0.5 text-xs font-semibold text-black/55 tabular-nums">{p.monthlyCredits} credits a month</p>
                <ul className="mt-3 mb-4 flex flex-1 flex-col gap-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-black/70">
                      <span className="mt-0.5 grid h-3.5 w-3.5 flex-none place-content-center rounded-full bg-[#e1f073]">
                        <Check className="h-2 w-2 text-[#222325]" strokeWidth={4} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={current ? BUTTON_OUTLINE : BUTTON_SOLID}
                  onClick={() => buyPlan(p.key)}
                  disabled={busy || current || pending}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {current ? "Your plan" : pending ? "Reserved" : "Choose"}
                </button>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Buy more credits" description="Top-ups never expire. They are spent only after your monthly allowance runs out.">
        <div className="grid gap-3 py-1 sm:grid-cols-3">
          {creditPacks.map((pack) => (
            <div key={pack.key} className={cn(CARD, "flex flex-col p-4")}>
              <p className="text-sm font-bold text-primary tabular-nums">{pack.credits} credits</p>
              <p className="mt-1 mb-4 text-lg font-bold text-primary tabular-nums">{money(pack.priceCents, "USD")}</p>
              <button type="button" className={BUTTON_OUTLINE} onClick={() => buyCredits(pack.key)} disabled={busy}>
                <Zap className="h-3.5 w-3.5" />
                Buy
              </button>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Payment method" description="Card payments are not connected yet.">
        <SettingsRow label="Card on file" hint="Choosing a plan reserves it; we settle payment with you directly for now.">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/45">
            <CreditCard className="h-3.5 w-3.5" />
            None
          </span>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Invoices">
        {invoices.length === 0 ? (
          <p className="py-2 text-sm text-black/50">Nothing yet. Completed payments show up here.</p>
        ) : (
          invoices.map((inv) => (
            <SettingsRow
              key={inv.id}
              label={day(inv.completedAt) ?? day(inv.createdAt) ?? ""}
              hint={inv.kind === "subscription" ? `${inv.planKey} plan` : `${inv.credits} credits`}>
              <span className="text-sm font-semibold text-primary tabular-nums">{money(inv.amountCents, inv.currency)}</span>
            </SettingsRow>
          ))
        )}
      </SettingsSection>
    </>
  );
};

export default BillingClient;
