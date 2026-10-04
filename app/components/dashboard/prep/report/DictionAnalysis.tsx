"use client";

import { useMemo, type FC } from "react";
import { ArrowRight, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import { DICTION_KINDS, type DictionFinding, type DictionKind, type DictionSection, type PrepSessionMode } from "@/app/lib/voice/types";
import TimestampChip from "../delivery/TimestampChip";
import { reportAnswers, type ReportAnswer, type SessionQuestionRef } from "./answerNotes";
import ClippedQuote from "./ClippedQuote";
import Disclosure, { CountPill } from "./Disclosure";
import { listOf } from "./reportScales";
import { SECTION_FAILURE_TEXT, SectionArrival, type SectionsPoll } from "./SectionStates";

/**
 * The Delivery tab's "Grammar and word choice": each answer as said beside
 * the same answer said cleaner (`DictionSection.cleaner`: the same points and
 * facts, with fillers, repeats and grammar fixed and nothing added). A report
 * from before the cleaner versions existed has none, so its right-hand card
 * lists the line-by-line fixes instead ("Try instead").
 *
 * "No notes" means two different things, and the section never lets one pass
 * for the other: too little was said to judge (`enoughEvidence: false`), or
 * enough was said and nothing stood out.
 */
export interface DictionAnalysisProps {
  /** Absent: the session was analysed before these notes existed. */
  section: DictionSection | undefined;
  turns: readonly TranscriptTurn[];
  /** The session's questions, so each answer is named by the one it answered. */
  questions?: readonly SessionQuestionRef[];
  /** A typed session's quotes are what was written, not said. */
  mode?: PrepSessionMode;
  poll?: SectionsPoll;
  defaultOpen?: boolean;
  /** A hairline above the row, when it isn't its card's first. */
  ruled?: boolean;
}

const TITLE = "Grammar and word choice";

/** Each kind's heading and one plain sentence on what it covers. */
export const DICTION_KIND_META: Record<DictionKind, { label: string; what: string; inSentence: string }> = {
  grammar: { label: "Grammar", what: "Sentences that don't hold together as said.", inSentence: "grammar" },
  "word-choice": { label: "Word choice", what: "Words that weaken the point, or say less than you meant.", inSentence: "word choice" },
  hedging: { label: "Hedging", what: "Softeners like “maybe”, “I think” and “sort of” that make a claim sound unsure.", inSentence: "hedging" },
  repetition: { label: "Repetition", what: "The same word or phrase leaned on again and again.", inSentence: "repeated words" },
  fillers: { label: "Fillers inside the point", what: "Filler words landing in the line that carries your point.", inSentence: "filler words" },
  concision: { label: "Concision", what: "Lines that take longer than the point needs.", inSentence: "wordiness" },
};

const words = (n: number) => `${n} ${n === 1 ? "word" : "words"}`;

interface Pair {
  answer: ReportAnswer;
  findings: DictionFinding[];
  cleaner: string | null;
}

/** The answers with something to show: a cleaner version, or notes on their words. */
function pairsOf(section: DictionSection, turns: readonly TranscriptTurn[], questions: readonly SessionQuestionRef[]): Pair[] {
  const cleaner = new Map((section.cleaner ?? []).filter((c) => c.text.trim() !== "").map((c) => [c.turnId, c.text.trim()]));
  return reportAnswers(turns, questions)
    .map((answer) => ({ answer, findings: section.findings.filter((f) => f.turnId === answer.turnId), cleaner: cleaner.get(answer.turnId) ?? null }))
    .filter((pair) => pair.cleaner !== null || pair.findings.length > 0);
}

/** One line on what the notes on an answer are about: "Notes on grammar, repeated words and filler words." */
function notesLine(findings: readonly DictionFinding[]): string | null {
  const kinds = DICTION_KINDS.filter((kind) => findings.some((f) => f.kind === kind)).map((kind) => DICTION_KIND_META[kind].inSentence);
  return kinds.length > 0 ? `Notes on ${listOf(kinds)}.` : null;
}

const NO_QUESTIONS: readonly SessionQuestionRef[] = [];

const DictionAnalysis: FC<DictionAnalysisProps> = ({ section, turns, questions = NO_QUESTIONS, mode, poll, defaultOpen = true, ruled = false }) => {
  const pairs = useMemo(() => (section?.status === "ready" ? pairsOf(section, turns, questions) : []), [section, turns, questions]);
  const typed = mode === "text";
  const ready = section?.status === "ready";
  return (
    <>
      <SectionArrival title={TITLE} status={section?.status} />
      <Disclosure
        title={TITLE}
        defaultOpen={defaultOpen}
        ruled={ruled}
        tintOpen
        summary={!section ? "Not analysed" : section.status === "pending" ? "Analysing…" : section.status === "unavailable" ? "Not available" : null}
        badge={ready && pairs.length > 0 ? <CountPill>{`${pairs.length} ${pairs.length === 1 ? "line" : "lines"}`}</CountPill> : undefined}>
        {!section ? (
          <p className={NOTE}>
            Not analysed. This session was analysed before grammar and word-choice notes existed, so it has none. Every session you run from now on includes them.
          </p>
        ) : section.status === "pending" ? (
          poll?.stalled ? (
            <div>
              <p className={NOTE}>Still analysing. This is taking much longer than it should, so the page has stopped checking on its own.</p>
              <button
                type="button"
                onClick={poll.onCheckAgain}
                className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-bold text-[#222325] hover:border-[#222325]">
                <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                Check again
              </button>
            </div>
          ) : (
            <p className={cn(NOTE, "flex items-start gap-2")}>
              <Loader2 aria-hidden className="mt-[3px] h-3.5 w-3.5 flex-none text-black/40 motion-safe:animate-spin" />
              <span>Analysing… Reading your answers for grammar, word choice and hedging. It appears here by itself when it&apos;s done.</span>
            </p>
          )
        ) : section.status === "unavailable" ? (
          <p className={NOTE}>
            Not available for this session. {SECTION_FAILURE_TEXT[section.failure ?? "model-unavailable"]} The rest of your report is unaffected.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {!section.enoughEvidence && (
              <p className={NOTE}>
                <span className="font-bold text-[#222325]">Too little to judge. </span>
                {section.wordsRead === 0 ? "Your answers had no words to read" : `Your answers came to ${words(section.wordsRead)}`}, which isn&apos;t enough to judge how you
                phrase things, so no notes here doesn&apos;t mean nothing to fix. A session with a few full answers, a minute or so each, gives it enough to go on.
              </p>
            )}
            {pairs.length === 0
              ? section.enoughEvidence && <p className={NOTE}>Nothing stood out across the {words(section.wordsRead)} read: your phrasing held up.</p>
              : pairs.map((pair) => <PairRow key={pair.answer.turnId} pair={pair} typed={typed} many={pairs.length > 1} />)}
          </div>
        )}
      </Disclosure>
    </>
  );
};

export default DictionAnalysis;

const NOTE = "text-sm leading-relaxed text-black/60";
const CARD_LABEL = "text-[11px] font-extrabold uppercase tracking-[0.08em]";

const PairRow: FC<{ pair: Pair; typed: boolean; many: boolean }> = ({ pair, typed, many }) => {
  const { answer, findings, cleaner } = pair;
  const note = notesLine(findings);
  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-black/20 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(CARD_LABEL, "text-[#5f6062]")}>
            {typed ? "You wrote" : "You said"}
            {many && <span className="normal-case tracking-normal"> · Answer {answer.index}</span>}
          </span>
          {answer.startMs !== undefined && <TimestampChip atMs={answer.startMs} endMs={answer.endMs} />}
        </div>
        <ClippedQuote text={answer.text} className="text-[13px] text-[#44453f]" />
        {note && <p className="text-xs leading-relaxed text-[#5f6062]">{note}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-[#222325] bg-[#f4f9c9] px-3 py-2.5 text-[#222325]">
        {cleaner !== null ? (
          <>
            <span className={CARD_LABEL}>Cleaner</span>
            <p className="text-[13px] font-semibold leading-relaxed">{cleaner}</p>
          </>
        ) : (
          <>
            <span className={CARD_LABEL}>Try instead</span>
            <ul className="flex flex-col gap-2">
              {findings.map((f) => (
                <li key={f.id} className="text-[13px] leading-relaxed">
                  <span className="italic text-black/55">“{f.quote}”</span>
                  <ArrowRight aria-hidden className="mx-1 inline h-3.5 w-3.5 align-[-2px] text-black/45" />
                  <span className="sr-only">could be </span>
                  <span className="font-semibold">{f.suggestion}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Every note on the words, grouped by kind, for "Word habits": what each kind
 * covers, then each line as said beside the same point said better, and why.
 * Nothing when the section has no notes to show.
 */
export const DictionByKind: FC<{ section: DictionSection | undefined; typed?: boolean }> = ({ section, typed = false }) => {
  if (section?.status !== "ready" || section.findings.length === 0) return null;
  const groups = DICTION_KINDS.map((kind) => ({ kind, items: section.findings.filter((f) => f.kind === kind) })).filter((g) => g.items.length > 0);
  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ kind, items }) => (
        <section key={kind} aria-label={DICTION_KIND_META[kind].label}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-[13px] font-extrabold text-[#222325]">{DICTION_KIND_META[kind].label}</h3>
            <span className="text-xs text-[#5f6062]">
              {items.length} {items.length === 1 ? "line" : "lines"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[#5f6062]">{DICTION_KIND_META[kind].what}</p>
          <ul className="mt-1.5 flex flex-col divide-y divide-black/[0.08] rounded-[10px] border border-black/[0.12] bg-white">
            {items.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-3 py-2">
                <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
                  <p>
                    <span className="sr-only">{typed ? "You wrote: " : "You said: "}</span>
                    <span className="italic text-black/55">“{f.quote}”</span>
                    <ArrowRight aria-hidden className="mx-1 inline h-3.5 w-3.5 align-[-2px] text-black/45" />
                  <span className="sr-only">could be </span>
                    <span className="font-semibold text-[#222325]">{f.suggestion}</span>
                  </p>
                  {f.note && <p className="text-xs text-[#5f6062]">{f.note}</p>}
                </div>
                {f.atMs !== undefined && <TimestampChip atMs={f.atMs} endMs={f.endMs} />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
