"use client";

import { FC, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApplication } from "@/app/lib/applications/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import { useDraftsQuery } from "@/hooks/queries/useDraftsQuery";

/**
 * "Your application answers" in the tracker's job window: what was sent on this
 * application, from the tracker entry itself (`GET /api/applications/:id`).
 * Before anything is sent, the extension's unsent draft tied to this entry
 * stands in, labelled as a draft. These are the job's own copies: deleting the
 * tracker entry deletes them, while the saved-answer library keeps whatever was
 * copied into it when the application was sent (owner, 2026-10-15).
 *
 * Three answers show, the rest open in place. Read only when the window opens.
 */

const SHOWN = 3;

interface QA {
  question: string;
  answer: string;
}

const AnswerItem: FC<{ item: QA }> = ({ item }) => (
  <div className="rounded-xl border border-black/8 bg-[#fbfbf7] p-3.5">
    <p className="mb-1 break-words text-xs font-bold text-primary">{item.question}</p>
    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-black/70">{item.answer}</p>
  </div>
);

const JobAnswers: FC<{ applicationId: string }> = ({ applicationId }) => {
  const [expanded, setExpanded] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const detail = useQuery({
    queryKey: qk.answers.application(applicationId),
    queryFn: ({ signal }) => getApplication(applicationId, signal),
    staleTime: STALE_TIME.answers,
  });
  const drafts = useDraftsQuery("all");

  const sent: QA[] = (detail.data?.answers ?? []).filter((row) => row.question.trim() && row.answer.trim());
  const coverLetter = detail.data?.coverLetter?.trim() || null;
  const draft = (drafts.data ?? []).find((row) => row.status === "draft" && row.trackedApplicationId === applicationId) ?? null;
  const drafted: QA[] = draft ? draft.answers.filter((row) => row.kind === "question" && row.question.trim() && row.answer.trim()) : [];

  const fromDraft = sent.length === 0 && drafted.length > 0;
  const items = fromDraft ? drafted : sent;
  const shown = expanded ? items : items.slice(0, SHOWN);

  return (
    <div className="border-t border-black/10 px-6 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55">Your application answers</p>
        {fromDraft && <span className="rounded-full border border-dashed border-black/25 px-2 py-0.5 text-[10.5px] font-semibold text-black/55">Draft, not sent yet</span>}
      </div>

      {detail.isPending ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <div className="h-14 animate-pulse rounded-xl bg-black/[0.05]" />
          <div className="h-14 animate-pulse rounded-xl bg-black/[0.05]" />
        </div>
      ) : detail.isError ? (
        <p className="text-xs text-black/55">Your answers couldn&apos;t be loaded right now.</p>
      ) : items.length === 0 && !coverLetter ? (
        <p className="text-xs leading-relaxed text-black/55">
          Nothing saved for this job yet. Apply with the extension or the apply wizard, and the answers you send show up here.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((item, i) => (
            <AnswerItem key={`${i}-${item.question}`} item={item} />
          ))}
          {items.length > SHOWN && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 transition-colors hover:bg-black/[0.05] hover:text-primary">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
              {expanded ? "Show fewer" : `Show all ${items.length}`}
            </button>
          )}
          {coverLetter && !fromDraft && (
            <div className="rounded-xl border border-black/8 p-3.5">
              <button
                type="button"
                aria-expanded={letterOpen}
                onClick={() => setLetterOpen((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 text-left text-xs font-bold text-primary">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Cover letter you sent
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", letterOpen && "rotate-180")} />
              </button>
              {letterOpen && <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed text-black/70">{coverLetter}</p>}
            </div>
          )}
          {fromDraft && (
            <Link href="/dashboard/drafts" className="w-fit text-xs font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
              Open in Application drafts
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default JobAnswers;
