"use client";

// Step 5 — the form's questions, and tracking it as applied.
//
// Nothing here submits anything to an employer. There is no integration that
// could, so the step says so plainly: open the real application in a new tab,
// paste what was prepared, send it there, then "Track as applied" records it —
// the resume, the letter and these answers included — so the tracker, the
// follow-ups and the coach know it went out.
//
// The questions come from the form itself (owner mockup, 2026-10-04): the
// person selects everything on the employer's application page, copies it and
// pastes it here, and `POST /api/ai/autofill/questions` reads the questions off
// it, free, leaving out the fields their profile covers (name, email, links,
// uploads) and the self-ID ones. "Type the questions in myself" is the way
// round it. Three views of one list:
//   1. Paste the whole application form (no questions yet, or "Paste again");
//   2. the questions found: fix or remove any, add one, answer one or all;
//   3. the answers: read, edit, write again, copy one or all.
// Answers come from `POST /api/ai/autofill`: a question answered before comes
// back verbatim from the saved-answer library for free, demographic questions
// are left for the person, and the rest are drafted for AUTOFILL_CREDITS a
// batch of up to AUTOFILL_MAX_QUESTIONS. An answer they have typed is never
// overwritten, except by "Write this answer again", which they press.
//
// The questions and answers live in the application's session, so a refresh
// keeps every one of them.

import { useRef, useState, type FC } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronUp, Copy, Loader2, RotateCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import KeyCombo from "@/app/components/dashboard/ui/KeyCombo";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { APPLICATION_LIMITS, type ApplicationAnswer, type ApplicationItem } from "@/app/lib/applications/types";
import { ATS_BILLING_HREF } from "@/app/lib/ats/api";
import {
  AUTOFILL_CREDITS,
  AUTOFILL_MAX_QUESTIONS,
  AUTOFILL_QUESTION_MAX,
  FORM_QUESTIONS_MAX,
  FORM_TEXT_MAX,
  draftAnswers,
  findFormQuestions,
  type FormLeftOut,
} from "@/app/lib/autofill/api";
import { qk } from "@/app/lib/query/keys";
import type { ApplyQuestion } from "@/app/lib/apply/state";
import { applyLinkOf, hostOf, type StartedJob } from "../job";

export interface SubmitStepProps {
  job: StartedJob;
  resumeId: string | null;
  resumeName: string | null;
  atsScore: number | null;
  /** The letter as it will be recorded; null when none goes with it. */
  letter: string | null;
  duplicate: ApplicationItem | null | undefined;
  /** `duplicate` is this same posting, already sent this week: tracking makes no second card. */
  alreadyTracked?: boolean;
  tracked: boolean;
  onTrack: (answers: ApplicationAnswer[]) => void;
  onEditStep: (step: 2 | 3) => void;
  /** The form's questions as the session keeps them. */
  questions: ApplyQuestion[];
  /** Functional, so a draft that lands after a wait fills the rows as they are then. */
  onQuestionsChange: (recipe: (rows: ApplyQuestion[]) => ApplyQuestion[]) => void;
}

type QuestionRow = ApplyQuestion;

/** The next free row number, past every id the session already holds ("q-3" → 4). */
const nextRowNumber = (rows: readonly QuestionRow[]): number =>
  rows.reduce((max, row) => Math.max(max, Number(row.id.replace(/^q-/, "")) || 0), 0) + 1;

/** How the drafter's echo is matched back to a row: it collapses whitespace, and case never mattered. */
const norm = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/** Below this a drafted answer is flagged for a second look. */
const CHECK_BELOW = 0.6;

/** As many questions as the form reader returns: "Answer all" drafts them in batches. */
const MAX_ROWS = FORM_QUESTIONS_MAX;

/** What a drafted answer costs, said on the buttons that spend it. */
const COST_HINT = `Saved answers are free. The rest are drafted from your profile and resume, ${AUTOFILL_CREDITS} credit for up to ${AUTOFILL_MAX_QUESTIONS}.`;

const LEFT_OUT_WORDS: Record<FormLeftOut, string> = {
  name: "name",
  email: "email",
  phone: "phone",
  links: "links",
  uploads: "upload",
  address: "address",
  "self-ID": "self-ID",
};

