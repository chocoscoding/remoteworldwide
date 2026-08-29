"use client";

import { FC, useState } from "react";
import { Send } from "lucide-react";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";
import type { IntroPipelineEntry } from "@/app/lib/dashboard/types";

/**
 * The whole interaction with a company you've been put in front of: they ask
 * one or two things, you answer, you're connected. There is deliberately no
 * thread here — no reply box, no history, no unread state. Once these are
 * sent, the company reaches out directly.
 *
 * Mounts only while questions are unanswered, so the drafts live and die with
 * the open state (no reset effect).
 */
export interface IntroQuestionsProps {
  entry: IntroPipelineEntry;
}

const IntroQuestions: FC<IntroQuestionsProps> = ({ entry }) => {
  const { answerIntroQuestions } = useNetwork();
  const questions = entry.questions ?? [];
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const complete = questions.every((q) => (drafts[q.id] ?? "").trim().length > 0);

  return (
    <div className="mt-4 border-t border-black/10 pt-4">
      <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">
        {entry.company} asked {questions.length === 1 ? "one thing" : `${questions.length} things`}
      </p>

      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <div key={q.id}>
            <label htmlFor={`${entry.id}-${q.id}`} className="mb-1.5 flex gap-2 text-sm font-semibold leading-relaxed text-primary">
              <span className="text-black/40 tabular-nums">{i + 1}.</span>
              {q.question}
            </label>
            <AutoGrowTextarea
              id={`${entry.id}-${q.id}`}
              value={drafts[q.id] ?? ""}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
              minRows={3}
              placeholder="Answer in your own words…"
              className="w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StickerButton variant="primary" size="md" disabled={!complete} onClick={() => answerIntroQuestions(entry.id, drafts)}>
          <Send className="h-4 w-4" />
          Send answers
        </StickerButton>
        <p className="text-xs text-black/55">
          {complete
            ? "Goes straight to their hiring team."
            : questions.length === 1
              ? "Answer to send."
              : `Answer all ${questions.length} to send.`}
        </p>
      </div>
    </div>
  );
};

export default IntroQuestions;
