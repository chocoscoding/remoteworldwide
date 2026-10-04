"use client";

import type { FC } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LanguageStat, PrepSession } from "@/app/lib/dashboard/prep-data";
import { formatDuration, formatMeasureValue, formatSigned, numberAnswers } from "@/app/lib/voice/format";
import type { DeliveryReport } from "@/app/lib/voice/types";
import DeliveryFindings from "../delivery/DeliveryFindings";
import DeliveryTimeline from "../delivery/DeliveryTimeline";
import TimestampChip from "../delivery/TimestampChip";
import type { SessionQuestionRef } from "./answerNotes";
import DictionAnalysis, { DictionByKind } from "./DictionAnalysis";
import Disclosure from "./Disclosure";
import type { SectionsPoll } from "./SectionStates";

/**
 * The Delivery tab: how it was said. The measured numbers and what stood out,
 * the session over time, then the details a click away: grammar and word
 * choice (each answer beside a cleaner version), each answer's own figures,
 * and the habits counted from the words.
 *
 * A typed session recorded nothing, so it says so and keeps the notes on its
 * words; delivery is measured from a recording and never scored.
 */
export interface DeliveryTabProps {
  session: PrepSession;
  questions: readonly SessionQuestionRef[];
  /** The counted stats for "Word habits"; empty when the report can't stand behind them (a legacy too-short session). */
  languageStats: readonly LanguageStat[];
  /** The report transcript has no word timings, so pace and fillers could not be measured. */
  noWordTimings?: boolean;
  poll?: SectionsPoll;
  onOpenStat: (stat: LanguageStat) => void;
}

const NOTE_CARD = "rounded-[14px] border border-black/[0.16] bg-white px-4 py-3 text-sm leading-relaxed text-black/60";

