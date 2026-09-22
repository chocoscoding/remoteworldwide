"use client";

// Step 5 — the form's questions, and tracking it as applied.
//
// Nothing here submits anything to an employer. There is no integration that
// could, so the step says so plainly: open the real application in a new tab,
// paste what was prepared, send it there, then "Track as applied" records it —
// the resume, the letter and these answers included — so the tracker, the
// follow-ups and the coach know it went out.
//
// The questions are the user's to list, because nothing reads the employer's
// form. Answers come from `POST /api/ai/autofill`: a question they have answered
// before comes back verbatim from their saved-answer library for free,
// demographic questions are left for them, and whatever is left is one drafted
// batch for AUTOFILL_CREDITS. An answer they have typed is never overwritten.

import { useRef, useState, type FC } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Check, Copy, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { APPLICATION_LIMITS, type ApplicationAnswer, type ApplicationItem } from "@/app/lib/applications/types";
import { ATS_BILLING_HREF } from "@/app/lib/ats/api";
import { AUTOFILL_CREDITS, AUTOFILL_MAX_QUESTIONS, AUTOFILL_QUESTION_MAX, draftAnswers, type AutofillAnswer } from "@/app/lib/autofill/api";
import { qk } from "@/app/lib/query/keys";
import { applyLinkOf, hostOf, type StartedJob } from "../job";

export interface SubmitStepProps {
  job: StartedJob;
  resumeId: string | null;
  resumeName: string | null;
  atsScore: number | null;
  /** The letter as it will be recorded; null when none goes with it. */
  letter: string | null;
  duplicate: ApplicationItem | null | undefined;
  tracked: boolean;
  onTrack: (answers: ApplicationAnswer[]) => void;
  onEditStep: (step: 2 | 3) => void;
}

interface QuestionRow {
  id: string;
  question: string;
  answer: string;
  /** What the drafter said about the answer it filled; null before a draft, or once the user has typed. */
  drafted: Pick<AutofillAnswer, "confidence" | "cat"> | null;
  /** The user typed this answer, so a draft never replaces it. */
  edited: boolean;
}

/** Common screening questions, one click to add. Nothing is asked until the user adds it. */
const suggestedQuestions = (company: string) => [
  `Why do you want to work at ${company}?`,
  "What are your salary expectations?",
  "What is your notice period?",
  "Are you authorised to work where this role is based?",
  "Tell us about a project you're proud of.",
];

/** How the drafter's echo is matched back to a row: it collapses whitespace, and case never mattered. */
const norm = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/** Below this a drafted answer is flagged for a second look. */
const CHECK_BELOW = 0.6;

const FIELD =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]";