/** "Name, email, links and upload fields were left out." */
const leftOutLine = (kinds: readonly FormLeftOut[]): string | null => {
  if (kinds.length === 0) return null;
  const words = kinds.map((kind) => LEFT_OUT_WORDS[kind]);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${words.length === 1 ? "field was" : "fields were"} left out.`;
};

type Tag = { label: string; tone: "lime" | "dashed" } | null;

/** What a drafted answer says about itself, until the person edits it. */
const tagOf = (row: QuestionRow): Tag => {
  if (!row.drafted || row.edited) return null;
  if (row.drafted.cat === "demographics") return { label: "Yours to answer", tone: "dashed" };
  if (!row.answer.trim()) return { label: "Needs you", tone: "dashed" };
  if (row.drafted.confidence >= 1) return { label: "Your saved answer", tone: "lime" };
  if (row.drafted.confidence < CHECK_BELOW) return { label: "Check this one", tone: "dashed" };
  return null;
};

/** The featured action of each view: small and lime, with the hard shadow at rest. */
const FEATURED =
  "br-shadow-press inline-flex h-8 flex-none items-center gap-1.5 rounded-lg bg-[#e1f073] px-3 text-xs font-bold text-primary disabled:pointer-events-none disabled:border-black/15 disabled:bg-[#f0f0ea] disabled:text-black/40 disabled:shadow-none";

const TEXT_LINK =
  "flex-none cursor-pointer text-xs font-semibold text-black/55 underline decoration-1 underline-offset-2 hover:text-primary disabled:cursor-default disabled:opacity-50";

const ROW_RULE = "border-t border-black/[0.08]";

const ICON_BUTTON =
  "grid h-7 w-7 flex-none cursor-pointer place-content-center rounded-md text-black/55 transition-colors hover:bg-black/[0.05] hover:text-primary disabled:cursor-default disabled:opacity-40";

const SubmitStep: FC<SubmitStepProps> = ({
  job,
  resumeId,
  resumeName,
  atsScore,
  letter,
  duplicate,
  alreadyTracked = false,
  tracked,
  onTrack,
  onEditStep,
  questions,
  onQuestionsChange,
}) => {
  const queryClient = useQueryClient();
  const nextId = useRef(nextRowNumber(questions));
  const rows = questions;
  const setRows = onQuestionsChange;
  const hasQuestions = rows.some((row) => row.question.trim());

  // The paste view: shown until the form has questions, and again on "Paste again".
  const [pasting, setPasting] = useState(!hasQuestions);
  const [pasted, setPasted] = useState("");
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  /** The list came from a pasted form (it says "We found…"), and what that form's reading left out. */
  const [found, setFound] = useState(false);
  const [leftOut, setLeftOut] = useState<FormLeftOut[]>([]);

  const [answering, setAnswering] = useState<ReadonlySet<string>>(() => new Set());
  const [draftError, setDraftError] = useState<{ message: string; credits: boolean } | null>(null);
  /** Rows opened to type an answer by hand, before anything is typed. */
  const [writing, setWriting] = useState<ReadonlySet<string>>(() => new Set());
  /** The open answer; undefined until the person picks one, when the first answer is open. */
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const link = applyLinkOf(job);
  const asked = rows.filter((row) => row.question.trim());
  const answered: ApplicationAnswer[] = rows
    .filter((row) => row.question.trim() && row.answer.trim())
    .slice(0, APPLICATION_LIMITS.answersMax)
    .map((row) => ({
      question: row.question.trim().slice(0, APPLICATION_LIMITS.questionMax),
      answer: row.answer.trim().slice(0, APPLICATION_LIMITS.answerMax),
    }));
  const busy = answering.size > 0;
  // An answer row: answered, being written by hand, or drafted blank (the drafter had nothing to go on).
  const isAnswerRow = (row: QuestionRow) => Boolean(row.answer.trim()) || writing.has(row.id) || (row.drafted !== null && !answering.has(row.id));
  // What "Answer all" sends: asked, unanswered and never drafted. A blank draft isn't sent again for another credit.
  const toDraft = asked.filter((row) => !row.answer.trim() && row.drafted === null && !writing.has(row.id) && !answering.has(row.id));
  const firstAnswered = rows.find((row) => row.question.trim() && row.answer.trim())?.id ?? null;
  const shownOpen = openId === undefined ? firstAnswered : openId;
  const full = rows.length >= MAX_ROWS;

  function patchRow(id: string, patch: Partial<QuestionRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const blank = rows.find((row) => !row.question.trim() && !row.answer.trim());
    if (blank) {
      setFocusId(blank.id);
      return;
    }
    if (full) return;
    const id = `q-${nextId.current++}`;
    setRows((prev) => [...prev, { id, question: "", answer: "", drafted: null, edited: false }]);
    setFocusId(id);
  }

  function removeRow(id: string) {
    const left = rows.filter((row) => row.id !== id);
    // Nothing left to answer: back to pasting the form, with an empty row for typing.
    if (!left.some((row) => row.question.trim())) {
      setRows(() => [{ id: `q-${nextId.current++}`, question: "", answer: "", drafted: null, edited: false }]);
      setPasting(true);
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  async function findQuestions() {
    const text = pasted.trim();
    if (!text || finding) return;
    setFinding(true);
    setFindError(null);
    try {
      const result = await findFormQuestions(text);
      if (result.questions.length === 0) {
        setFindError("We couldn't find any questions in that. Check you copied the form itself, or type them in yourself.");
        return;
      }
      // A question already on the list keeps its answer; the new paste is the form, so the rest go.
      const had = new Map(rows.filter((row) => row.question.trim()).map((row) => [norm(row.question), row]));
      setRows(() =>
        result.questions.slice(0, MAX_ROWS).map(({ question, answeredBefore }) => {
          const kept = had.get(norm(question));
          return kept
            ? { ...kept, question, answeredBefore }
            : { id: `q-${nextId.current++}`, question, answer: "", drafted: null, edited: false, answeredBefore };
        }),
      );
      setLeftOut(result.leftOut);
      setFound(true);
      setPasting(false);
      setPasted("");
      setOpenId(undefined);
      setWriting(new Set());
    } catch (error) {
      setFindError(apiMessage(error));
    } finally {
      setFinding(false);
    }
  }

  function typeThemIn() {
    setPasting(false);
    setFound(false);
    setLeftOut([]);
    setFindError(null);
    addRow();
  }

  /** Drafts answers for these rows, in batches the drafter takes in one go. One run at a time. */
  async function draft(targets: QuestionRow[], open?: string) {
    const sent = targets.filter((row) => row.question.trim());
    if (sent.length === 0 || busy) return;
    setAnswering(new Set(sent.map((row) => row.id)));
    setDraftError(null);
    try {
      for (let start = 0; start < sent.length; start += AUTOFILL_MAX_QUESTIONS) {
        const batch = sent.slice(start, start + AUTOFILL_MAX_QUESTIONS);
        // No application id: the application does not exist until it is tracked,
        // and autofill files its use log under whatever id it is given. The real
        // id is logged once "Track as applied" has created the row.
        const answers = await draftAnswers({
          questions: batch.map((row) => row.question),
          resumeId,
          job: { company: job.company, role: job.role },
        });
        const byQuestion = new Map(answers.map((answer) => [norm(answer.question), answer]));
        const ids = new Set(batch.map((row) => row.id));
        setRows((prev) =>
          prev.map((row) => {
            // Answered since the draft was asked for: that answer stands.
            if (!ids.has(row.id) || row.answer.trim()) return row;
            const answer = byQuestion.get(norm(row.question));
            if (!answer) return row;
            return { ...row, answer: answer.answer, drafted: { confidence: answer.confidence, cat: answer.cat }, edited: false };
          }),
        );
        setAnswering((prev) => new Set([...prev].filter((id) => !ids.has(id))));
      }
      if (open) setOpenId(open);
    } catch (error) {
      setDraftError({ message: apiMessage(error), credits: error instanceof BackendError && error.status === 402 });
    } finally {
      setAnswering(new Set());
      // Charged or not, the balance in the header may be behind now. And every
      // fresh draft is filed into the saved-answer library, so the Questions
      // screen's list is too.
      void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
      void queryClient.invalidateQueries({ queryKey: qk.answers.list() });
    }
  }

  /** "Write this answer again": the person asked, so what's there goes, and a fresh draft takes its place. */
  function writeAgain(row: QuestionRow) {
    if (busy) return;
    patchRow(row.id, { answer: "", drafted: null, edited: false });
    void draft([{ ...row, answer: "" }], row.id);
  }

  function writeIt(id: string) {
    setWriting((prev) => new Set(prev).add(id));
    setOpenId(id);
    setFocusId(id);
  }

  function collapse(row: QuestionRow) {
    setOpenId(null);
    // Opened to write and left empty: back to a question to answer.
    if (!row.answer.trim()) setWriting((prev) => new Set([...prev].filter((id) => id !== row.id)));
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((now) => (now === key ? null : now)), 2000);
    } catch {
      // Refused clipboard access: the answers are still on screen to select.
    }
  }

  const letterWords = letter ? letter.trim().split(/\s+/).length : 0;
  const left = leftOutLine(leftOut);
  const title =
    answered.length > 0
      ? `${answered.length} of ${asked.length} answered`
      : found
        ? `We found ${asked.length} question${asked.length === 1 ? "" : "s"}`
        : asked.length > 0
          ? `${asked.length} question${asked.length === 1 ? "" : "s"} from the form`
          : "Add the form's questions";

  return (
    <div className="flex flex-col gap-5">
      {pasting ? (
        <section aria-label="Paste the application form" className="br-plain flex flex-col gap-3 rounded-2xl bg-white p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[15px] font-bold text-primary">Paste the application form</h2>
            <p className="flex flex-wrap items-center gap-1 text-xs text-black/55">
              On the form, press <KeyCombo keys={["mod", "A"]} /> then <KeyCombo keys={["mod", "C"]} />, and paste it here. We&apos;ll pick out the questions.
            </p>
          </div>

          <textarea
            aria-label="Pasted application form"
            rows={4}
            value={pasted}
            maxLength={FORM_TEXT_MAX}
            readOnly={finding}
            onChange={(e) => {
              setPasted(e.target.value);
              setFindError(null);
            }}
            placeholder="Paste the whole form here"
            className="resize-y rounded-xl border border-dashed border-black/25 bg-[#fbfbf7] px-3.5 py-3 text-sm leading-relaxed text-primary outline-none placeholder:text-black/35 focus:border-solid focus:border-[#222325]"
          />

          {findError && (
            <p role="alert" className="text-xs text-[#b23c26]">
              {findError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={FEATURED} disabled={!pasted.trim() || finding} onClick={() => void findQuestions()}>
              {finding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {finding ? "Finding questions" : "Find questions"}
            </button>
            <button type="button" className={TEXT_LINK} disabled={finding} onClick={typeThemIn}>
              Type them in instead
            </button>
            {hasQuestions && (
              <button type="button" className={TEXT_LINK} disabled={finding} onClick={() => setPasting(false)}>
                Back to your questions
              </button>
            )}
            <span className="flex-1" />
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-black/55 hover:text-primary">
                Open the form
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </section>
      ) : (
        <section aria-label={answered.length > 0 ? "Your answers" : "Questions found"} className="overflow-hidden rounded-2xl border border-[#222325] bg-white">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
            <div className="flex min-w-0 flex-[999_1_300px] flex-col">
              <h2 className="text-[15px] font-bold text-primary">{title}</h2>
              <span className="text-xs text-black/50">
                {answered.length > 0 ? "Edit any answer, then copy it into the form." : "Fix or remove any that look wrong, then answer them."}
              </span>
            </div>
            <button
              type="button"
              className={TEXT_LINK}
              disabled={busy}
              onClick={() => {
                setPasting(true);
                setFindError(null);
              }}>
              Paste again
            </button>
            {toDraft.length > 0 || busy ? (
              <button type="button" className={FEATURED} disabled={busy} title={COST_HINT} onClick={() => void draft(toDraft)}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {busy ? "Answering" : answered.length > 0 ? `Answer ${toDraft.length} more` : "Answer all"}
              </button>
            ) : (
              answered.length > 0 && (
                <button
                  type="button"
                  className={FEATURED}
                  onClick={() => void copy(answered.map((row) => `${row.question}\n${row.answer}`).join("\n\n"), "all")}>
                  {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "all" ? "Copied" : "Copy all"}
                </button>
              )
            )}
          </div>

          {draftError && (
            <p role="alert" className={cn(ROW_RULE, "px-5 py-2.5 text-xs text-[#b23c26]")}>
              {draftError.message}{" "}
              {draftError.credits && (
                <Link href={ATS_BILLING_HREF} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                  Top up credits
                </Link>
              )}
            </p>
          )}

          {rows.map((row, index) =>
            isAnswerRow(row) ? (
              <AnswerRow
                key={row.id}
                row={row}
                number={index + 1}
                open={shownOpen === row.id || !row.answer.trim()}
                focus={focusId === row.id}
                busy={busy}
                copied={copied === row.id}
                onOpen={() => setOpenId(row.id)}
                onCollapse={() => collapse(row)}
                onChange={(answer) => patchRow(row.id, { answer, edited: true, drafted: null })}
                onWriteAgain={() => writeAgain(row)}
                onCopy={() => void copy(row.answer, row.id)}
              />
            ) : (
              <FoundRow
                key={row.id}
                row={row}
                number={index + 1}
                focus={focusId === row.id}
                answering={answering.has(row.id)}
                busy={busy}
                onChange={(question) => patchRow(row.id, { question, answeredBefore: false })}
                onAnswer={() => void draft([row], row.id)}
                onWrite={() => writeIt(row.id)}
                onRemove={() => removeRow(row.id)}
              />
            ),
          )}

          <div className={cn(ROW_RULE, "flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5")}>
            <button type="button" className={TEXT_LINK} disabled={full && !rows.some((row) => !row.question.trim())} onClick={addRow}>
              + Add a question
            </button>
            <span className="flex-1" />
            {left && <span className="text-[11px] text-black/40">{left}</span>}
          </div>
        </section>
      )}

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
              <p className="text-[15px] font-bold">{alreadyTracked ? "Already on your tracker" : "Tracked as applied"}</p>
              <p className="text-sm text-white/60">
                {alreadyTracked
                  ? `${job.company} was logged when you sent it, so nothing was added twice. Follow-ups run from that day.`
                  : `${job.company} is under Applied on your tracker, with the resume, letter and answers you sent. Follow-ups start from today.`}
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
                  ? `We don't submit applications for you. Open the form on ${hostOf(link)}, paste your letter and answers, and send it there, then track it here so your tracker and follow-ups know.`
                  : "There's no link on file for this job, so apply wherever you found it, then track it here so your tracker and follow-ups know."}
                {duplicate?.status === "saved" && " Tracking moves the saved card to Applied."}
                {alreadyTracked && " It's already logged as sent this week, so tracking won't add a second card."}
              </p>
            </div>
            <div className="flex flex-none flex-wrap items-center gap-2.5">
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(stickerButtonVariants({ variant: "secondary", size: "md" }), "br-white")}>
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

