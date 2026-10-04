"use client";

import { FC, useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EligibilityItem, EligibilityRequirement, RecommendationEligibility } from "@/app/lib/recommendations/types";

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
  discoverable: { href: "/dashboard/settings/privacy", place: "Privacy" },
  plan: { href: "/dashboard/settings/billing", place: "Billing" },
};

/**
 * What's left, as a thing to do. The server's labels are nouns on purpose (the
 * admin's refusal reads them too), so the candidate's verbs live here; the
 * done list keeps the server's own words.
 */
const TO_DO: Record<EligibilityRequirement, (label: string) => string> = {
  fullName: () => "Add your full name",
  headline: () => "Write a headline",
  summary: () => "Add a summary",
  location: () => "Add your location",
  timezone: () => "Set your timezone",
  skills: (label) => `Add ${label}`,
  targetRoles: () => "Add a target role",
  masterResume: () => "Choose a master resume",
  discoverable: () => "Turn on “Let recruiters find me”",
  plan: () => "Upgrade to Basic",
};

/** Why it matters, in a few words, under the one to start with. */
const WHY: Record<EligibilityRequirement, string> = {
  fullName: "The name reviewers put forward",
  headline: "The line under your name",
  summary: "A few lines on what you do",
  location: "Where you work from",
  timezone: "So teams can see your hours",
  skills: "What reviewers match on",
  targetRoles: "What you want next",
  masterResume: "The one reviewers read",
  discoverable: "So reviewers can see you",
  plan: "Recommendations start on Basic",
};

/** The master resume first: it is what a reviewer actually reads. Then the server's order. */
const byPriority = (items: EligibilityItem[]) => [...items].sort((a, b) => Number(b.id === "masterResume") - Number(a.id === "masterResume"));

/**
 * Shown only while someone is not eligible: reviewers only pick from complete
 * profiles with a master resume, from people who left "Let recruiters find me"
 * on, on Basic or higher. It is step one on the screen, so it leads: how much
 * is left, then each open item as a link straight to the screen that fixes it.
 * What's done folds away behind "Show the N done".
 */
const EligibilityCard: FC<{ eligibility: RecommendationEligibility }> = ({ eligibility }) => {
  const [showDone, setShowDone] = useState(false);
  const doneId = useId();
  const done = eligibility.requirements.filter((r) => r.done);
  const open = byPriority(eligibility.requirements.filter((r) => !r.done));
  const total = eligibility.requirements.length;
  const left = open.length;

  return (
    <section aria-label="Get in the running" className="br-bold br-lime flex flex-wrap gap-6 rounded-2xl bg-white p-6">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#55564f]">Step one</span>
        <h2 className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] text-primary">
          {left} thing{left === 1 ? "" : "s"} left before reviewers can pick you
        </h2>
        <p className="text-sm text-[#55564f]">
          Reviewers only pick complete profiles with a master resume and recruiter visibility on, on Basic or higher.
        </p>
        <div className="mt-1 flex items-center gap-3">
          <div
            role="img"
            aria-label={`${done.length} of ${total} done`}
            className="grid flex-1 gap-1"
            style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {eligibility.requirements.map((r, i) => (
              <span key={r.id} className={cn("h-2 rounded-[2px]", i < done.length ? "bg-[#222325]" : "bg-[#e4e4dd]")} />
            ))}
          </div>
          <span className="flex-none text-[13px] font-extrabold text-primary">
            {done.length} of {total}
          </span>
        </div>
        {done.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              aria-controls={showDone ? doneId : undefined}
              className="flex h-8 cursor-pointer items-center gap-1 self-start text-xs font-bold text-[#55564f] transition-colors hover:text-primary">
              {showDone ? "Hide" : "Show"} the {done.length} done
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDone && "rotate-180")} />
            </button>
            {showDone && (
              <ul id={doneId} className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {done.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-xs font-semibold text-[#55564f]">
                    <span className="grid h-4 w-4 flex-none place-content-center rounded-full bg-[#222325]">
                      <Check className="h-2.5 w-2.5 text-[#e1f073]" strokeWidth={3.5} aria-hidden />
                    </span>
                    <span className="min-w-0 truncate">{r.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <ol className="flex min-w-0 flex-[1_1_380px] flex-col gap-2">
        {open.map((r, i) => {
          const fix = FIX_AT[r.id];
          return (
            <li key={r.id}>
              {i === 0 ? (
                <Link
                  href={fix.href}
                  className="br-shadow-press flex min-h-[52px] items-center gap-3 rounded-[10px] border-[1.5px] bg-[#e1f073] px-3.5 py-1.5 text-primary">
                  <span className="grid h-[22px] w-[22px] flex-none place-content-center rounded-full bg-[#222325] text-[11px] font-extrabold text-[#e1f073]">1</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-extrabold">{TO_DO[r.id](r.label)}</span>
                    <span className="text-xs text-[#3a3b36]">
                      {WHY[r.id]} · {fix.place}
                    </span>
                  </span>
                  <span className="flex-none text-[13px] font-extrabold max-sm:sr-only">Start here</span>
                  <ArrowRight className="h-[15px] w-[15px] flex-none" strokeWidth={2.2} aria-hidden />
                </Link>
              ) : (
                <Link
                  href={fix.href}
                  className="br-plain-press flex min-h-12 items-center gap-3 rounded-[10px] border-black/30 bg-white px-3.5 py-1.5 text-primary hover:border-[#222325]">
                  <span className="grid h-[22px] w-[22px] flex-none place-content-center rounded-full border-[1.5px] border-[#222325] text-[11px] font-extrabold">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-bold">{TO_DO[r.id](r.label)}</span>
                  <span className="flex-none text-xs text-[#5f6062]">{fix.place}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 flex-none text-[#5f6062]" aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default EligibilityCard;
