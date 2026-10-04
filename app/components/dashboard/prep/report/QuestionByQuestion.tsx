"use client";

import { useId, useMemo, useState, type FC } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DimensionScore, Rewrite, TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import type { PracticeQuestion } from "@/app/lib/prep/practice";
import TimestampChip from "../delivery/TimestampChip";
import ClippedQuote from "./ClippedQuote";
import { flagsFor, reportAnswers, rewriteFor, type ReportAnswer, type SessionQuestionRef } from "./answerNotes";
import { answerAgain, answerQuestionText, notReached } from "./practiceSets";
import RewritePopover from "./RewritePopover";

/**
 * Overall's "Question by question": every answer, in order, with what it was
 * missing and how it could have been said, then the questions the session
 * didn't reach. The first answer is open; the rest open on a click. Every
 * flag and rewrite is the AI service's, read through answerNotes, so this
 * card and the transcript always say the same about the same answer.
 */
export interface QuestionByQuestionProps {
  turns: readonly TranscriptTurn[];
  questions: readonly SessionQuestionRef[];
  dimensions: readonly DimensionScore[];
  rewrites: readonly Rewrite[];
  /** Starts a practice session on these questions; without it, no practice button shows. */
  onPractise?: (questions: PracticeQuestion[]) => void;
}

const QuestionByQuestion: FC<QuestionByQuestionProps> = ({ turns, questions, dimensions, rewrites, onPractise }) => {
  const titleId = useId();
  const answers = useMemo(() => reportAnswers(turns, questions), [turns, questions]);
  const missed = useMemo(() => notReached(questions, turns), [questions, turns]);
  // The first answer opens by itself; the reader's own choices after that.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(answers[0] ? [answers[0].turnId] : []));
  const toggle = (turnId: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });

  if (answers.length === 0 && missed.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className="overflow-hidden rounded-[14px] border border-black/[0.16] bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
        <h2 id={titleId} className="text-sm font-extrabold text-[#222325]">
          Question by question
        </h2>
        <span className="text-xs text-[#5f6062]">
          {answers.length} answered · {missed.length} not reached
        </span>
      </div>
      <ol>
        {answers.map((answer) => (
          <AnswerItem
            key={answer.turnId}
            answer={answer}
            question={answerQuestionText(answer, questions)}
            open={open.has(answer.turnId)}
            onToggle={() => toggle(answer.turnId)}
            flags={flagsFor(answer, dimensions)}
            rewrite={rewriteFor(answer, rewrites)?.better ?? null}
            again={onPractise ? answerAgain(answer, questions) : null}
            onPractise={onPractise}
          />
        ))}
        {missed.map((q, i) => (
          <li key={q.id} className="flex min-h-[46px] items-center gap-2.5 border-t border-black/[0.12] px-4 py-1.5 text-[#5f6062]">
            <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-dashed border-black/50 text-[11px] font-extrabold">
              {answers.length + i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px]" title={q.text}>
              {q.text}
            </span>
            <span className="flex-none rounded-full border border-dashed border-black/50 px-2 py-0.5 text-[11px] font-bold">Not answered</span>
          </li>
        ))}
      </ol>
    </section>
  );
};

interface AnswerItemProps {
  answer: ReportAnswer;
  question: string | null;
  open: boolean;
  onToggle: () => void;
  flags: readonly string[];
  rewrite: string | null;
  again: PracticeQuestion | null;
  onPractise?: (questions: PracticeQuestion[]) => void;
}

const AnswerItem: FC<AnswerItemProps> = ({ answer, question, open, onToggle, flags, rewrite, again, onPractise }) => {
  const bodyId = useId();

  return (
    <li className="flex flex-col gap-2.5 border-t border-black/[0.12] px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#222325] text-[11px] font-extrabold text-[#e1f073]">
          {answer.index}
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-extrabold leading-snug text-[#222325]">
          <span className="sr-only">Answer {answer.index}: </span>
          {question ?? `Answer ${answer.index}`}
        </h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? `Collapse answer ${answer.index}` : `Expand answer ${answer.index}`}
          className="-my-0.5 inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md text-[#222325] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
          <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
      </div>

      <div id={bodyId} hidden={!open} className="ml-[34px] flex flex-col gap-2.5">
        <div className="flex items-start gap-2.5 rounded-[10px] bg-[#f6f6f6] px-3 py-2.5">
          <ClippedQuote text={answer.text} className="flex-1 text-sm text-[#44453f]" />
          {answer.startMs !== undefined && <TimestampChip atMs={answer.startMs} endMs={answer.endMs} />}
        </div>

        {(flags.length > 0 || rewrite || (again && onPractise)) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {flags.map((flag) => (
              <span key={flag} className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f0ea] px-2.5 py-[3px] text-xs font-bold text-[#222325]">
                <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[#222325]" />
                {flag}
              </span>
            ))}
            {rewrite && <RewritePopover text={rewrite} />}
            <span aria-hidden className="flex-1" />
            {again && onPractise && (
              <button
                type="button"
                onClick={() => onPractise([again])}
                className="inline-flex h-[30px] flex-none cursor-pointer items-center rounded-lg border border-[#222325] bg-white px-3 text-xs font-extrabold text-[#222325] transition-colors hover:bg-[#f6faea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-1">
                Answer this one again
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

export default QuestionByQuestion;
