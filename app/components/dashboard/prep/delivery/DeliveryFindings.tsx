"use client";

import { useId, type FC, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FLAG_KIND_META, SEVERITY_LABELS, formatMeasure, formatSigned, numberAnswers, type DeliveryTurn } from "@/app/lib/voice/format";
import { DELIVERY_FLAG_KINDS, type DeliveryFlag, type DeliveryMetrics } from "@/app/lib/voice/types";
import { deliveryHeadline, energyWord, paceVerdict } from "../report/reportScales";
import TimestampChip from "./TimestampChip";

/**
 * "How you delivered it": the session's measured numbers in one row, and
 * under them the moments that stood out against the user's own averages,
 * strongest kind first, each with its measure ("Pace 182 wpm vs your 150
 * average"), one line of coaching and a chip that plays it. Filler words are
 * among them: the Delivery tab is the one place they are listed.
 *
 * What each number means is one click away ("What these mean"), so a figure
 * never stands alone. Everything here is measured pace, pauses, fillers,
 * pitch movement and loudness. Nothing describes the speaker, only how they
 * used their voice in this session.
 */
export interface DeliveryFindingsProps {
  flags: readonly DeliveryFlag[];
  metrics: DeliveryMetrics;
  /** Names the answer each finding sits in ("Answer 3"). */
  turns?: readonly DeliveryTurn[];
  /** The report transcript has no word timings, so pace and fillers could not be measured. */
  noWordTimings?: boolean;
  className?: string;
}

