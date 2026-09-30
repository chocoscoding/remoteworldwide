"use client";

import { useMemo, type FC } from "react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import { numberAnswers, questionsByAnswer } from "@/app/lib/voice/format";
import TimestampChip from "../delivery/TimestampChip";

/** Where each answer sits: its number as the reader saw it ("Answer 3"), and the question it replied to. */
export interface AnswerIndex {
  numbers: ReadonlyMap<string, number>;
  questions: ReadonlyMap<string, string>;
}

/** Built once per transcript; every quote on a tab looks its answer up here. */
export function useAnswerIndex(turns: readonly TranscriptTurn[]): AnswerIndex {
  return useMemo(() => ({ numbers: numberAnswers(turns), questions: questionsByAnswer(turns) }), [turns]);
}

export interface AnswerMetaProps {
  index: AnswerIndex;
  turnId: string;
  /** The question as the analysis quoted it; the transcript's own is the fallback. */
  question?: string;
  atMs?: number;
  endMs?: number;
  className?: string;
}

/**
 * The line above a quote: which answer it came from, the question it
 * answered, and the ▶ chip that plays it. The chip renders only inside a
 * PlaybackProvider (a recorded session), and names itself for a screen reader
 * ("Play from 3 minutes 42 seconds").
 */
const AnswerMeta: FC<AnswerMetaProps> = ({ index, turnId, question, atMs, endMs, className }) => {
  const answer = index.numbers.get(turnId);
  const asked = question?.trim() || index.questions.get(turnId);
  if (answer === undefined && !asked && atMs === undefined) return null;
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <p className="min-w-0 text-xs leading-relaxed text-black/50">
        {answer !== undefined && <span className="font-bold text-black/60">Answer {answer}</span>}
        {answer !== undefined && asked && " · "}
        {asked && <>On: {asked}</>}
      </p>
      {atMs !== undefined && <TimestampChip atMs={atMs} endMs={endMs} />}
    </div>
  );
};

export default AnswerMeta;