/** A row's number, in the margin. */
const RowNumber: FC<{ n: number }> = ({ n }) => <span className="w-5 flex-none text-xs text-black/35">{n}</span>;

const TagPill: FC<{ tag: NonNullable<Tag> }> = ({ tag }) => (
  <span
    className={cn(
      "flex-none rounded-full px-2 py-px text-[11px] font-medium text-primary",
      tag.tone === "lime" ? "bg-[#e1f073]" : "border border-dashed border-black/30",
    )}>
    {tag.label}
  </span>
);

/** A question not answered yet: its wording to fix, and answer it with AI, write it, or remove it. */
const FoundRow: FC<{
  row: QuestionRow;
  number: number;
  focus: boolean;
  answering: boolean;
  busy: boolean;
  onChange: (question: string) => void;
  onAnswer: () => void;
  onWrite: () => void;
  onRemove: () => void;
}> = ({ row, number, focus, answering, busy, onChange, onAnswer, onWrite, onRemove }) => (
  <div className={cn(ROW_RULE, "flex min-h-[46px] items-center gap-3 py-1 pl-5 pr-3")} aria-busy={answering}>
    <RowNumber n={number} />
    <input
      type="text"
      aria-label={`Question ${number}`}
      value={row.question}
      maxLength={AUTOFILL_QUESTION_MAX}
      autoFocus={focus}
      readOnly={answering}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type a question from the form"
      className="h-8 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-primary outline-none placeholder:font-normal placeholder:text-black/35"
    />
    {row.answeredBefore && <TagPill tag={{ label: "Answered before", tone: "lime" }} />}
    {answering ? (
      <span className="flex flex-none items-center gap-1.5 px-1 text-xs text-black/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Answering
      </span>
    ) : (
      <>
        <button
          type="button"
          disabled={busy || !row.question.trim()}
          onClick={onWrite}
          className="flex-none cursor-pointer text-xs text-black/50 underline-offset-2 hover:text-primary hover:underline disabled:cursor-default disabled:opacity-40">
          Write it
        </button>
        <button
          type="button"
          title={COST_HINT}
          disabled={busy || !row.question.trim()}
          onClick={onAnswer}
          className="h-7 flex-none cursor-pointer rounded-md border border-black/20 bg-white px-2.5 text-xs font-medium text-primary transition-colors hover:border-[#222325] hover:bg-[#e1f073] disabled:cursor-default disabled:opacity-40 disabled:hover:border-black/20 disabled:hover:bg-white">
          Answer
        </button>
      </>
    )}
    <button
      type="button"
      aria-label={`Remove question ${number}`}
      disabled={answering}
      onClick={onRemove}
      className={cn(ICON_BUTTON, "text-black/40 hover:bg-[#b23c26]/[0.08] hover:text-[#b23c26]")}>
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
);

