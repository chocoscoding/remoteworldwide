"use client";

import { FC } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Lock } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import type { EligibilityRequirement, RecommendationEligibility } from "@/app/lib/recommendations/types";

/** Where each requirement is fixed. The server owns the rule and the labels; this only knows the screens. */
const FIX_AT: Record<EligibilityRequirement, { href: string; place: string }> = {
  fullName: { href: "/dashboard/settings/profile", place: "Profile" },
  headline: { href: "/dashboard/settings/profile", place: "Profile" },
  summary: { href: "/dashboard/settings/profile", place: "Profile" },
  location: { href: "/dashboard/settings/profile", place: "Profile" },
  timezone: { href: "/dashboard/settings/profile", place: "Profile" },
  skills: { href: "/dashboard/settings/profile", place: "Profile" },
  targetRoles: { href: "/dashboard/settings/preferences", place: "Preferences" },
  masterResume: { href: "/dashboard/vault", place: "My documents" },
};

/** Where to send someone from a single "finish your profile" button: the first thing still open. */
export function firstFixHref(eligibility: RecommendationEligibility): string {
  const open = eligibility.requirements.find((r) => !r.done);
  return open ? FIX_AT[open.id].href : "/dashboard/settings/profile";
}

/**
 * Shown only while someone is not eligible: reviewers only pick from complete
 * profiles with a master resume, so this is the one thing on the screen they
 * can actually do something about. What's done reads first, then what's left —
 * the left ones are links straight to the screen that fixes them.
 */
const EligibilityCard: FC<{ eligibility: RecommendationEligibility }> = ({ eligibility }) => {
  const done = eligibility.requirements.filter((r) => r.done);
  const open = eligibility.requirements.filter((r) => !r.done);
  const total = eligibility.requirements.length;

  return (
    <DashCard className="mb-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#fdeae6]">
          <Lock className="h-4 w-4 text-[#b23c26]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-primary">Not in the running yet</p>
          <p className="mt-0.5 text-xs leading-relaxed text-black/55">
            Reviewers only pick from complete profiles with a master resume. {done.length} of {total} done.
          </p>
          <ProgressBar value={(done.length / Math.max(total, 1)) * 100} className="mt-3 max-w-md" />
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {done.map((r) => (
          <li key={r.id} className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 py-2">
            <span className="grid h-4 w-4 flex-none place-content-center rounded bg-[#e1f073]">
              <Check className="h-2.5 w-2.5 text-[#222325]" strokeWidth={3.5} />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-black/55">{r.label}</span>
          </li>
        ))}
        {open.map((r) => (
          <li key={r.id}>
            <Link
              href={FIX_AT[r.id].href}
              className="flex min-h-[40px] items-center gap-2.5 rounded-xl border border-black/12 bg-[#fbfbf7] px-3 py-2 transition-colors hover:border-[#222325]">
              <span className="h-4 w-4 flex-none rounded border border-dashed border-black/30" />
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-primary">{r.label}</span>
              <span className="flex-none text-[11px] text-black/50">{FIX_AT[r.id].place}</span>
              <ArrowUpRight className="h-3.5 w-3.5 flex-none text-black/45" />
            </Link>
          </li>
        ))}
      </ul>
    </DashCard>
  );
};

export default EligibilityCard;
