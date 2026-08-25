"use client";

import { FC, Fragment, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Info, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";
import { RECOMMENDATION_CARDS } from "@/app/lib/dashboard/mock-data";

// ---------------------------------------------------------------------------
// Local content — this screen's mock data isn't shared with any other
// screen, so it's kept here rather than in mock-data.ts.
// ---------------------------------------------------------------------------

const INTRO_STAGES = ["We reviewed you", "Intro sent", "They replied", "Conversation", "Offer"];

const WHAT_WE_LOOK_FOR = [
  "Role scope match — your last two or three roles line up with what they're actually hiring for.",
  "Above the quality bar — your resume and portfolio would pass their first screen today, not \"after some more work.\"",
  "Real timezone overlap — enough working-hours overlap for a live conversation to actually happen.",
  "A warm path exists — someone in the Remote Worldwide network can make a real introduction, not a cold application.",
  "You're currently open — your availability toggle below is switched on.",
];

/** Horizontal 5-stage tracker used by the highlighted Linear intro card. */
const IntroStageTracker: FC<{ currentIndex: number }> = ({ currentIndex }) => {
  return (
    <div className="flex items-start">
      {INTRO_STAGES.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && (
            <div className={cn("h-[2px] flex-1 mt-[13px] rounded-full", i <= currentIndex ? "bg-secondary" : "bg-black/10")} />
          )}
          <div className="flex flex-col items-center gap-2 flex-none w-[84px]">
            <div
              className={cn(
                "h-7 w-7 flex-none rounded-full flex items-center justify-center text-xs font-bold",
                i < currentIndex
                  ? "bg-secondary text-primary"
                  : i === currentIndex
                    ? "bg-primary text-secondary ring-4 ring-secondary/25"
                    : "bg-[#f0f0ea] text-black/35"
              )}>
              {i < currentIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[11px] text-center leading-tight",
                i <= currentIndex ? "font-semibold text-primary" : "font-medium text-black/35"
              )}>
              {label}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
};

/** Maps a fit percentage to a Pill tone — higher confidence reads more solid. */
const fitPillVariant = (pct: number): NonNullable<PillProps["variant"]> => {
  if (pct >= 85) return "positive";
  if (pct >= 65) return "neutral";
  return "outline-dashed";
};

const RecommendClient: FC = () => {
  const [lookForOpen, setLookForOpen] = useState(false);
  const [available, setAvailable] = useState(true);
  const [askReviewed, setAskReviewed] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const markRequested = (id: string) => {
    setRequestedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Recommendations</h1>
          <Pill variant="neutral" className="gap-1.5 flex-none hidden sm:inline-flex">
            <Users className="h-3 w-3" />
            Made by humans at Remote Worldwide
          </Pill>
        </div>
        <StickerButton variant="outline" size="md" onClick={() => setLookForOpen((v) => !v)}>
          <Info className="h-4 w-4" />
          What we look for
        </StickerButton>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1180px] mx-auto">
        {/* Expandable "What we look for" panel */}
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            lookForOpen ? "max-h-[500px] opacity-100 mb-5" : "max-h-0 opacity-0"
          )}>
          <div className="rounded-2xl border border-black/10 bg-white shadow-[4px_4px_0_0_#e1f073] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[15px] font-bold text-primary">What our reviewers look for</p>
              <button
                type="button"
                onClick={() => setLookForOpen(false)}
                className="text-xs font-semibold text-black/40 hover:text-black/60 cursor-pointer">
                Close
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {WHAT_WE_LOOK_FOR.map((line) => (
                <div key={line} className="flex items-start gap-2.5">
                  <span className="h-5 w-5 flex-none rounded-md bg-secondary/40 flex items-center justify-center mt-0.5">
                    <Check className="h-3 w-3 text-[#5a6516]" />
                  </span>
                  <p className="text-sm text-black/70 leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dark hero — how the human-curated warm-intro model works */}
        <div className="relative overflow-hidden rounded-[18px] bg-[#222325] text-white p-7">
          <div aria-hidden className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-secondary/25 blur-3xl pointer-events-none" />

          <div className="relative">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-secondary mb-3">How recommendations work</p>
            <h2 className="text-2xl font-bold mb-1.5 max-w-[560px]">
              A real person reads your profile and makes the introduction themselves.
            </h2>
            <p className="text-sm text-white/70 leading-relaxed mb-6 max-w-[560px]">
              No bulk-blasted applications. A human reviewer on the Remote Worldwide team matches you against companies
              we already have a relationship with, then reaches out on your behalf with a warm intro instead of a
              resume dropped into a pile of 300.
            </p>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl bg-white/10 px-4 py-3 min-w-[140px]">
                <p className="text-2xl font-bold leading-none">2</p>
                <p className="text-xs text-white/55 mt-1.5">Live intros</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3 min-w-[140px]">
                <p className="text-2xl font-bold leading-none">5</p>
                <p className="text-xs text-white/55 mt-1.5">Companies watching</p>
              </div>
            </div>
          </div>
        </div>

        {/* Eligibility banner */}
        <DashCard className="mt-5 p-5 flex flex-wrap items-center gap-4 bg-[#fbfbf7]">
          <span className="h-10 w-10 flex-none rounded-full bg-secondary text-primary flex items-center justify-center">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary">
              {available ? "You're eligible for recommendations" : "Recommendations are paused"}
            </p>
            <p className="text-xs text-black/45">
              {available
                ? "Reviewers are actively matching you against 5 companies this week."
                : "You won't be matched against new companies until you resume."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <StickerButton variant="outline" size="sm" onClick={() => {}}>
              Update availability
            </StickerButton>
            <StickerButton
              variant={available ? "outline" : "secondary"}
              size="sm"
              onClick={() => setAvailable((v) => !v)}>
              {available ? "Pause" : "Resume"}
            </StickerButton>
          </div>
        </DashCard>

        {/* In progress */}
        <div className="flex items-center justify-between mt-8 mb-3">
          <h2 className="text-[15px] font-bold text-primary">In progress</h2>
          <span className="text-xs text-black/45">2 active</span>
        </div>

        {/* Highlighted Linear intro card */}
        <div className="rounded-2xl border border-primary bg-white shadow-[4px_4px_0_0_#e1f073] p-6">
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-10 w-10 flex-none rounded-xl bg-[#f0f0ea] text-primary font-extrabold text-sm flex items-center justify-center">
                L
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-primary">Linear</p>
                <p className="text-xs text-black/45">Senior Product Designer · intro sent 6 days ago</p>
              </div>
            </div>
            <Pill variant="active" className="flex-none">
              Highlighted
            </Pill>
          </div>

          <IntroStageTracker currentIndex={2} />

          <div className="mt-6 rounded-xl bg-[#fbfbf7] border border-black/8 p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-1.5">What they asked for</p>
            <p className="text-sm text-black/70 leading-relaxed">
              Maria Kowalski, Linear&apos;s design manager, replied asking for two portfolio case studies that show
              systems thinking before she sets up a call.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {askReviewed ? (
              <StickerButton variant="outline" size="md" disabled>
                <Check className="h-4 w-4" />
                Reviewed
              </StickerButton>
            ) : (
              <StickerButton variant="primary" size="md" onClick={() => setAskReviewed(true)}>
                Review the ask
              </StickerButton>
            )}
            <Link href="/dashboard/referrals">
              <StickerButton variant="outline" size="md">
                Message Maria
              </StickerButton>
            </Link>
          </div>
        </div>

        {/* Smaller Cron card — intro sent, waiting */}
        <DashCard className="mt-4 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-10 w-10 flex-none rounded-xl bg-[#f0f0ea] text-primary font-extrabold text-sm flex items-center justify-center">
                C
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-primary">Cron</p>
                <p className="text-xs text-black/45">Product Designer · intro sent 2 days ago</p>
              </div>
            </div>
            <Pill variant="neutral" className="flex-none">
              Waiting on reply
            </Pill>
          </div>
          <ProgressBar value={40} height="h-1.5" className="mt-4" />
          <p className="text-xs text-black/45 mt-2">
            Reviewers typically hear back within 5–7 days — we&apos;ll notify you the moment Cron replies.
          </p>
        </DashCard>

        {/* Companies we think you fit */}
        <div className="flex items-center justify-between mt-8 mb-3">
          <h2 className="text-[15px] font-bold text-primary">Companies we think you fit</h2>
          <span className="text-xs text-black/45">Updated weekly by our reviewers</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {RECOMMENDATION_CARDS.map((card) => {
            const initials = card.company.slice(0, 1);
            const requested = requestedIds.has(card.id);

            return (
              <DashCard key={card.id} className="p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-10 w-10 flex-none rounded-xl bg-[#f0f0ea] text-primary font-extrabold text-sm flex items-center justify-center">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-primary truncate">{card.company}</p>
                    <Pill variant={fitPillVariant(card.fitPct)} className="mt-1">
                      {card.fitLabel}
                    </Pill>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-primary">{card.fitPct}%</span>
                  <span className="text-xs text-black/45">fit score</span>
                </div>
                <ProgressBar value={card.fitPct} fillColor={card.fitPct >= 80 ? "#e1f073" : "#cddd54"} className="mb-5" />

                <div className="mt-auto">
                  {card.status ? (
                    <div className="rounded-lg bg-[#f0f0ea] px-3.5 py-2.5">
                      <p className="text-xs font-bold text-primary">{card.status}</p>
                      <p className="text-xs text-black/50 mt-0.5">{card.action}</p>
                    </div>
                  ) : card.id === "rec-raycast" ? (
                    <Link href="/dashboard/resume" className="block">
                      <StickerButton variant="outline" size="md" className="w-full">
                        {card.action}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </StickerButton>
                    </Link>
                  ) : requested ? (
                    <StickerButton variant="outline" size="md" className="w-full" disabled>
                      <Check className="h-4 w-4" />
                      Requested
                    </StickerButton>
                  ) : (
                    <StickerButton variant="primary" size="md" className="w-full" onClick={() => markRequested(card.id)}>
                      {card.action}
                    </StickerButton>
                  )}
                </div>
              </DashCard>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default RecommendClient;
