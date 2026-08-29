"use client";

import { FC, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";
import { computeFit, type FitPrefs, type FitProfile } from "@/app/lib/dashboard/fit";
import type { RecommendationTarget } from "@/app/lib/dashboard/types";

const TONE_VARIANT: Record<"positive" | "neutral" | "urgent", "positive" | "neutral" | "outline-dashed"> = {
  positive: "positive",
  neutral: "neutral",
  urgent: "outline-dashed",
};

export interface FitCardProps {
  target: RecommendationTarget;
  prefs: FitPrefs;
  profile: FitProfile;
}

/**
 * Informational by design. Our reviewers decide who gets put in front of a
 * company, so there is no "ask for an intro" button here — that would suggest
 * the choice is yours. The only action is the warm path, which is a referral
 * you can genuinely pursue yourself.
 */
const FitCard: FC<FitCardProps> = ({ target, prefs, profile }) => {
  const { contactAtCompany, pipeline } = useNetwork();
  const [open, setOpen] = useState(false);

  const fit = useMemo(() => computeFit(target, prefs, profile), [target, prefs, profile]);
  const contact = contactAtCompany(target.company);
  const inPipeline = pipeline.some((p) => p.targetId === target.id);

  return (
    <DashCard className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={target.company} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-primary">{target.company}</p>
            <p className="mt-0.5 truncate text-xs text-black/55">{target.role}</p>
          </div>
        </div>
        <ScoreRing value={fit.score} size={56} />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Pill variant={TONE_VARIANT[fit.tier.tone]}>{fit.tier.label}</Pill>
        {target.salaryText ? (
          <span className="text-xs text-black/55">{target.salaryText}</span>
        ) : (
          <span className="text-xs text-black/55">Band not published</span>
        )}
        {target.onHold && <Pill variant="neutral">On hold</Pill>}
        {inPipeline && <Pill variant="positive">Put forward</Pill>}
      </div>

      {target.note && <p className="mt-3 text-xs leading-relaxed text-black/60">{target.note}</p>}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-4 inline-flex cursor-pointer items-center gap-1 self-start text-xs font-semibold text-primary transition-colors hover:text-[#6c7a1e]">
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
                  <Minus className="h-2.5 w-2.5 text-black/45" strokeWidth={3.5} />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">{f.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-black/55">{f.detail}</p>
              </div>
            </div>
          ))}
          <p className="mt-1 text-xs text-black/55">
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

      <div className="mt-auto pt-4">
        {contact ? (
          <Link
            href={`/dashboard/referrals?contact=${contact.id}`}
            className="flex items-center gap-2.5 rounded-xl border border-black/10 bg-[#fbfbf7] px-3.5 py-2.5 transition-colors hover:border-[#222325]">
            <Avatar name={contact.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-primary">{contact.name} can warm this up</span>
              <span className="block truncate text-[11px] text-black/55">{contact.role}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 flex-none text-black/45" />
          </Link>
        ) : fit.score < 65 ? (
          <p className="text-xs leading-relaxed text-black/55">
            Weakest link is {fit.weakest.label.toLowerCase()}.{" "}
            <Link
              href="/dashboard/resume"
              className="font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
              Work on your resume
            </Link>{" "}
            to move it.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-black/55">No one in your network here yet — reviewers watch this one for you.</p>
        )}
      </div>
    </DashCard>
  );
};

export default FitCard;
