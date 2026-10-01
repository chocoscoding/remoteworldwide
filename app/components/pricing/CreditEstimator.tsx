"use client";

import { useState, type FC } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTIMATOR_ITEMS, type PricingPlan } from "@/app/lib/pricing/catalogue";
import { ShortPrice } from "@/app/components/pricing/BillingInterval";

// Light brutalism: a flat card on a hairline, and one small offset shadow on
// the thumb. The owner found the heavier versions too dense (2026-09-26, and
// again 2026-10-01).
const RANGE =
  "h-2 w-full cursor-pointer appearance-none rounded-full border border-primary/30 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
  "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[1.5px] [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[1px_1px_0_0_#222325] " +
  "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[1.5px] [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-white";

/**
 * "How many credits would my month take?" — sliders over the priced actions
 * people use most, and the smallest plan that covers the total and includes
 * every tool in use (voice interviews only count plans that include them, and more than one cover
 * letter skips Free). Past the biggest plan
 * it says how much would come from top-ups rather than inventing a plan that
 * doesn't exist.
 */
const CreditEstimator: FC<{ plans: PricingPlan[] }> = ({ plans }) => {
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(ESTIMATOR_ITEMS.map((item) => [item.key, item.initial])));

  const total = ESTIMATOR_ITEMS.reduce((sum, item) => sum + counts[item.key] * item.credits, 0);
  const inUse = ESTIMATOR_ITEMS.filter((item) => counts[item.key] > 0);
  const eligible = (plan: PricingPlan) =>
    inUse.every((item) => (!item.plans || item.plans.includes(plan.key)) && counts[item.key] <= (item.limits?.[plan.key] ?? Infinity));
  const sorted = [...plans].filter(eligible).sort((a, b) => a.monthlyCredits - b.monthlyCredits);
  const fit = sorted.find((plan) => plan.monthlyCredits >= total) ?? null;
  const biggest = sorted[sorted.length - 1] ?? null;
  const plan = fit ?? biggest;
  const shortfall = fit || !biggest ? 0 : total - biggest.monthlyCredits;
  const usedPct = plan ? Math.min(100, Math.round((total / plan.monthlyCredits) * 100)) : 0;

  return (
    <div className="grid overflow-hidden rounded-[20px] border border-primary/10 bg-white lg:grid-cols-[1.25fr_1fr]">
      <div className="p-6 md:p-8">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/65">
          <Calculator className="h-4 w-4" aria-hidden />
          Credit estimator
        </p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-primary md:text-3xl">What would your month take?</h3>
        <p className="mt-1.5 text-sm text-primary/70">Drag to match how hard you&apos;re searching.</p>

        <div className="mt-7 flex flex-col gap-6">
          {ESTIMATOR_ITEMS.map((item) => {
            const value = counts[item.key];
            const pct = (value / item.max) * 100;
            const id = `estimate-${item.key}`;
            return (
              <div key={item.key}>
                <div className="mb-2.5 flex items-baseline justify-between gap-3">
                  <label htmlFor={id} className="text-sm font-semibold text-primary">
                    {item.label}
                  </label>
                  <span className="text-xs font-medium text-primary/65 tabular-nums">
                    <span className="mr-1 inline-block min-w-[2.25rem] rounded-md border border-primary/15 bg-primary2 px-1.5 py-0.5 text-center text-sm font-semibold text-primary">
                      {value}
                    </span>
                    × {item.credits} = {value * item.credits}
                  </span>
                </div>
                <input
                  id={id}
                  type="range"
                  min={0}
                  max={item.max}
                  value={value}
                  aria-valuetext={`${value} ${item.unit}${value === 1 ? "" : "s"} a month, ${value * item.credits} credits`}
                  onChange={(e) => setCounts((prev) => ({ ...prev, [item.key]: Number(e.target.value) }))}
                  className={RANGE}
                  style={{ background: `linear-gradient(to right, #e1f073 ${pct}%, #f1f0e8 ${pct}%)` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative flex flex-col justify-between gap-8 bg-primary p-6 text-white md:p-8" aria-live="polite">
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">You&apos;d use about</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-6xl font-bold tracking-tight text-secondary tabular-nums">{total}</span>
            <span className="text-base font-semibold text-white/70">credits a month</span>
          </p>
        </div>

        {plan && total > 0 ? (
          <div className="relative">
            <p className="text-sm text-white/70">
              {fit ? "Your best fit" : "Go all out with"}
            </p>
            <p className="mt-0.5 text-2xl font-bold">
              {plan.name}{" "}
              <span className="text-base font-medium text-white/65">
                <ShortPrice plan={plan} />
              </span>
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className={cn("h-full rounded-full transition-[width] duration-300", shortfall > 0 ? "bg-[#f0c86a]" : "bg-secondary")}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/65 tabular-nums">
              {shortfall > 0
                ? `${plan.monthlyCredits} included, plus about ${shortfall} from top-up packs.`
                : `${total} of ${plan.monthlyCredits} credits — ${plan.monthlyCredits - total} to spare.`}
            </p>
          </div>
        ) : (
          <p className="relative text-sm text-white/70">Move a slider to see which plan fits.</p>
        )}
      </div>
    </div>
  );
};

export default CreditEstimator;