const DeliveryTab: FC<DeliveryTabProps> = ({ session, questions, languageStats, noWordTimings = false, poll, onOpenStat }) => {
  const { delivery } = session;
  const typed = session.mode === "text";
  const dictionFindings = session.diction?.status === "ready" ? session.diction.findings.length : 0;
  const showHabits = languageStats.length > 0 || dictionFindings > 0;

  return (
    <>
      {typed ? (
        <p role="note" className={NOTE_CARD}>
          <span className="font-bold text-[#222325]">Typed session. </span>
          Nothing was recorded, so there&apos;s no pace, pausing or pitch to measure. The notes on your words are below.
        </p>
      ) : (
        <>
          {noWordTimings && (
            <p role="note" className={NOTE_CARD}>
              <span className="font-bold text-[#222325]">Word timings unavailable. </span>
              This report was built from what the interviewer heard, without a transcript, so pace and filler words couldn&apos;t be measured.
            </p>
          )}
          {delivery ? (
            <>
              <DeliveryFindings flags={delivery.flags} metrics={delivery.metrics} turns={session.transcript} noWordTimings={noWordTimings} />
              <DeliveryTimeline delivery={delivery} turns={session.transcript} />
            </>
          ) : (
            !noWordTimings && <p className={NOTE_CARD}>Delivery wasn&apos;t measured for this session.</p>
          )}
        </>
      )}

      <section aria-label="Details" className="overflow-hidden rounded-[14px] border border-black/[0.16] bg-white">
        <DictionAnalysis section={session.diction} turns={session.transcript} questions={questions} mode={session.mode} poll={poll} />
        {delivery && delivery.answers.length > 0 && (
          <Disclosure ruled title="Answer by answer" summary={answersSummary(delivery)}>
            <AnswersTable delivery={delivery} turns={session.transcript} />
          </Disclosure>
        )}
        {showHabits && (
          <Disclosure ruled title="Word habits" summary={habitsSummary(languageStats, dictionFindings)}>
            <div className="flex flex-col gap-4">
              {languageStats.length > 0 && (
                <ul className="flex flex-col">
                  {languageStats.map((stat) => (
                    <li key={stat.id}>
                      <button
                        type="button"
                        onClick={() => onOpenStat(stat)}
                        className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#f6f6f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
                        <span className="inline-flex items-center gap-1 text-[13px] text-black/65">
                          {stat.label}
                          <ChevronRight aria-hidden className="h-3.5 w-3.5 text-black/25 transition-colors group-hover:text-black/60" />
                        </span>
                        <span className={cn("text-right text-[13px] font-bold", stat.good ? "text-[#222325]" : "text-black/50")}>{stat.value}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <DictionByKind section={session.diction} typed={typed} />
            </div>
          </Disclosure>
        )}
      </section>
    </>
  );
};

export default DeliveryTab;

/** "2 answers · 1 min 4 s · 143 wpm": how many, how long between them, the average pace. */
function answersSummary(delivery: DeliveryReport): string {
  const n = delivery.answers.length;
  const total = delivery.answers.reduce((sum, a) => sum + Math.max(0, a.endMs - a.startMs), 0);
  const parts = [`${n} ${n === 1 ? "answer" : "answers"}`, formatDuration(total)];
  if (delivery.metrics.wpmMean !== null) parts.push(`${Math.round(delivery.metrics.wpmMean)} wpm`);
  return parts.join(" · ");
}

/** The first few counted stats in a line: "“I” vs “we” 3 to 0 · Longest answer 36 words". */
function habitsSummary(stats: readonly LanguageStat[], notes: number): string {
  const parts = stats.slice(0, 3).map((stat) => `${stat.label} ${stat.value}`);
  if (parts.length === 0 && notes > 0) parts.push(`${notes} ${notes === 1 ? "note" : "notes"} on your words`);
  return parts.join(" · ");
}

/** Each answer's own delivery figures: pace, length, pitch range, energy, lead-in and fillers. */
const AnswersTable: FC<{ delivery: DeliveryReport; turns: PrepSession["transcript"] }> = ({ delivery, turns }) => {
  const numbers = numberAnswers(turns);
  const answers = [...delivery.answers].sort((a, b) => a.startMs - b.startMs);
  const flagsByTurn = new Map<string, number>();
  for (const f of delivery.flags) flagsByTurn.set(f.turnId, (flagsByTurn.get(f.turnId) ?? 0) + 1);
  const first = answers.find((a) => a.energyDeltaDb !== null)?.energyDeltaDb ?? null;
  const dash = <span className="text-black/30">–</span>;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <caption className="sr-only">Delivery figures for each answer</caption>
          <thead>
            <tr className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-black/45">
              <th scope="col" className="py-2 pr-3 font-bold">Answer</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Pace</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Pitch range</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Energy</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Lead-in</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Fillers</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Findings</th>
              <th scope="col" className="py-2 font-bold">
                <span className="sr-only">Play</span>
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-[#222325]">
            {answers.map((a, i) => (
              <tr key={a.turnId} className="border-t border-black/[0.08]">
                <th scope="row" className="py-2 pr-3 font-bold">
                  {numbers.get(a.turnId) ?? i + 1} <span className="ml-1 font-normal text-black/50">· {formatDuration(a.endMs - a.startMs)}</span>
                </th>
                <td className="py-2 pr-3 text-right">{a.wpm === null ? dash : `${Math.round(a.wpm)} wpm`}</td>
                <td className="py-2 pr-3 text-right">{a.pitchRangeSt === null ? dash : formatMeasureValue(a.pitchRangeSt, "st")}</td>
                <td className="py-2 pr-3 text-right">{a.energyDeltaDb === null ? dash : `${formatSigned(a.energyDeltaDb - (first ?? 0))} dB`}</td>
                <td className="py-2 pr-3 text-right">{a.leadInMs === null ? dash : formatMeasureValue(a.leadInMs, "ms")}</td>
                <td className="py-2 pr-3 text-right">{delivery.metrics.fillersPer100Words === null ? dash : a.fillers}</td>
                <td className="py-2 pr-3 text-right">{flagsByTurn.get(a.turnId) ?? 0}</td>
                <td className="py-2 text-right">
                  <TimestampChip atMs={a.startMs} endMs={a.endMs} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-black/50">
        Energy is each answer&apos;s loudness against your first answer. Pitch range is how far your pitch moved within the answer. Lead-in is the time from the end
        of the question to your first word.
      </p>
    </>
  );
};
