"use client";

import { FC, Fragment } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import Pill from "@/app/components/dashboard/ui/Pill";
import { RECOMMENDATION_STAGES, RECOMMENDATION_STAGE_LABELS } from "@/app/lib/recommendations/types";
import type { IntroPipelineEntry } from "@/app/lib/dashboard/types";
import { companyAvatarClass } from "./FitCard";

/**
 * The list view of a recommendation — deliberately just the headline facts.
 * The full story (questions, answers, the reviewer's note) lives on the
 * entry's own page; stacking whole Q&A forms in the list buried everything
 * below the first card.
 */
export interface PipelineSummaryCardProps {
  entry: IntroPipelineEntry;
}

const QUESTIONS_STEP = RECOMMENDATION_STAGES.indexOf("questions");
const LAST_STEP = RECOMMENDATION_STAGE_LABELS.length - 1;

export const startedLabel = (days: number) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

interface Step {
  label: string;
  done: boolean;
  current: boolean;
}

/**
 * The three stages in one line. Answering ticks the questions step straight
 * away ("You answered"), so while the company reads them nothing is lit: the
 * next move is theirs.
 */
function stepsOf(entry: IntroPipelineEntry, answered: boolean): Step[] {
  return RECOMMENDATION_STAGE_LABELS.map((label, i) => {
    const answeredHere = i === QUESTIONS_STEP && answered;
    const done = i < entry.stageIndex || (i === entry.stageIndex && answeredHere);
    return { label: done && answeredHere ? "You answered" : label, done, current: i === entry.stageIndex && !done };
  });
}

const StageLine: FC<{ steps: Step[] }> = ({ steps }) => (
  <span className="flex items-center gap-2 text-xs">
    {steps.map((step, i) => (
      <Fragment key={i}>
        {/* The rule into a step is ink once that step is reached. */}
        {i > 0 && <span className={cn("h-0.5 min-w-3 flex-1", step.done || step.current ? "bg-[#222325]" : "bg-black/15")} />}
        <span
          className={cn(
            "grid h-5 w-5 flex-none place-content-center rounded-full text-[10px] font-extrabold",
            step.done
              ? "bg-[#222325]"
              : step.current
                ? "border-[1.5px] border-[#222325] bg-[#e1f073] text-primary"
                : "border-[1.5px] border-black/30 text-[#5f6062]",
          )}>
          {step.done ? <Check className="h-[11px] w-[11px] text-[#e1f073]" strokeWidth={3.5} aria-hidden /> : i + 1}
        </span>
        {/* On a phone only the current stage keeps its name; the others are their number. */}
        <span
          className={cn(
            "whitespace-nowrap",
            step.done ? "font-semibold text-[#55564f]" : step.current ? "font-extrabold text-primary" : "text-[#5f6062]",
            !step.current && "max-sm:sr-only",
          )}>
          {step.label}
        </span>
      </Fragment>
    ))}
  </span>
);

const PipelineSummaryCard: FC<PipelineSummaryCardProps> = ({ entry }) => {
  const questions = entry.questions ?? [];
  const unanswered = questions.filter((q) => !q.answer).length;
  const awaitingYou = unanswered > 0;
  const answered = questions.length > 0 && unanswered === 0;
  const interviewing = entry.stageIndex >= LAST_STEP;

  const status = awaitingYou
    ? `Answer ${unanswered} question${unanswered === 1 ? "" : "s"}`
    : interviewing
      ? "Interviewing"
      : answered
        ? `Waiting on ${entry.company}`
        : RECOMMENDATION_STAGE_LABELS[entry.stageIndex];

  return (
    <Link
      href={`/dashboard/recommend/${entry.id}`}
      className={cn(
        "flex flex-col gap-3.5 rounded-2xl bg-white p-[18px]",
        // The one accent in the list: something is waiting on you.
        awaitingYou ? "br-bold-press br-lime" : "br-plain-press border-black/[0.14] hover:border-[#222325]",
      )}>
      <span className="flex items-center gap-3">
        <Avatar name={entry.company} tone="dark" className={companyAvatarClass(entry.company)} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-extrabold text-primary">{entry.company}</span>
          <span className="truncate text-xs text-[#5f6062]">
            {entry.role} · {startedLabel(entry.startedAgoDays)}
          </span>
        </span>
        {/* Capped so a long company name in "Waiting on …" can't push the card's own name out on a phone. */}
        <Pill variant={awaitingYou ? "urgent" : interviewing ? "positive" : "neutral"} className="block max-w-[55%] flex-none truncate font-bold" title={status}>
          {status}
        </Pill>
        <ChevronRight className={cn("h-4 w-4 flex-none", awaitingYou ? "text-primary" : "text-[#5f6062]")} aria-hidden />
      </span>
      <StageLine steps={stepsOf(entry, answered)} />
    </Link>
  );
};

export default PipelineSummaryCard;
