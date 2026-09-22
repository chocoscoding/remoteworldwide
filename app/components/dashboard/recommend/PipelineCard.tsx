"use client";

import { FC } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import type { IntroPipelineEntry, ReferralContact } from "@/app/lib/dashboard/types";
import { RECOMMENDATION_STAGE_LABELS } from "@/app/lib/recommendations/types";
import IntroQuestions from "./IntroQuestions";
import IntroStageTracker from "./IntroStageTracker";

export interface PipelineCardProps {
  entry: IntroPipelineEntry;
  /**
   * Someone you already know at the company, from your own contacts. The
   * reviewer never picks this — your network is yours — so it is looked up by
   * company on the page, not stored on the recommendation.
   */
  warmPath?: ReferralContact;
}

/** Closed copy, never "rejected": the pass is theirs to explain, not ours to announce. */
const CLOSED_LINE: Record<NonNullable<IntroPipelineEntry["outcome"]>, (company: string) => string> = {
  connected: (company) => `You and ${company} are connected — they took it from here.`,
  passed: (company) => `${company} went another direction. Reviewers keep looking for your next fit.`,
  expired: (company) => `This one closed before ${company} heard back from you.`,
};

const PipelineCard: FC<PipelineCardProps> = ({ entry, warmPath }) => {
  const questions = entry.questions ?? [];
  const closed = entry.outcome !== undefined;
  const awaitingYou = !closed && questions.length > 0 && questions.some((q) => !q.answer);
  const answered = questions.length > 0 && questions.every((q) => q.answer);
  const progress = Math.round((entry.stageIndex / (RECOMMENDATION_STAGE_LABELS.length - 1)) * 100);

  return (
    <DashCard
      className={cn(
        "p-6",
        // The one accent on this screen: something is waiting on you. Same
        // tier as the referrals direct-paths card.
        awaitingYou && "border-[1.5px] border-[#222325] shadow-[4px_4px_0_0_#e1f073]"
      )}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={entry.company} tone="dark" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-bold text-primary">{entry.company}</p>
              {entry.outcome === "connected" ? (
                <Pill variant="positive">Connected</Pill>
              ) : closed ? (
                <Pill variant="neutral">Closed</Pill>
              ) : awaitingYou ? (
                <Pill variant="urgent">Waiting on you</Pill>
              ) : entry.stageIndex >= RECOMMENDATION_STAGE_LABELS.length - 1 ? (
                <Pill variant="positive">Interviewing</Pill>
              ) : (
                <Pill variant="neutral">{RECOMMENDATION_STAGE_LABELS[entry.stageIndex]}</Pill>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-black/55">
              {entry.jobUrl ? (
                <a
                  href={entry.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-black/65 underline decoration-dotted underline-offset-2 hover:text-primary hover:decoration-solid">
                  {entry.role}
                </a>
              ) : (
                entry.role
              )}{" "}
              · {entry.startedAgoDays === 0 ? "today" : `${entry.startedAgoDays} days ago`}
            </p>
          </div>
        </div>

        {warmPath && (
          <Link
            href={`/dashboard/referrals?contact=${warmPath.id}`}
            className="inline-flex flex-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-black/55 transition-colors hover:bg-black/[0.05] hover:text-primary">
            <Avatar name={warmPath.name} size="sm" />
            Message {warmPath.name.split(" ")[0]}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <IntroStageTracker currentIndex={entry.stageIndex} className="mt-5" />
      <ProgressBar value={progress} height="h-1.5" className="mt-4" fillColor={awaitingYou ? "#cddd54" : "#e1f073"} />

      {/* Why a person picked you — the part of this no algorithm wrote. */}
      {entry.note && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-[#fbfbf7] px-4 py-3">
          <Quote className="mt-0.5 h-3.5 w-3.5 flex-none text-[#6c7a1e]" />
          <div className="min-w-0">
            <p className="whitespace-pre-line text-sm leading-relaxed text-black/70">{entry.note}</p>
            {entry.reviewerName && <p className="mt-1 text-[11px] font-semibold text-black/45">— {entry.reviewerName}, Remote Worldwide</p>}
          </div>
        </div>
      )}

      {awaitingYou && <IntroQuestions entry={entry} />}

      {answered && (
        <div className="mt-4 border-t border-black/10 pt-4">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">What you told them</p>
          <div className="flex flex-col gap-3.5">
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-black/10 bg-[#fbfbf7] p-4">
                <p className="text-sm font-semibold leading-relaxed text-primary">{q.question}</p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-black/60">{q.answer}</p>
              </div>
            ))}
          </div>
          {!closed && (
            <div className="mt-3.5 flex items-start gap-2">
              <CalendarClock className="mt-0.5 h-3.5 w-3.5 flex-none text-[#6c7a1e]" />
              <p className="text-xs leading-relaxed text-black/60">
                Sent. {entry.company} reaches out directly to book the conversation — there&apos;s nothing else for you to do here.
              </p>
            </div>
          )}
        </div>
      )}

      {closed && entry.outcome && (
        <p className="mt-4 border-t border-black/10 pt-4 text-xs leading-relaxed text-black/60">{CLOSED_LINE[entry.outcome](entry.company)}</p>
      )}

      {!closed && !awaitingYou && !answered && (
        <p className="mt-4 border-t border-black/10 pt-4 text-xs leading-relaxed text-black/60">
          Our reviewers have put you in front of {entry.company}. If they want to take it further, their questions land here.
        </p>
      )}
    </DashCard>
  );
};

export default PipelineCard;
