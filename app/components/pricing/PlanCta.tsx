"use client";

import type { FC } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A plan card's button. Signed out, it joins the waitlist with the plan
 * preselected; signed in, it goes to Billing, where choosing a plan actually
 * happens. Renders the signed-out version until the session is known, so the
 * static page never flashes a button it has to take back.
 */
const PlanCta: FC<{ planKey: string; planName: string; featured?: boolean }> = ({ planKey, planName, featured }) => {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const href = signedIn ? "/dashboard/settings/billing" : `/waitlist?plan=${encodeURIComponent(planKey)}`;

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 px-5 text-sm font-bold transition-[transform,box-shadow] duration-100 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        featured
          ? "border-secondary bg-secondary text-primary shadow-[4px_4px_0_0_#ffffff] hover:shadow-[2px_2px_0_0_#ffffff]"
          : "border-primary bg-primary text-white shadow-[4px_4px_0_0_#e1f073] hover:shadow-[2px_2px_0_0_#e1f073]",
      )}>
      {signedIn ? `Choose ${planName}` : "Join the waitlist"}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
};

export default PlanCta;
