"use client";

import { FC, ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, Minus, PenLine, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";
import { computeFit, type FitPrefs, type FitProfile } from "@/app/lib/dashboard/fit";
import type { RecommendationTarget } from "@/app/lib/dashboard/types";

/**
 * Every tier gets the SAME pill shape and weight, differing only in fill.
 * The old mapping sent "Needs work" to `outline-dashed`, which made the one
 * card that needed attention the faintest thing on the screen — and put three
 * different chip weights in a single row of cards.
 */
const TIER_FILL: Record<"positive" | "neutral" | "urgent", string> = {
  positive: "bg-[#e1f073] text-[#222325]",
  neutral: "bg-[#f0f0ea] text-[#222325]",
  urgent: "bg-[#fdeae6] text-[#b23c26]",
};

/**
 * One footer shell, three states. Previously each state rendered its own
 * shape — a bordered box, or bare text, or nothing — so no two cards in a row
 * ended at the same place. Interactive states are solid and hoverable;
 * the informational state is dashed and inert, which is the only difference
 * worth seeing at a glance.
 */
const FOOTER_SHELL = "flex min-h-[52px] items-center gap-2.5 rounded-xl border px-3 py-2.5";
const FOOTER_ACTION = "border-black/12 bg-[#fbfbf7] transition-colors hover:border-[#222325]";
const FOOTER_INERT = "border-dashed border-black/15 bg-transparent";

export interface FitCardProps {
  target: RecommendationTarget;
  prefs: FitPrefs;
  profile: FitProfile;
}

/** Keeps the icon column the same width as the contact avatar so all three footers align. */
const FooterIcon: FC<{ children: ReactNode; muted?: boolean }> = ({ children, muted }) => (
  <span
    className={cn(
      "grid h-8 w-8 flex-none place-content-center rounded-full",
      muted ? "bg-[#f0f0ea] text-black/45" : "bg-[#222325] text-[#e1f073]"
    )}>
    {children}
  </span>
);

/**
 * Informational by design. Our reviewers decide who gets put in front of a
 * company, so there is no "ask for an intro" button here — that would suggest
 * the choice is yours. The only action is the warm path, which is a referral
 * you can genuinely pursue yourself.
 *
 * Laid out as fixed slots — identity, status, note, disclosure, footer — so
 * that every collapsed card in a row is exactly the same height. The note is
 * clamped to two lines for the same reason; the full text stays in `title`.
 */
const FitCard: FC<FitCardProps> = ({ target, prefs, profile }) => {
  const { contactAtCompany } = useNetwork();
  const [open, setOpen] = useState(false);

  const fit = useMemo(() => computeFit(target, prefs, profile), [target, prefs, profile]);
  const contact = contactAtCompany(target.company);

  return (
    <DashCard className="flex flex-col p-5">
      {/* Identity — company, role and band read as one block, so the score
          ring is the only thing competing with the name. */}
      <div className="flex items-start gap-3">
        <Avatar name={target.company} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight text-primary">{target.company}</p>
          <p className="mt-1 truncate text-xs text-black/60">{target.role}</p>
          <p className="mt-1 truncate text-[11px] font-semibold tabular-nums text-black/60">
            {target.salaryText ?? "Band not published"}
          </p>
        </div>
        <ScoreRing value={fit.score} size={52} trackColor="#e6e5dd" />
      </div>

      {/* Status — always exactly one row, so nothing below it can shift. */}
      <div className="mt-4 flex h-7 items-center gap-2">
        <Pill className={cn("flex-none", TIER_FILL[fit.tier.tone])}>{fit.tier.label}</Pill>
        {target.onHold && <Pill variant="neutral" className="flex-none">On hold</Pill>}
      </div>

      <p className="mt-3 line-clamp-2 min-h-[39px] text-xs leading-relaxed text-black/65" title={target.note ?? undefined}>
        {target.note}
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 inline-flex cursor-pointer items-center gap-1 self-start text-xs font-semibold text-primary transition-colors hover:text-[#6c7a1e]">
        Why this fit
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-black/8 pt-3.5">
          {fit.factors.map((f) => (
            <div key={f.id} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 grid h-4 w-4 flex-none place-content-center rounded",
                  f.met ? "bg-[#e1f073]" : "bg-[#f0f0ea]"
                )}>
                {f.met ? (
                  <Check className="h-2.5 w-2.5 text-[#222325]" strokeWidth={3.5} />
                ) : (
                  <Minus className="h-2.5 w-2.5 text-black/55" strokeWidth={3.5} />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">{f.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-black/65">{f.detail}</p>
              </div>
            </div>
          ))}
          <p className="mt-1 text-xs text-black/65">
            Scored against{" "}
            <Link
              href="/dashboard/settings/preferences"
              className="font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
              your preferences
            </Link>
            .
          </p>
        </div>
      )}

      <div className="mt-4">
        {contact ? (
          <Link href={`/dashboard/referrals?contact=${contact.id}`} className={cn(FOOTER_SHELL, FOOTER_ACTION)}>
            <Avatar name={contact.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-primary">{contact.name} can warm this up</span>
              <span className="block truncate text-[11px] text-black/60">{contact.role}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 flex-none text-black/45" />
          </Link>
        ) : fit.score < 65 ? (
          <Link href="/dashboard/resume" className={cn(FOOTER_SHELL, FOOTER_ACTION)}>
            <FooterIcon>
              <PenLine className="h-3.5 w-3.5" />
            </FooterIcon>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-primary">Work on your resume</span>
              <span className="block truncate text-[11px] text-black/60">
                {fit.weakest.label} is the weakest link
              </span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 flex-none text-black/45" />
          </Link>
        ) : (
          <div className={cn(FOOTER_SHELL, FOOTER_INERT)}>
            <FooterIcon muted>
              <Radar className="h-3.5 w-3.5" />
            </FooterIcon>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-black/70">No one in your network here</span>
              <span className="block truncate text-[11px] text-black/60">Reviewers watch this one for you</span>
            </span>
          </div>
        )}
      </div>
    </DashCard>
  );
};

export default FitCard;
