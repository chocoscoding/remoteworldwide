"use client";

import { FC } from "react";
import { Check, CreditCard, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { BUTTON_OUTLINE, BUTTON_SOLID, CARD, SettingsRow, SettingsSection } from "@/app/components/dashboard/settings/settings-ui";

const PRO_PERKS = [
  "Unlimited resume tailoring",
  "Unlimited ATS scoring against real postings",
  "Priority referral introductions",
  "Full interview-prep session history",
];

/** Mock invoices — a free plan has none, so these are what Pro would look like. */
const INVOICES: { id: string; date: string; amount: string; status: "paid" | "refunded" }[] = [];

const BillingClient: FC = () => {
  // The single source of truth for credits — the sidebar and streak panel read
  // the same derived balance, so this screen can't drift from them.
  const { credits, openGifts } = useActivity();

  // Free plan allowance, purely so the meter has something to read against.
  const monthlyAllowance = 50;
  const usedPct = Math.min(100, Math.round(((monthlyAllowance - credits) / monthlyAllowance) * 100));

  return (
    <>
      <SettingsSection
        title="Your plan"
        description="You're on the free plan. Credits refill monthly; unused ones don't roll over."
        action={
          <button type="button" className={BUTTON_SOLID} onClick={() => toast("Checkout isn't wired up in this build.")}>
            <Sparkles className="h-3.5 w-3.5" />
            Upgrade to Pro
          </button>
        }>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-black/8 pb-4">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-black/40">Credits left</p>
            <p className="mt-1 text-3xl font-bold text-primary tabular-nums">{credits}</p>
          </div>
          <button type="button" className={BUTTON_OUTLINE} onClick={openGifts}>
            Your gifts
          </button>
        </div>

        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-semibold text-black/60">This month</span>
          <span className="text-xs text-black/45 tabular-nums">
            {Math.max(0, monthlyAllowance - credits)} of {monthlyAllowance} used
          </span>
        </div>
        <ProgressBar value={usedPct} fillColor={usedPct > 80 ? "#cddd54" : "#e1f073"} height="h-2" />
      </SettingsSection>

      <SettingsSection title="Pro" description="$12 a month, cancel whenever. Everything on free stays free.">
        <ul className="mb-4 flex flex-col gap-2">
          {PRO_PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-black/75">
              <span className="mt-0.5 grid h-4 w-4 flex-none place-content-center rounded-full bg-[#e1f073]">
                <Check className="h-2.5 w-2.5 text-[#222325]" strokeWidth={3.5} />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <div className={cn(CARD, "flex flex-wrap items-center justify-between gap-3 bg-[#fbfbf7] px-4 py-3")}>
          <p className="text-xs leading-relaxed text-black/60">
            Earn credits by inviting friends — the streak pays in gifts instead.
          </p>
          <button type="button" className={BUTTON_OUTLINE} onClick={openGifts}>
            See how
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Payment method" description="Only needed once you upgrade.">
        <SettingsRow label="Card on file" hint="No card yet — you're on the free plan.">
          <button type="button" className={BUTTON_OUTLINE} onClick={() => toast("Adding a card isn't wired up in this build.")}>
            <CreditCard className="h-3.5 w-3.5" />
            Add a card
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Invoices">
        {INVOICES.length === 0 ? (
          <p className="py-2 text-sm text-black/50">
            Nothing to show — the free plan doesn&apos;t generate invoices. They&apos;ll appear here after your first Pro payment.
          </p>
        ) : (
          INVOICES.map((inv) => (
            <SettingsRow key={inv.id} label={inv.date} hint={inv.status === "refunded" ? "Refunded" : undefined}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-primary tabular-nums">{inv.amount}</span>
                <button type="button" className={BUTTON_OUTLINE} aria-label={`Download invoice for ${inv.date}`}>
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </SettingsRow>
          ))
        )}
      </SettingsSection>
    </>
  );
};

export default BillingClient;
