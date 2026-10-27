"use client";

import { createContext, useContext, useMemo, useState, type FC, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_BILLING,
  aboutMoney,
  money,
  perCredit,
  perMonthCents,
  periodCents,
  savingPercent,
  type BillingInterval,
  type PricingPlan,
} from "@/app/lib/pricing/catalogue";

// Monthly, quarterly or yearly on /pricing. The page stays a static server page: only the
// switch and the few prices that follow it are client components, and they share
// the choice through this context rather than the URL.

const BillingContext = createContext<{ billing: BillingInterval; setBilling: (billing: BillingInterval) => void }>({
  billing: DEFAULT_BILLING,
  setBilling: () => {},
});

/** Opens on Quarterly (owner, 2026-10-26) unless told otherwise. */
export const BillingIntervalProvider: FC<{ children: ReactNode; initial?: BillingInterval }> = ({ children, initial = DEFAULT_BILLING }) => {
  const [billing, setBilling] = useState<BillingInterval>(initial);
  const value = useMemo(() => ({ billing, setBilling }), [billing]);
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
};

export const useBillingInterval = () => useContext(BillingContext);

const OPTIONS: { value: BillingInterval; label: string }[] = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Yearly" },
];

/** "every 3 months", the way a card says how often it is charged. */
export const PERIOD_WORDS: Record<BillingInterval, string> = { month: "a month", quarter: "every 3 months", year: "a year" };

/** "/month", "/3 months", "/year": the short suffix after a price. */
export const PERIOD_SUFFIX: Record<BillingInterval, string> = { month: "/month", quarter: "/3 months", year: "/year" };

/** The shortest form, beside a plan card's big price, so it never wraps under it. */
const CARD_SUFFIX: Record<BillingInterval, string> = { month: "/mo", quarter: "/3 mo", year: "/yr" };

/**
 * The Monthly / Quarterly / Yearly pill on its own, for any screen that keeps the choice itself (the
 * billing settings). `savings` are the badges on Quarterly and Yearly, from `savingLabels` over the
 * live plans.
 */
export const BillingSwitch: FC<{
  value: BillingInterval;
  onChange: (billing: BillingInterval) => void;
  savings?: Partial<Record<BillingInterval, string | null>>;
  size?: "md" | "sm";
  className?: string;
}> = ({ value, onChange, savings, size = "md", className }) => {
  const index = Math.max(
    0,
    OPTIONS.findIndex((option) => option.value === value),
  );
  // The dashboard's sliding tab bar (components/dashboard/ui/SlidingTabs), owner 2026-10-27: a grey
  // track with the hard br-shadow and a dark block that slides to the chosen billing. Equal-width
  // cells keep the block's position pure arithmetic; each cell never shrinks below its own content.
  return (
    <div
      role="group"
      aria-label="Billing"
      className={cn("br-shadow relative grid w-fit max-w-full rounded-xl bg-[#f0f0ea] p-1", className)}
      style={{ gridTemplateColumns: `repeat(${OPTIONS.length}, minmax(max-content, 1fr))` }}>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-lg bg-[#222325] transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 0.5rem) / ${OPTIONS.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {OPTIONS.map((option) => {
        const active = value === option.value;
        const saving = savings?.[option.value];
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex cursor-pointer items-center justify-center whitespace-nowrap rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              // On a phone the saving sits under the label, so three cells fit side by side.
              size === "md" ? "min-h-11 flex-col gap-1 px-3 py-1.5 text-sm sm:flex-row sm:gap-2 sm:px-5" : "gap-1.5 px-3 py-1.5 text-xs",
              active ? "text-white" : "text-black/55 hover:text-[#222325]",
            )}>
            {option.label}
            {saving ? (
              <span className="whitespace-nowrap rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary">{saving}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

/** The switch on /pricing, wired to the page's shared choice. */
export const BillingToggle: FC<{ savings?: Partial<Record<BillingInterval, string | null>>; className?: string }> = ({ savings, className }) => {
  const { billing, setBilling } = useBillingInterval();
  return <BillingSwitch value={billing} onChange={setBilling} savings={savings} className={className} />;
};

/**
 * A plan card's big price and how it's billed underneath. The big number is always the real charge
 * (owner, 2026-10-26): "$80 every 3 months", with "about $27 a month" and the plan's own saving
 * under it. Both card styles carry ink text (the featured one is lime), so `featured` only nudges
 * the grey up a step to keep AA contrast on lime.
 */
export const PlanCardPrice: FC<{ plan: PricingPlan; featured: boolean }> = ({ plan, featured }) => {
  const { billing } = useBillingInterval();
  const muted = featured ? "text-primary/75" : "text-primary/65";
  const paid = plan.priceCents > 0;
  const shown = paid ? billing : "month";
  const saving = paid ? savingPercent(plan, billing) : 0;
  return (
    <>
      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="text-[2.25rem] font-bold leading-none tracking-tight tabular-nums xl:text-[2.75rem]">{money(periodCents(plan, shown), plan.currency)}</span>
        <span className={cn("whitespace-nowrap text-sm font-medium", muted)}>{CARD_SUFFIX[shown]}</span>
      </p>
      {/* One quiet line, always there, so the cards stay level whichever billing is picked. */}
      <p className={cn("mt-2 min-h-[1rem] text-xs font-medium tabular-nums", muted)}>
        {!paid ? "Free for as long as you like" : billing === "month" ? "Billed monthly" : `About ${aboutMoney(perMonthCents(plan, billing), plan.currency)} a month`}
        {saving > 0 ? <span className="font-bold text-primary"> · Save {saving}%</span> : null}
      </p>
    </>
  );
};

/** One credit's price on the chosen billing, or `free` for a plan that costs nothing. */
export const PerCredit: FC<{ plan: PricingPlan; free: ReactNode; suffix?: string }> = ({ plan, free, suffix = "" }) => {
  const { billing } = useBillingInterval();
  if (plan.priceCents <= 0) return <>{free}</>;
  return (
    <>
      {perCredit(perMonthCents(plan, billing), plan.monthlyCredits, plan.currency)}
      {suffix}
    </>
  );
};

/** "$31/month", "$80/3 months" or "$299/year": the short price for the comparison table and the estimator. */
export const ShortPrice: FC<{ plan: PricingPlan }> = ({ plan }) => {
  const { billing } = useBillingInterval();
  if (plan.priceCents <= 0) return <>Free</>;
  return (
    <>
      {money(periodCents(plan, billing), plan.currency)}
      {PERIOD_SUFFIX[billing]}
    </>
  );
};
