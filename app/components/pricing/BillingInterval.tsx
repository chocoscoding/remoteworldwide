"use client";

import { createContext, useContext, useMemo, useState, type FC, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  YEARLY_DISCOUNT,
  money,
  perCredit,
  perMonthCents,
  yearlyCents,
  type BillingInterval,
  type PricingPlan,
} from "@/app/lib/pricing/catalogue";

// Monthly or yearly on /pricing. The page stays a static server page: only the
// switch and the few prices that follow it are client components, and they share
// the choice through this context rather than the URL.

const BillingContext = createContext<{ billing: BillingInterval; setBilling: (billing: BillingInterval) => void }>({
  billing: "month",
  setBilling: () => {},
});

export const BillingIntervalProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [billing, setBilling] = useState<BillingInterval>("month");
  const value = useMemo(() => ({ billing, setBilling }), [billing]);
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
};

export const useBillingInterval = () => useContext(BillingContext);

const OPTIONS: { value: BillingInterval; label: string }[] = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

/** The Monthly / Yearly pill on its own, for any screen that keeps the choice itself (the billing settings). */
export const BillingSwitch: FC<{ value: BillingInterval; onChange: (billing: BillingInterval) => void; size?: "md" | "sm"; className?: string }> = ({
  value,
  onChange,
  size = "md",
  className,
}) => (
  <div role="group" aria-label="Billing" className={cn("inline-flex items-center gap-1 rounded-full border border-primary/20 bg-white p-1", className)}>
    {OPTIONS.map((option) => {
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            size === "md" ? "h-9 px-4 text-sm" : "h-7 px-3 text-xs",
            active ? "bg-primary text-white" : "text-primary/60 hover:text-primary",
          )}>
          {option.label}
          {option.value === "year" ? (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary">
              Save {Math.round(YEARLY_DISCOUNT * 100)}%
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);

/** The switch on /pricing, wired to the page's shared choice. */
export const BillingToggle: FC<{ className?: string }> = ({ className }) => {
  const { billing, setBilling } = useBillingInterval();
  return <BillingSwitch value={billing} onChange={setBilling} className={className} />;
};

/** A plan card's big price, per month on either billing, and how it's billed underneath. */
export const PlanCardPrice: FC<{ plan: PricingPlan; featured: boolean }> = ({ plan, featured }) => {
  const { billing } = useBillingInterval();
  const muted = featured ? "text-white/60" : "text-primary/55";
  const paid = plan.priceCents > 0;
  return (
    <>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tight tabular-nums">{money(perMonthCents(plan, billing), plan.currency)}</span>
        <span className={cn("text-sm font-medium", muted)}>/{plan.interval}</span>
      </p>
      {/* Always one line tall, so the cards stay level whichever billing is picked. */}
      <p className={cn("mt-1 min-h-[1rem] text-xs font-medium tabular-nums", muted)}>
        {!paid ? null : billing === "year" ? `${money(yearlyCents(plan), plan.currency)} billed yearly` : "Billed monthly"}
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

/** "$29.99/month", or "$26.99/mo, yearly": the short price for the comparison table and the estimator. */
export const ShortPrice: FC<{ plan: PricingPlan }> = ({ plan }) => {
  const { billing } = useBillingInterval();
  if (plan.priceCents <= 0) return <>Free</>;
  const price = money(perMonthCents(plan, billing), plan.currency);
  return <>{billing === "year" ? `${price}/mo, yearly` : `${price}/${plan.interval}`}</>;
};