/** A question with an answer (or one to write): open to read and edit, or a line with the answer's start. */
const AnswerRow: FC<{
  row: QuestionRow;
  number: number;
  open: boolean;
  focus: boolean;
  busy: boolean;
  copied: boolean;
  onOpen: () => void;
  onCollapse: () => void;
  onChange: (answer: string) => void;
  onWriteAgain: () => void;
  onCopy: () => void;
}> = ({ row, number, open, focus, busy, copied, onOpen, onCollapse, onChange, onWriteAgain, onCopy }) => {
  const tag = tagOf(row);
  const blank = !row.answer.trim();
  // A saved answer comes back as it is, and a self-ID one is never drafted: writing either again changes nothing.
  const rewritable = !blank && row.drafted?.cat !== "demographics" && !(row.drafted && !row.edited && row.drafted.confidence >= 1);

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={onOpen}
        className={cn(ROW_RULE, "flex min-h-[46px] w-full cursor-pointer items-center gap-3 px-5 py-1.5 text-left text-primary transition-colors hover:bg-black/[0.02]")}>
        <RowNumber n={number} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">{row.question}</span>
          <span className="truncate text-xs text-black/45">{row.answer}</span>
        </span>
        {tag && <TagPill tag={tag} />}
        <ChevronDown className="h-3.5 w-3.5 flex-none" />
      </button>
    );
  }

  return (
    <div className={cn(ROW_RULE, "flex flex-col gap-2 bg-[#fbfbf7] px-5 py-3")}>
      <div className="flex items-center gap-3">
        <RowNumber n={number} />
        <span className="min-w-0 flex-1 text-sm font-semibold text-primary">{row.question}</span>
        {tag && <TagPill tag={tag} />}
        {rewritable && (
          <button
            type="button"
            aria-label="Write this answer again"
            title={`Write this answer again. ${COST_HINT}`}
            disabled={busy}
            onClick={onWriteAgain}
            className={ICON_BUTTON}>
            <RotateCw className="h-[15px] w-[15px]" />
          </button>
        )}
        <button type="button" aria-label={`Copy answer ${number}`} disabled={blank} onClick={onCopy} className={ICON_BUTTON}>
          {copied ? <Check className="h-[15px] w-[15px]" /> : <Copy className="h-[15px] w-[15px]" />}
        </button>
        {!blank && (
          <button type="button" aria-label="Collapse" aria-expanded onClick={onCollapse} className={ICON_BUTTON}>
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        )}
        {blank && row.drafted === null && (
          <button type="button" aria-label="Close" onClick={onCollapse} className={cn(ICON_BUTTON, "hover:bg-[#b23c26]/[0.08] hover:text-[#b23c26]")}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <AutoGrowTextarea
        aria-label={`Answer ${number}`}
        minRows={3}
        value={row.answer}
        maxLength={APPLICATION_LIMITS.answerMax}
        autoFocus={focus && blank}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          row.drafted?.cat === "demographics"
            ? "Yours to answer. We never guess these."
            : row.drafted
              ? "There wasn't enough on your profile or resume to answer this one. Write it yourself."
              : "Your answer"
        }
        className="ml-8 w-[calc(100%-2rem)] rounded-lg border border-black/15 bg-white px-3 py-2 text-sm leading-relaxed text-primary outline-none placeholder:text-black/35 focus:border-[#222325]"
      />
    </div>
  );
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
