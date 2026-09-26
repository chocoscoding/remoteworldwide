"use client";

// The profile's seven items, live: the server's `onboarding.items` (the
// EligibilityCard pattern — the server owns the rule and the labels, this only
// knows where on the page each one is fixed: `#onb-<id>`, the same field
// `/onboarding#<id>` opens at). Guidance, not a gate: the extension works
// without them, and names the missing ones with a link back here. An item the
// form already satisfies but that is not saved yet says so, so "why is this
// still open?" has its answer on screen.

import type { FC } from "react";
import { ArrowRight, Check, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnboardingItem, OnboardingItemId } from "@/app/lib/settings/types";

export interface OnboardingChecklistProps {
  items: OnboardingItem[];
  /** Filled in on the form, not saved yet. */
  pending: ReadonlySet<OnboardingItemId>;
  /** Scrolls to where an open item is fixed. */
  onJump: (id: OnboardingItemId) => void;
  className?: string;
}

const OnboardingChecklist: FC<OnboardingChecklistProps> = ({ items, pending, onJump, className }) => {
  const done = items.filter((item) => item.done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <section
      aria-labelledby="onb-checklist-title"
      className={cn("relative overflow-hidden rounded-[20px] border-[1.5px] border-primary bg-primary p-5 text-white md:p-6", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(225,240,115,0.07)_1px,transparent_1px)] bg-[length:24px_24px]" aria-hidden />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Your profile</p>
        <h2 id="onb-checklist-title" className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight text-secondary tabular-nums">
            {done}/{total}
          </span>
          <span className="text-sm font-medium text-white/70">done</span>
        </h2>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full border border-white/35 bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="Setup progress">
          <div className="h-full rounded-full bg-secondary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>

        {/* Two columns on a phone, where this sits above the steps and has to stay short; one at the side on a wide screen. */}
        <ul className="mt-4 grid grid-cols-2 gap-1.5 lg:grid-cols-1" aria-live="polite">
          {items.map((item) =>
            item.done ? (
              <li key={item.id} className="flex min-h-9 items-center gap-2.5 rounded-lg px-2 py-1.5">
                <span className="grid h-4 w-4 flex-none place-content-center rounded bg-secondary">
                  <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3.5} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/60">
                  {item.label}
                  <span className="sr-only"> — done</span>
                </span>
              </li>
            ) : (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onJump(item.id)}
                  className="group flex min-h-9 w-full items-center gap-2.5 rounded-lg border border-white/15 px-2 py-1.5 text-left transition-colors hover:border-secondary cursor-pointer">
                  <CircleDashed className={cn("h-4 w-4 flex-none", pending.has(item.id) ? "text-secondary" : "text-white/40")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-white">{item.label}</span>
                    {pending.has(item.id) && <span className="block truncate text-[11px] text-secondary/90">Filled in, not saved</span>}
                  </span>
                  <ArrowRight className="hidden h-3.5 w-3.5 flex-none text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-secondary sm:block" aria-hidden />
                </button>
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
};

export default OnboardingChecklist;
