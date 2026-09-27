"use client";

import type { FC } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBillingInterval } from "@/app/components/pricing/BillingInterval";

/**
 * A plan card's button. Signed out, it joins the waitlist with the plan
 * preselected; signed in, it goes to Billing, where choosing a plan actually
 * happens. Either way it carries the page's Monthly / Yearly choice. Renders
 * the signed-out version until the session is known, so the static page never
 * flashes a button it has to take back.
 */
const PlanCta: FC<{ planKey: string; planName: string; featured?: boolean }> = ({ planKey, planName, featured }) => {
  const { status } = useSession();
  const { billing } = useBillingInterval();
  const signedIn = status === "authenticated";
  // Free is what every signed-in account already has, so it leads to the dashboard, not a checkout.
  const free = planKey === "free";
  const query = new URLSearchParams({ plan: planKey });
  if (!free && billing === "year") query.set("billing", "year");
  const href = !signedIn ? `/waitlist?${query}` : free ? "/dashboard" : `/dashboard/settings/billing?${query}`;
  const label = !signedIn ? "Join the waitlist" : free ? "Open dashboard" : `Choose ${planName}`;

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] px-5 text-sm font-bold transition-[transform,box-shadow] duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        featured
          ? "border-secondary bg-secondary text-primary shadow-[4px_4px_0_0_#ffffff] hover:shadow-[2px_2px_0_0_#ffffff]"
          : "border-primary bg-primary text-white shadow-[4px_4px_0_0_#e1f073] hover:shadow-[2px_2px_0_0_#e1f073]",
      )}>
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
};

export default PlanCta;
