"use client";

import { FC, useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
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

/** Draft storage key — survives reloads; cleared only on a successful send. */
const draftKey = (questionId: string) => `rww-intro-draft-${questionId}`;

const IntroQuestions: FC<IntroQuestionsProps> = ({ entry }) => {
  const { answerIntroQuestions } = useNetwork();
  const questions = entry.questions ?? [];

  // Drafts autosave to localStorage on every keystroke and restore on mount —
  // losing a half-written answer is the worst bug this screen can have. Reads
  // and writes are try/caught: a blocked storage just degrades to in-memory.
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const restored: Record<string, string> = {};
    try {
      for (const q of questions) {
        const saved = window.localStorage.getItem(draftKey(q.id));
        if (saved) restored[q.id] = saved;
      }
    } catch {
      /* storage unavailable — start empty */
    }
    return restored;
  });

  function updateDraft(questionId: string, text: string) {
    setDrafts((prev) => ({ ...prev, [questionId]: text }));
    try {
      window.localStorage.setItem(draftKey(questionId), text);
    } catch {
      /* storage unavailable — the in-memory draft still works */
    }
  }

  function send() {
    answerIntroQuestions(entry.id, drafts);
    try {
      for (const q of questions) window.localStorage.removeItem(draftKey(q.id));
    } catch {
      /* nothing to clean */
    }
  }

  const complete = questions.every((q) => (drafts[q.id] ?? "").trim().length > 0);

  return (
    <div className="mt-4 border-t border-black/10 pt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">
          {entry.company} asked {questions.length === 1 ? "one thing" : `${questions.length} things`}
        </p>
        {entry.expiresInDays !== undefined && (
          <p className={cn("text-[11px] font-semibold", entry.expiresInDays <= 2 ? "text-[#b23c26]" : "text-black/45")}>
            closes in {entry.expiresInDays}d
          </p>
        )}
      </div>

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
              onChange={(e) => updateDraft(q.id, e.target.value)}
              minRows={3}
              placeholder="Answer in your own words…"
              className="w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StickerButton variant="primary" size="md" disabled={!complete} onClick={send}>
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
