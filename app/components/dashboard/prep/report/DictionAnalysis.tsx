"use client";

import { useId, type FC } from "react";
import type { TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import { DICTION_KINDS, type DictionFinding, type DictionKind, type DictionSection, type PrepSessionMode } from "@/app/lib/voice/types";
import { PANEL } from "../prep-styles";
import AnswerMeta, { useAnswerIndex, type AnswerIndex } from "./AnswerMeta";
import { SectionArrival, SectionNotAnalysed, SectionPending, SectionUnavailable, type SectionsPoll } from "./SectionStates";

/**
 * The Diction tab's grammar and word-choice notes: lines from the answers
 * that could land better, each quoted as said, with the same point said
 * better, why it matters, and a chip that plays it.
 *
 * "No notes" means two different things, and the section never lets one pass
 * for the other: too little was said to judge (`enoughEvidence: false`), or
 * enough was said and nothing stood out.
 */
export interface DictionAnalysisProps {
  /** Absent: the session was analysed before these notes existed. */
  section: DictionSection | undefined;
  turns: readonly TranscriptTurn[];
  /** A typed session's quotes are what was written, not said. */
  mode?: PrepSessionMode;
  poll?: SectionsPoll;
}

const TITLE = "Grammar and word choice";

/**
 * Each kind's heading and one plain sentence on what it covers. Filler words
 * here are the ones quoted inside a line, with the line cleaned up; the
 * measured filler moments further down the tab are named "Filler words", so
 * this one says where they landed instead.
 */
const KIND_META: Record<DictionKind, { label: string; what: string }> = {
  grammar: { label: "Grammar", what: "Sentences that don't hold together as said." },
  "word-choice": { label: "Word choice", what: "Words that weaken the point, or say less than you meant." },
  hedging: { label: "Hedging", what: "Softeners like “maybe”, “I think” and “sort of” that make a claim sound unsure." },
  repetition: { label: "Repetition", what: "The same word or phrase leaned on again and again." },
  fillers: { label: "Fillers inside the point", what: "Filler words landing in the line that carries your point." },
  concision: { label: "Concision", what: "Lines that take longer than the point needs." },
};

const DictionAnalysis: FC<DictionAnalysisProps> = ({ section, turns, mode, poll }) => {
  const index = useAnswerIndex(turns);
  return (
    <>
      <SectionArrival title={TITLE} status={section?.status} />
      {!section ? (
        <SectionNotAnalysed
          title={TITLE}
          body="Not analysed. This session was analysed before grammar and word-choice notes existed, so it has none. Every session you run from now on includes them."
        />
      ) : section.status === "pending" ? (
        <SectionPending title={TITLE} what="Reading your answers for grammar, word choice and hedging." poll={poll} />
      ) : section.status === "unavailable" ? (
        <SectionUnavailable title={TITLE} failure={section.failure} />
      ) : (
        <ReadyDiction section={section} index={index} typed={mode === "text"} />
      )}
    </>
  );
};

export default DictionAnalysis;

const words = (n: number) => `${n} ${n === 1 ? "word" : "words"}`;

const ReadyDiction: FC<{ section: DictionSection; index: AnswerIndex; typed: boolean }> = ({ section, index, typed }) => {
  const headingId = useId();
  const groups = DICTION_KINDS.map((kind) => ({ kind, items: section.findings.filter((f) => f.kind === kind) })).filter((g) => g.items.length > 0);

  return (
    <section aria-labelledby={headingId} className={PANEL}>
      <header className="px-5 pb-4 pt-5 sm:px-6">
        <h3 id={headingId} className="text-[14.5px] font-bold text-primary">
          {TITLE}
        </h3>
        <p className="mt-1 max-w-[600px] text-xs leading-relaxed text-black/50">
          Lines from your answers that could land better, each quoted as you {typed ? "wrote" : "said"} it beside a cleaner way to put it.
        </p>
        {/* The section's own figures: the words it read, and the report's
            Filler words stat as the service repeated it, not a recount. */}
        <p className="mt-2 text-xs text-black/55">
          Read {words(section.wordsRead)} of your answers
          {section.fillers && (
            <>
              {" "}
              · Filler words: <span className="font-semibold text-primary">{section.fillers.value}</span>
            </>
          )}
        </p>
      </header>

      <div className="border-t border-black/10">
        {!section.enoughEvidence && (
          <p className="border-b border-black/10 px-5 py-5 text-sm leading-relaxed text-black/60 last:border-b-0 sm:px-6">
            <span className="font-bold text-primary">Too little to judge. </span>
            {section.wordsRead === 0 ? "Your answers had no words to read" : `Your answers came to ${words(section.wordsRead)}`}, which isn&apos;t enough to judge how
            you phrase things, so no notes here doesn&apos;t mean nothing to fix. A session with a few full answers, a minute or so each, gives it enough to go on.
          </p>
        )}

        {groups.length === 0
          ? section.enoughEvidence && (
              <p className="px-5 py-5 text-sm leading-relaxed text-black/55 sm:px-6">
                Nothing stood out across the {words(section.wordsRead)} read: your phrasing held up.
              </p>
            )
          : groups.map(({ kind, items }) => <KindGroup key={kind} kind={kind} items={items} index={index} typed={typed} />)}
      </div>
    </section>
  );
};

const KindGroup: FC<{ kind: DictionKind; items: readonly DictionFinding[]; index: AnswerIndex; typed: boolean }> = ({ kind, items, index, typed }) => (
  <div className="border-b border-black/10 px-5 py-5 last:border-b-0 sm:px-6">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h4 className="text-sm font-bold text-primary">{KIND_META[kind].label}</h4>
      <span className="text-xs text-black/45">
        {items.length} {items.length === 1 ? "line" : "lines"}
      </span>
    </div>
    <p className="mt-1 text-xs leading-relaxed text-black/50">{KIND_META[kind].what}</p>

    <ul className="mt-3 flex flex-col gap-2.5">
      {items.map((finding) => (
        <li key={finding.id} className="rounded-xl border border-black/10 p-3.5">
          <AnswerMeta index={index} turnId={finding.turnId} question={finding.question} atMs={finding.atMs} endMs={finding.endMs} />
          {/* The quote and the rewrite side by side, told apart by more than
              colour: a label each, a hairline muted box against the ink
              border and offset shadow, italic against upright. The same pair
              the rewrites on Overall use. */}
          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-lg border border-black/8 bg-[#fbfbf7] p-3">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-black/45">{typed ? "You wrote" : "You said"}</p>
              <p className="text-sm italic leading-relaxed text-black/60">“{finding.quote}”</p>
            </div>
            <div className="rounded-lg border-2 border-[#222325] p-3 shadow-[3px_3px_0_0_#e1f073]">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-primary">Try instead</p>
              <p className="text-sm leading-relaxed text-primary">{finding.suggestion}</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-black/55">{finding.note}</p>
        </li>
      ))}
    </ul>
  </div>
);
