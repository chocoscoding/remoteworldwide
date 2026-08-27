"use client";

import { FC } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";
import { INTRO_STAGES } from "@/app/lib/dashboard/mock-data";
import type { IntroPipelineEntry } from "@/app/lib/dashboard/types";
import IntroQuestions from "./IntroQuestions";
import IntroStageTracker from "./IntroStageTracker";

export interface PipelineCardProps {
  entry: IntroPipelineEntry;
}

const PipelineCard: FC<PipelineCardProps> = ({ entry }) => {
  const { contacts } = useNetwork();

  const questions = entry.questions ?? [];
  const awaitingYou = questions.length > 0 && questions.some((q) => !q.answer);
  const answered = questions.length > 0 && !awaitingYou;
  const contact = entry.contactId ? contacts.find((c) => c.id === entry.contactId) : undefined;
  const progress = Math.round((entry.stageIndex / (INTRO_STAGES.length - 1)) * 100);

  return (
    <DashCard
      className={cn(
        "p-6",
        // The one accent on this screen: something is waiting on you.
        awaitingYou && "border-[#222325] shadow-[4px_4px_0_0_#e1f073]"
      )}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={entry.company} tone="dark" />
          <div className="min-w-0">
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
              {entry.role} · put forward {entry.putForwardAgoDays === 0 ? "today" : `${entry.putForwardAgoDays} days ago`}
            </p>
          </div>
        </div>

        {contact && (
          <Link
            href={`/dashboard/referrals?contact=${contact.id}`}
            className="inline-flex flex-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-black/55 transition-colors hover:bg-black/[0.05] hover:text-primary">
            <Avatar name={contact.name} size="sm" />
            Message {contact.name.split(" ")[0]}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <IntroStageTracker currentIndex={entry.stageIndex} className="mt-5" />
      <ProgressBar value={progress} height="h-1.5" className="mt-4" fillColor={awaitingYou ? "#cddd54" : "#e1f073"} />

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
          <div className="mt-3.5 flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 flex-none text-[#6c7a1e]" />
            <p className="text-xs leading-relaxed text-black/60">
              Sent. {entry.company} reaches out directly to book the conversation — there&apos;s nothing else for you to do here.
            </p>
          </div>
        </div>
      )}

      {!awaitingYou && !answered && (
        <p className="mt-4 border-t border-black/10 pt-4 text-xs leading-relaxed text-black/60">
          Our reviewers have put you in front of {entry.company}. If they want to take it further, their questions land here.
        </p>
      )}
    </DashCard>
  );
};

export default PipelineCard;