const SubmitStep: FC<SubmitStepProps> = ({ job, resumeId, resumeName, atsScore, letter, duplicate, tracked, onTrack, onEditStep }) => {
  const queryClient = useQueryClient();
  const nextId = useRef(1);
  const [rows, setRows] = useState<QuestionRow[]>([{ id: "q-0", question: "", answer: "", drafted: null, edited: false }]);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<{ message: string; credits: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const link = applyLinkOf(job);
  const asked = rows.filter((row) => row.question.trim());
  // Drafting fills blanks and nothing else: a typed or drafted answer is never
  // sent again, so clearing one is how to ask for a fresh draft of it.
  const toDraft = asked.filter((row) => !row.answer.trim());
  const answered: ApplicationAnswer[] = rows
    .filter((row) => row.question.trim() && row.answer.trim())
    .slice(0, APPLICATION_LIMITS.answersMax)
    .map((row) => ({
      question: row.question.trim().slice(0, APPLICATION_LIMITS.questionMax),
      answer: row.answer.trim().slice(0, APPLICATION_LIMITS.answerMax),
    }));
  const present = new Set(rows.map((row) => norm(row.question)));
  const suggestions = suggestedQuestions(job.company).filter((question) => !present.has(norm(question)));
  const full = rows.length >= AUTOFILL_MAX_QUESTIONS;

  function patchRow(id: string, patch: Partial<QuestionRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow(question = "") {
    if (full) return;
    const id = `q-${nextId.current++}`;
    setRows((prev) => {
      // An empty row is filled rather than joined by another.
      const blank = prev.find((row) => !row.question.trim() && !row.answer.trim());
      if (question && blank) return prev.map((row) => (row.id === blank.id ? { ...row, question } : row));
      return [...prev, { id, question, answer: "", drafted: null, edited: false }];
    });
  }

  function removeRow(id: string) {
    // The last row is emptied rather than removed, so there is always somewhere to type.
    const fresh: QuestionRow = { id: `q-${nextId.current++}`, question: "", answer: "", drafted: null, edited: false };
    setRows((prev) => (prev.length === 1 ? [fresh] : prev.filter((row) => row.id !== id)));
  }

  async function draft() {
    if (drafting || toDraft.length === 0) return;
    setDrafting(true);
    setDraftError(null);
    try {
      // No application id: the application does not exist until it is tracked,
      // and autofill files its use log under whatever id it is given. The real
      // id is logged once "Track as applied" has created the row.
      const answers = await draftAnswers({ questions: toDraft.map((row) => row.question), resumeId });
      const byQuestion = new Map(answers.map((answer) => [norm(answer.question), answer]));
      setRows((prev) =>
        prev.map((row) => {
          // Answered since the draft was asked for: that answer stands.
          if (row.answer.trim()) return row;
          const answer = byQuestion.get(norm(row.question));
          if (!answer) return row;
          return { ...row, answer: answer.answer, drafted: { confidence: answer.confidence, cat: answer.cat }, edited: false };
        }),
      );
    } catch (error) {
      setDraftError({ message: apiMessage(error), credits: error instanceof BackendError && error.status === 402 });
    } finally {
      setDrafting(false);
      // Charged or not, the balance in the header may be behind now. And every
      // fresh draft is filed into the saved-answer library, so the Questions
      // screen's list is too.
      void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
      void queryClient.invalidateQueries({ queryKey: qk.answers.list() });
    }
  }

  async function copyAnswers() {
    try {
      await navigator.clipboard.writeText(answered.map((row) => `${row.question}\n${row.answer}`).join("\n\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused clipboard access: the answers are still on screen to select.
    }
  }

  const letterWords = letter ? letter.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col gap-5">
      <DashCard className="p-6">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-bold text-primary">What does the form ask?</p>
          <Pill variant="neutral">
            {asked.length} of {AUTOFILL_MAX_QUESTIONS}
          </Pill>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-black/45">
          Add the questions from the application. Ones you&apos;ve answered before come back from your saved answers for free; the rest are
          drafted from your profile and resume for {AUTOFILL_CREDITS} credit a batch. Anything you type is never overwritten.
        </p>

        {suggestions.length > 0 && !full && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {suggestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => addRow(question)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-black/25 px-3 py-1.5 text-xs font-semibold text-black/55 transition-colors hover:border-[#222325] hover:text-primary">
                <Plus className="h-3 w-3" />
                {question}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col divide-y divide-black/8">
          {rows.map((row, index) => (
            <div key={row.id} className="flex flex-col gap-2 py-4 first:pt-0">
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`${row.id}-q`}>
                  Question {index + 1}
                </label>
                <input
                  id={`${row.id}-q`}
                  value={row.question}
                  maxLength={AUTOFILL_QUESTION_MAX}
                  onChange={(e) => patchRow(row.id, { question: e.target.value })}
                  placeholder="Paste a question from the form…"
                  className={cn(FIELD, "font-semibold")}
                />
                <RowBadge row={row} />
                <button
                  type="button"
                  aria-label={`Remove question ${index + 1}`}
                  onClick={() => removeRow(row.id)}
                  className="grid h-9 w-9 flex-none cursor-pointer place-content-center rounded-lg text-black/40 transition-colors hover:bg-black/[0.05] hover:text-primary">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {row.question.trim() && (
                <>
                  <label className="sr-only" htmlFor={`${row.id}-a`}>
                    Answer {index + 1}
                  </label>
                  <AutoGrowTextarea
                    id={`${row.id}-a`}
                    minRows={2}
                    value={row.answer}
                    maxLength={APPLICATION_LIMITS.answerMax}
                    readOnly={drafting}
                    onChange={(e) => patchRow(row.id, { answer: e.target.value, edited: true, drafted: null })}
                    placeholder={row.drafted?.cat === "demographics" ? "Yours to answer — we never guess these." : "Your answer…"}
                    className={cn(FIELD, "leading-relaxed")}
                  />
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StickerButton variant="primary" size="md" disabled={drafting || toDraft.length === 0} onClick={() => void draft()}>
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {drafting ? "Drafting…" : `Draft answers · up to ${AUTOFILL_CREDITS} credit`}
          </StickerButton>
          <StickerButton variant="outline" size="md" disabled={full} onClick={() => addRow()}>
            <Plus className="h-4 w-4" />
            Add a question
          </StickerButton>
          {answered.length > 0 && (
            <StickerButton variant="outline" size="md" onClick={() => void copyAnswers()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy answers"}
            </StickerButton>
          )}
        </div>
        {draftError && (
          <p className="mt-3 text-sm text-[#b23c26]" role="alert">
            {draftError.message}{" "}
            {draftError.credits && (
              <Link href={ATS_BILLING_HREF} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                Top up credits
              </Link>
            )}
          </p>
        )}
      </DashCard>

      {/* What goes with it */}
      <DashCard className="p-6">
        <p className="mb-4 text-sm font-bold text-primary">What this application carries</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Carried
            label="Resume"
            value={resumeId ? (resumeName ?? "Picked") : "None picked"}
            detail={atsScore !== null ? `ATS score ${atsScore}` : resumeId ? "Not scored" : "Pick one in step 2"}
            onEdit={() => onEditStep(2)}
          />
          <Carried
            label="Cover letter"
            value={letter ? `${letterWords} words` : "None"}
            detail={letter ? "As edited in step 3" : "Sending without one"}
            onEdit={() => onEditStep(3)}
          />
          <Carried label="Answers" value={`${answered.length} answered`} detail={answered.length > 0 ? "Recorded as sent" : "Optional"} />
        </div>
      </DashCard>

      {/* Apply, then track */}
      <div className="rounded-2xl bg-[#222325] p-6 text-white">
        {tracked ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-secondary text-primary">
              <Check className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">Tracked as applied</p>
              <p className="text-sm text-white/60">
                {job.company} is under Applied on your tracker, with the resume, letter and answers you sent. Follow-ups start from today.
              </p>
            </div>
            <div className="flex flex-none flex-wrap items-center gap-2.5">
              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer" className={cn(stickerButtonVariants({ variant: "outline", size: "md" }), "border-white/25 bg-transparent text-white hover:border-white")}>
                  Open the application
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
              <Link href="/dashboard/tracker">
                <StickerButton variant="secondary" size="md" shadowColor="#ffffff">
                  View in tracker
                  <ArrowRight className="h-4 w-4" />
                </StickerButton>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="mb-1 text-[15px] font-bold">Send it, then track it</p>
              <p className="text-sm leading-relaxed text-white/60">
                {link
                  ? `We don't submit applications for you. Open the form on ${hostOf(link)}, paste your letter and answers, and send it there — then track it here so your tracker and follow-ups know.`
                  : "There's no link on file for this job, so apply wherever you found it — then track it here so your tracker and follow-ups know."}
                {duplicate?.status === "saved" && " Tracking moves the saved card to Applied."}
              </p>
            </div>
            <div className="flex flex-none flex-wrap items-center gap-2.5">
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(stickerButtonVariants({ variant: "secondary", size: "md" }), "hover:shadow-[4px_4px_0_0_#ffffff]")}>
                  Open the application
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
              <StickerButton
                variant="outline"
                size="md"
                shadowColor="rgba(255,255,255,.3)"
                className="border-white/25 bg-transparent text-white hover:border-white"
                onClick={() => onTrack(answered)}>
                <Check className="h-4 w-4" />
                Track as applied
              </StickerButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RowBadge: FC<{ row: QuestionRow }> = ({ row }) => {
  if (!row.drafted || row.edited) return null;
  if (row.drafted.cat === "demographics") return <Pill variant="outline-dashed" className="flex-none">Yours to answer</Pill>;
  if (!row.answer.trim()) return <Pill variant="urgent" className="flex-none">Needs you</Pill>;
  if (row.drafted.confidence >= 1) return <Pill variant="positive" className="flex-none">From your answers</Pill>;
  if (row.drafted.confidence < CHECK_BELOW) return <Pill variant="urgent" className="flex-none">Check this</Pill>;
  return <Pill variant="neutral" className="flex-none">Drafted</Pill>;
};

const Carried: FC<{ label: string; value: string; detail: string; onEdit?: () => void }> = ({ label, value, detail, onEdit }) => (
  <div className="flex flex-col gap-1 rounded-xl border border-black/10 p-4">
    <p className="text-[11px] font-bold uppercase tracking-wide text-black/40">{label}</p>
    <p className="truncate text-sm font-semibold text-primary">{value}</p>
    <p className="text-[11px] text-black/45">{detail}</p>
    {onEdit && (
      <button type="button" onClick={onEdit} className="mt-1 w-fit cursor-pointer text-[11px] font-semibold text-black/50 underline decoration-dotted underline-offset-2 hover:text-primary">
        Change
      </button>
    )}
  </div>
);

export default SubmitStep;
