"use client";

import { FC } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { INTRO_STAGES } from "@/app/lib/dashboard/mock-data";
import type { IntroPipelineEntry } from "@/app/lib/dashboard/types";

/**
 * The list view of a recommendation — deliberately just the headline facts.
 * The full story (stage tracker, questions, answers) lives on the entry's own
 * page; stacking whole Q&A forms in the list buried everything below the
 * first card.
 */
export interface PipelineSummaryCardProps {
  entry: IntroPipelineEntry;
}

const PipelineSummaryCard: FC<PipelineSummaryCardProps> = ({ entry }) => {
  const questions = entry.questions ?? [];
  const unanswered = questions.filter((q) => !q.answer).length;
  const awaitingYou = unanswered > 0;
  const answered = questions.length > 0 && unanswered === 0;
  const progress = Math.round((entry.stageIndex / (INTRO_STAGES.length - 1)) * 100);

  return (
    <Link href={`/dashboard/recommend/${entry.id}`} className="group block">
      <DashCard
        className={cn(
          "p-5 transition-[border-color,box-shadow]",
          // The one accent on this screen: something is waiting on you.
          awaitingYou
            ? "border-[1.5px] border-[#222325] shadow-[4px_4px_0_0_#e1f073] group-hover:shadow-[5px_5px_0_0_#e1f073]"
            : "group-hover:border-black/30"
        )}>
        <div className="flex items-center gap-3">
          <Avatar name={entry.company} tone="dark" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-bold text-primary">{entry.company}</p>
              {awaitingYou ? (
                <Pill variant="urgent">Waiting on you</Pill>
              ) : entry.stageIndex >= INTRO_STAGES.length - 1 ? (
                <Pill variant="positive">Interviewing</Pill>
              ) : (
                <Pill variant="neutral">{INTRO_STAGES[entry.stageIndex]}</Pill>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-black/55">
              {entry.role} · {entry.startedAgoDays === 0 ? "today" : `${entry.startedAgoDays} days ago`}
            </p>
          </div>

          <div className="flex flex-none items-center gap-2.5 text-right">
            <div>
              {awaitingYou ? (
                <>
                  <p className="text-xs font-bold text-primary">
                    Answer {unanswered} question{unanswered === 1 ? "" : "s"}
                  </p>
                  {entry.expiresInDays !== undefined && (
                    <p className={cn("mt-0.5 text-[11px] font-semibold", entry.expiresInDays <= 2 ? "text-[#b23c26]" : "text-black/45")}>
                      closes in {entry.expiresInDays}d
                    </p>
                  )}
                </>
              ) : answered ? (
                <p className="text-xs text-black/55">Waiting on {entry.company}</p>
              ) : (
                <p className="text-xs text-black/55">Their questions land here</p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-black/30 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        <ProgressBar value={progress} height="h-1.5" className="mt-4" fillColor={awaitingYou ? "#cddd54" : "#e1f073"} />
      </DashCard>
    </Link>
  );
};

export default PipelineSummaryCard;
