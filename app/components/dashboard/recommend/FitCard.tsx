"use client";

import { FC, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar, { initialsOf } from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import type { FitFactorId, FitResult } from "@/app/lib/dashboard/fit";
import type { RecommendationTarget, ReferralContact } from "@/app/lib/dashboard/types";

/**
 * Every tier gets the SAME pill shape and weight, differing only in fill and
 * rule, so the one card that needs attention is never the faintest thing in
 * its row.
 */
const TIER_PILL: Record<"positive" | "neutral" | "urgent", string> = {
  positive: "border-[#222325] bg-[#e1f073] text-[#222325]",
  neutral: "border-black/30 bg-[#f0f0ea] text-[#222325]",
  urgent: "border-[#b23c26] bg-[#fdeae6] text-[#8a2a17]",
};

/** The tier as the compact card's pill says it: short enough to sit beside the company's name. */
export const FIT_TIER_SHORT: Record<"positive" | "neutral" | "urgent", string> = { positive: "Strong fit", neutral: "Good fit", urgent: "Needs work" };

/** The factors as the chips and the reasons name them. */
const SHORT: Record<FitFactorId, string> = { role: "Target role", trend: "Applied to", seniority: "Seniority", timezone: "Location" };

/** One letter reads larger than two in the same circle. */
export const companyAvatarClass = (name: string) => cn("h-10 w-10 font-extrabold", initialsOf(name).length > 1 ? "text-[13px]" : "text-[15px]");

const postedLabel = (days: number) => (days === 0 ? "posted today" : days === 1 ? "posted yesterday" : `posted ${days}d ago`);

export interface FitCardProps {
  target: RecommendationTarget;
  /** Scored by the screen, which also used it to pick and rank this card. */
  fit: FitResult;
  /** Your best warm path at the company, from your own contacts (useWarmPaths). */
  contact?: ReferralContact;
  /**
   * `compact` beside the companies you're in front of: the tier and your warm
   * path lead. `detailed` while you're not in the running yet: which of the
   * four signals matched, so the card says what to fill in.
   */
  variant?: "compact" | "detailed";
}

/** Seniority · regions · how fresh. Listings here are at most three weeks old (WATCH_MAX_AGE_DAYS), so none is flagged as stale. */
const MetaLine: FC<{ target: RecommendationTarget; className?: string }> = ({ target, className }) => {
  const days = target.postedDaysAgo;
  if (!target.note && days === undefined) return null;
  return (
    <span className={className}>
      {target.note}
      {target.note && days !== undefined && " · "}
      {days !== undefined && postedLabel(days)}
    </span>
  );
};

/** The engine's own reason for each factor, what already fits first. */
const Reasons: FC<{ id: string; factors: FitResult["factors"] }> = ({ id, factors }) => (
  <div id={id} className="flex flex-col gap-2.5 rounded-[10px] bg-[#f6f6f6] p-3 text-xs leading-relaxed">
    {factors.map((f) => (
      <p key={f.id} className={f.met ? "text-primary" : "text-[#5f6062]"}>
        <strong className={cn("font-bold", !f.met && "text-[#44453f]")}>{SHORT[f.id]}.</strong> {f.detail}
      </p>
    ))}
  </div>
);

const WarmPath: FC<{ contact: ReferralContact }> = ({ contact }) => (
  <Link
    href={`/dashboard/referrals?contact=${contact.id}`}
    className="br-plain-press flex min-h-[52px] items-center gap-2.5 rounded-xl border-[#222325] bg-[#fbfbf7] px-3 py-2">
    <Avatar name={contact.name} size="sm" tone="dark" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-extrabold text-primary">{contact.name} can warm this up</span>
      <span className="block truncate text-[11px] text-[#5f6062]">{contact.role}</span>
    </span>
    <ArrowUpRight className="h-3.5 w-3.5 flex-none text-primary" />
  </Link>
);

/**
 * Informational by design. Our reviewers decide who gets put in front of a
 * company, so there is no "ask for an intro" button here — that would suggest
 * the choice is yours. The only actions are the listing itself (it is a live
 * Remote Worldwide job — apply to it like any other) and the warm path, a
 * referral you can genuinely pursue yourself.
 *
 * No numeric score on the talent side: the tier and the matched signals are
 * the whole verdict. The number still exists internally (it ranks the cards);
 * rendering it invites people to chase a 97 instead of reading why they fit.
 */
const FitCard: FC<FitCardProps> = ({ target, fit, contact, variant = "compact" }) => {
  const [open, setOpen] = useState(false);
  const reasonsId = useId();

  // What already fits reads first, then what doesn't yet. The sort is stable,
  // so each group keeps computeFit's own order.
  const factors = useMemo(() => [...fit.factors].sort((a, b) => Number(b.met) - Number(a.met)), [fit.factors]);

  if (variant === "detailed") {
    return (
      <DashCard className="flex flex-col gap-3.5 border-black/[0.14] p-[18px]">
        <div className="flex items-start gap-3">
          <Avatar name={target.company} className={companyAvatarClass(target.company)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-[15px] font-extrabold text-primary">{target.company}</p>
            <p className="truncate text-[13px] text-[#44453f]">{target.role}</p>
            <MetaLine target={target} className="mt-0.5 text-xs text-[#5f6062]" />
          </div>
        </div>

        <ul className="flex flex-wrap gap-1.5 text-xs font-bold" aria-label="What matched">
          {factors.map((f) =>
            f.met ? (
              <li key={f.id} className="flex items-center gap-[5px] rounded-full bg-[#e1f073] px-[9px] py-[3px] text-primary">
                <Check className="h-[11px] w-[11px]" strokeWidth={3.5} aria-hidden />
                {SHORT[f.id]}
              </li>
            ) : (
              <li key={f.id} className="rounded-full border border-dashed border-black/40 px-[9px] py-[3px] text-[#5f6062]">
                <span className="sr-only">Not matched: </span>
                {SHORT[f.id]}
              </li>
            ),
          )}
        </ul>

        {open && <Reasons id={reasonsId} factors={factors} />}
        {contact && <WarmPath contact={contact} />}

        <div className="mt-auto flex items-center gap-2.5 border-t border-black/[0.12] pt-3.5">
          {target.href && (
            <Link
              href={target.href}
              className="br-plain-press flex h-9 items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-white px-3.5 text-[13px] font-extrabold text-primary">
              View job
              <ArrowUpRight className="h-[13px] w-[13px]" strokeWidth={2.2} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={open ? reasonsId : undefined}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-1 px-1 text-xs transition-colors hover:text-primary",
              open ? "font-extrabold text-primary" : "font-bold text-[#44453f]",
            )}>
            Why this fit
            <ChevronDown className={cn("h-[13px] w-[13px] transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </DashCard>
    );
  }

  return (
    <DashCard className="flex flex-col gap-3 border-black/[0.14] p-[18px]">
      <div className="flex items-start gap-3">
        <Avatar name={target.company} className={companyAvatarClass(target.company)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-[15px] font-extrabold text-primary">{target.company}</p>
          {target.href ? (
            <Link
              href={target.href}
              className="truncate text-xs text-[#55564f] underline decoration-dotted underline-offset-2 hover:text-primary hover:decoration-solid">
              {target.role}
            </Link>
          ) : (
            <p className="truncate text-xs text-[#55564f]">{target.role}</p>
          )}
        </div>
        <span className={cn("flex-none rounded-full border px-2.5 py-1 text-[11px] font-extrabold", TIER_PILL[fit.tier.tone])} title={fit.tier.label}>
          {FIT_TIER_SHORT[fit.tier.tone]}
        </span>
      </div>

      <MetaLine target={target} className="text-[13px] leading-normal text-[#55564f]" />

      {contact ? (
        <WarmPath contact={contact} />
      ) : (
        <div className="flex min-h-[52px] items-center rounded-xl border border-dashed border-black/25 px-3 py-2 text-xs font-semibold text-[#5f6062]">
          No one in your network here
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? reasonsId : undefined}
        className="cursor-pointer self-start text-xs font-bold text-primary underline decoration-2 underline-offset-[3px] hover:text-[#6c7a1e]">
        Why this fit
      </button>
      {open && <Reasons id={reasonsId} factors={factors} />}
    </DashCard>
  );
};

export default FitCard;
