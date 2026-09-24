"use client";

import { FC, useId, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, Check, ChevronDown, Copy, Kanban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { ApplicationDraftAnswer, ApplicationDraftItem } from "@/app/lib/drafts/types";
import { TRACKER_HREF, useDeleteDraft } from "@/hooks/mutations/useDraftMutations";
import MarkAppliedDialog from "./MarkAppliedDialog";

/** Quiet inline control — weight is reserved for the row's real actions (the saved-jobs page's). */
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

const ago = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : formatDistanceToNowStrict(date, { addSuffix: true });
};

/**
 * Where "Continue" goes: the page the user was on when they left (the top
 * frame), else the form's own URL. http(s) only — the server stores nothing
 * else, and a link from the API is never trusted to be a safe href.
 */
function continueHref(draft: ApplicationDraftItem): string | null {
  const link = draft.pageUrl ?? draft.url;
  return /^https?:\/\//i.test(link) ? link : null;
}

/** The answers to show, in form order, with the cover letter moved last where a long block reads best. Blanks were removals. */
function shownAnswers(answers: ApplicationDraftAnswer[]): ApplicationDraftAnswer[] {
  const filled = answers.filter((row) => row.answer.trim() !== "");
  return [...filled.filter((row) => row.kind !== "cover-letter"), ...filled.filter((row) => row.kind === "cover-letter")];
}

const CopyButton: FC<{ text: string; what: string }> = ({ text, what }) => {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused clipboard access: the answer is still on screen to select.
      toast.error("Your browser didn't allow copying. Select the text instead.");
    }
  }

  return (
    <button type="button" onClick={() => void copy()} aria-label={`${copied ? "Copied" : "Copy"} ${what}`} className={cn(GHOST_BTN, "mt-2 -ml-2")}>
      {copied ? <Check className="h-3.5 w-3.5 text-[#6c7a1e]" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

/**
 * One saved answer. A profile value is labelled as one: it is a field the user
 * typed for this job (a phone number, a current company), not a question, and
 * it never goes onto the tracker row with the answers.
 */
const DraftAnswerCard: FC<{ answer: ApplicationDraftAnswer }> = ({ answer }) => {
  const letter = answer.kind === "cover-letter";
  return (
    <div className="rounded-xl border border-black/8 bg-[#fbfbf7] p-4">
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-xs font-bold text-primary">{answer.question || (letter ? "Cover letter" : "Untitled question")}</p>
        {answer.kind !== "question" && (
          <Pill variant="outline-dashed" className="flex-none px-2 py-0.5 text-[10.5px]">
            {letter ? "Cover letter" : "Profile field"}
          </Pill>
        )}
      </div>
      <p className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed text-black/70", letter && "max-h-72 overflow-y-auto")}>{answer.answer}</p>
      <CopyButton text={answer.answer} what={letter ? "cover letter" : `answer to “${answer.question}”`} />
    </div>
  );
};

export interface DraftRowProps {
  draft: ApplicationDraftItem;
}

/**
 * One draft on the drafts page. In progress: Continue (the posting, in a new
 * tab, where the extension's button fills it from the draft when asked), View answers, Mark as applied and
 * Delete. Applied: when, and the way to the tracker, instead of Mark as applied.
 */
const DraftRow: FC<DraftRowProps> = ({ draft }) => {
  const remove = useDeleteDraft();
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const panelId = useId();

  const applied = draft.status === "applied";
  const title = draft.role ?? "Untitled role";
  // With no company read off the page, the site stands in for it (and leaves the line below).
  const company = draft.company ?? draft.host;
  const answers = shownAnswers(draft.answers);
  const count = draft.answerCount;
  const at = applied ? ago(draft.appliedAt) : ago(draft.updatedAt);
  const meta = [
    draft.company ? draft.host : null,
    draft.location,
    `${count} answer${count === 1 ? "" : "s"}`,
    at ? `${applied ? "applied" : "saved"} ${at}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const resume = continueHref(draft);

  return (
    <div className={cn("flex flex-col gap-3 px-6 py-4", remove.isPending && "opacity-55")}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={company} src={null} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-primary">{title}</span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-black/65">{company}</span>
            <span className="mt-0.5 block truncate text-xs text-black/50">{meta}</span>
          </span>
        </div>

        <div className="flex flex-none items-center gap-0.5">
          {answers.length > 0 && (
            <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)} className={GHOST_BTN}>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
              {open ? "Hide answers" : "View answers"}
            </button>
          )}
          {confirming ? (
            <>
              <span className="px-1 text-xs text-black/55">Delete this draft?</span>
              <button
                type="button"
                disabled={remove.isPending}
                className={cn(GHOST_BTN, "text-[#b23c26] hover:bg-[#fdeae6] hover:text-[#b23c26]")}
                onClick={() => remove.mutate(draft.id, { onSettled: () => setConfirming(false) })}>
                Delete
              </button>
              <button type="button" className={GHOST_BTN} onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-label={`Delete the draft for ${title} at ${company}`}
              className={cn(GHOST_BTN, "hover:bg-[#fdeae6] hover:text-[#b23c26]")}
              onClick={() => setConfirming(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:pl-[60px]">
        {applied ? (
          <Link
            href={TRACKER_HREF}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#e1f073] px-3 py-1.5 text-xs font-bold text-[#222325] transition-colors hover:bg-[#d4e35f]">
            <Kanban className="h-3.5 w-3.5" />
            View in tracker
          </Link>
        ) : (
          <>
            {resume && (
              <a
                href={resume}
                target="_blank"
                rel="noopener noreferrer"
                title="Opens the application in a new tab. Press the RemoteWorldwide button on the form and choose your draft to fill it back in."
                className="inline-flex items-center gap-1.5 rounded-full bg-[#e1f073] px-3 py-1.5 text-xs font-bold text-[#222325] transition-colors hover:bg-[#d4e35f]">
                Continue
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span className="sr-only"> the application for {title}, in a new tab</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setMarking(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-black/12 bg-[#fbfbf7] px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-[#222325]">
              <Check className="h-3.5 w-3.5 text-black/55" />
              Mark as applied
            </button>
          </>
        )}
        {applied && resume && (
          <a href={resume} target="_blank" rel="noopener noreferrer" className={GHOST_BTN}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            Posting
            <span className="sr-only"> for {title}, in a new tab</span>
          </a>
        )}
      </div>

      <div id={panelId} role="region" aria-label={`Answers saved for ${title}`} hidden={!open} className="sm:pl-[60px]">
        {open && (
          <div className="flex flex-col gap-3">
            {answers.map((answer, i) => (
              <DraftAnswerCard key={`${answer.kind}-${i}-${answer.question}`} answer={answer} />
            ))}
          </div>
        )}
      </div>

      {!applied && <MarkAppliedDialog draft={draft} open={marking} onOpenChange={setMarking} />}
    </div>
  );
};

export default DraftRow;