const DeliveryFindings: FC<DeliveryFindingsProps> = ({ flags, metrics, turns = [], noWordTimings = false, className }) => {
  const titleId = useId();
  const numbers = numberAnswers(turns);
  const ordered = orderFlags(flags);
  const wpm = noWordTimings ? null : metrics.wpmMean;
  const fillers = noWordTimings ? null : metrics.fillersPer100Words;

  return (
    <section aria-labelledby={titleId} className={cn("overflow-hidden rounded-[14px] border border-black/[0.16] bg-white", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h2 id={titleId} className="text-sm font-extrabold text-[#222325]">
          How you delivered it <span className="font-semibold text-[#5f6062]">· {deliveryHeadline(flags)}</span>
        </h2>
        <WhatTheseMean />
      </div>

      <div className="overflow-hidden border-t border-black/[0.12]">
        <dl className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Pace" value={wpm === null ? null : String(Math.round(wpm))} unit={wpm === null ? "" : `wpm · ${paceVerdict(wpm, metrics.wpmReferenceBand)}`} />
          <Stat label="Long pauses" value={String(metrics.longPauses)} unit="" />
          <Stat label="Filler words" value={fillers === null ? null : fillers.toFixed(1)} unit="per 100 words" />
          <Stat label="Pitch variation" value={metrics.pitchVariationSt === null ? null : metrics.pitchVariationSt.toFixed(1)} unit="semitones" />
          <Stat
            label="Energy"
            value={metrics.energyTrendDbPerAnswer === null ? null : energyWord(metrics.energyTrendDbPerAnswer)}
            unit={metrics.energyTrendDbPerAnswer === null ? "" : `${formatSigned(metrics.energyTrendDbPerAnswer)} dB per answer`}
          />
        </dl>
      </div>

      {ordered.length > 0 && (
        <ul aria-label="What stood out" className="divide-y divide-black/[0.12] border-t border-black/[0.12]">
          {ordered.map((flag) => {
            const answer = numbers.get(flag.turnId);
            return (
              <li key={flag.id} className="flex items-start gap-3 px-4 py-3">
                <SeverityMeter severity={flag.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold leading-snug text-[#222325]">
                    {FLAG_KIND_META[flag.kind].label}
                    <span className="font-semibold text-[#5f6062]"> · {formatMeasure(flag.measure)}</span>
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-black/60">{flag.coaching}</p>
                  <p className="mt-1 text-[11px] text-black/45">
                    {answer !== undefined && <>Answer {answer} · </>}
                    {SEVERITY_LABELS[flag.severity]}
                  </p>
                </div>
                <TimestampChip atMs={flag.atMs} endMs={flag.endMs} className="mt-0.5" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

/** Strongest kind first; within a kind, in the order they happened. */
function orderFlags(flags: readonly DeliveryFlag[]): DeliveryFlag[] {
  return DELIVERY_FLAG_KINDS.map((kind, order) => ({ kind, order, items: flags.filter((f) => f.kind === kind).sort((a, b) => a.atMs - b.atMs) }))
    .filter((g) => g.items.length > 0)
    .map((g) => ({ ...g, top: Math.max(...g.items.map((f) => f.severity)) }))
    .sort((a, b) => b.top - a.top || a.order - b.order)
    .flatMap((g) => g.items);
}

/** One figure in the row; "Not measured" when the recording gave nothing to measure it from. */
const Stat: FC<{ label: string; value: string | null; unit: string }> = ({ label, value, unit }) => (
  <div className="flex min-w-0 flex-col border-b border-r border-black/[0.12] px-4 py-2.5">
    <dt className="text-xs text-[#5f6062]">{label}</dt>
    <dd className="min-w-0">
      {value === null ? (
        <span className="text-sm font-bold leading-[27px] text-[#5f6062]">Not measured</span>
      ) : (
        <span className="text-lg font-extrabold tabular-nums text-[#222325]">
          {value}
          {unit && <span className="ml-1 text-xs font-semibold text-[#5f6062]">{unit}</span>}
        </span>
      )}
    </dd>
  </div>
);

/** Three bars, filled up to the severity. The word sits beside it, so colour never carries it alone. */
const SeverityMeter: FC<{ severity: 1 | 2 | 3 }> = ({ severity }) => (
  <span aria-hidden className="mt-0.5 flex h-4 flex-none items-end gap-[3px]">
    {[1, 2, 3].map((level) => (
      <span
        key={level}
        className={cn("w-[4px] rounded-[1.5px]", level === 1 ? "h-2" : level === 2 ? "h-3" : "h-4", level <= severity ? "bg-[#b23c26]" : "bg-[#f0f0ea]")}
      />
    ))}
  </span>
);

const MEANINGS: ReadonlyArray<{ term: string; what: ReactNode }> = [
  { term: "Pace", what: "Words a minute across your answers. Many listeners find 140 to 160 easy to follow. The range is context, not a score." },
  { term: "Long pauses", what: "Silences over 1.2 s in the middle of an answer. A few read as thinking time; many can read as losing the thread." },
  { term: "Filler words", what: "“Um”, “uh”, “you know” and the like, per 100 words. A short pause does the same job without the sound." },
  { term: "Pitch variation", what: "How far your voice rose and fell, in semitones. Movement helps key points stand out; very little can sound flat." },
  { term: "Energy", what: "How your loudness changed from one answer to the next. Steady or rising holds attention to the end." },
];

/** "What these mean": each figure in a line, so none of them needs a guess. */
const WhatTheseMean: FC = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="h-7 cursor-pointer rounded text-xs font-bold text-[#44453f] underline underline-offset-[3px] hover:text-[#222325] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
        What these mean
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={6} className="w-[min(380px,calc(100vw-32px))] border-0 bg-transparent p-0 shadow-none">
      <div className="rounded-xl bg-white p-4 text-[#222325] br-shadow">
        <dl className="flex flex-col gap-2.5 text-xs leading-relaxed">
          {MEANINGS.map(({ term, what }) => (
            <div key={term}>
              <dt className="font-extrabold">{term}</dt>
              <dd className="text-black/60">{what}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-black/10 pt-2.5 text-[11px] leading-relaxed text-black/50">
          Each is measured from your recording and compared with your own averages in this session, not a standard you were held to.
        </p>
      </div>
    </PopoverContent>
  </Popover>
);

export default DeliveryFindings;
