import type { ReactNode } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { FALLBACK_CATALOGUE, RECOMMENDED_PLAN, money } from "@/app/lib/pricing/catalogue";
import CheckChip from "@/app/components/marketing/CheckChip";

// The pictures over the three "How early access works" steps on /waitlist, after the image cards
// on the landing the owner pointed at (2026-10-01). Decorative (aria-hidden) markup like the hero
// collage: flat canvases, with an ink outline and hard shadow on one small piece each.

function JoinVisual() {
  return (
    <div className="w-full max-w-[260px]">
      <div className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-white p-1.5">
        <span className="min-w-0 flex-1 truncate px-2 text-xs text-primary/45">you@email.com</span>
        <span className="rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-white">Join</span>
      </div>
      <div className="ml-auto mt-4 flex w-fit -rotate-2 items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 text-[11px] font-bold text-primary br-shadow">
        <CheckChip size="sm" />
        You&apos;re on the list!
      </div>
    </div>
  );
}

function InviteVisual() {
  return (
    <div className="w-full max-w-[260px] rotate-1 rounded-2xl bg-white p-4 br-bold">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 flex-none place-content-center rounded-full bg-primary text-secondary">
          <Mail className="h-4 w-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[11px] font-extrabold text-primary">Remote Worldwide</p>
          <p className="text-[10px] text-primary/55">to you · just now</p>
        </div>
      </div>
      <p className="mt-3 text-sm font-extrabold leading-snug text-primary">Your spot is open</p>
      <p className="mt-0.5 text-[11px] leading-snug text-primary/65">Start on Free, or pick a plan.</p>
      <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-bold text-primary">
        Claim your spot
        <ArrowRight className="h-3 w-3" />
      </span>
    </div>
  );
}

function PlansVisual() {
  // From the seeded plans, so the picture can't quote a price the pricing page doesn't.
  return (
    <ul className="flex w-full max-w-[250px] flex-col gap-1.5">
      {FALLBACK_CATALOGUE.plans.map((plan) => {
        const featured = plan.key === RECOMMENDED_PLAN;
        return (
          <li
            key={plan.key}
            className={cn(
              "flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-bold text-primary",
              featured ? "-rotate-1 bg-secondary br-shadow" : "border border-primary/10 bg-white",
            )}>
            <span className="flex items-center gap-2">
              {plan.name}
              {/* Too tight in the tablet's three narrow columns; the lime row says it there. */}
              {featured ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] text-secondary md:max-lg:hidden">Recommended</span> : null}
            </span>
            <span className="tabular-nums">
              {money(plan.priceCents, plan.currency)}
              <span className="font-semibold text-primary/50">/mo</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const VISUALS: { canvas: string; picture: ReactNode }[] = [
  { canvas: "bg-secondary/40", picture: <JoinVisual /> },
  { canvas: "border border-primary/10 bg-white", picture: <InviteVisual /> },
  { canvas: "bg-secondary/40", picture: <PlansVisual /> },
];

/** Step `index`'s picture on its canvas, with the step number in the corner. */
export default function StepVisual({ index }: { index: number }) {
  const { canvas, picture } = VISUALS[index];
  return (
    // The picture starts under the number badge (top 16px + 32px), so the two never overlap.
    <div aria-hidden className={cn("relative flex h-[220px] select-none items-center justify-center overflow-hidden rounded-[22px] px-6 pb-3 pt-12", canvas)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(34,35,37,0.1)_1px,transparent_1px)] bg-[length:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      <span className="absolute left-4 top-4 z-10 grid h-8 w-8 place-content-center rounded-[9px] bg-white text-xs font-extrabold tabular-nums text-primary br-shadow">
        0{index + 1}
      </span>
      <div className="relative flex w-full justify-center">{picture}</div>
    </div>
  );
}
