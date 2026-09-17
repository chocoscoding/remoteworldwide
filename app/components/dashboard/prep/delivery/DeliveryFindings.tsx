"use client";

import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FLAG_KIND_META, SEVERITY_LABELS, formatMeasure, formatSigned, numberAnswers, type DeliveryTurn } from "@/app/lib/voice/format";
import { DELIVERY_FLAG_KINDS, type DeliveryFlag, type DeliveryFlagKind, type DeliveryMetrics } from "@/app/lib/voice/types";
import TimestampChip from "./TimestampChip";

/**
 * What the recording measured, in words a candidate can act on.
 *
 * Two halves. The tiles are the session's numbers, each with a sentence on
 * what it means, so a figure never stands alone. The findings are the moments
 * that stood out against the user's own averages, grouped by kind, each with
 * its measure ("Pace 182 wpm vs your 150 average"), one line of coaching and
 * a chip that plays it.
 *
 * Everything here is measured pace, pauses, fillers, pitch movement and
 * loudness. Nothing describes the speaker, only how they used their voice in
 * this session.
 */
export interface DeliveryFindingsProps {
  flags: readonly DeliveryFlag[];
  metrics: DeliveryMetrics;
  /** Names the answer each finding sits in ("Answer 3"). */
  turns?: readonly DeliveryTurn[];
  className?: string;
}

/** Below this change per answer, energy reads as steady. */
const STEADY_DB = 0.5;

const DeliveryFindings: FC<DeliveryFindingsProps> = ({ flags, metrics, turns = [], className }) => {
  const numbers = numberAnswers(turns);
  const groups = groupFlags(flags);

  return (
    <section aria-label="Delivery findings" className={cn("rounded-2xl border border-black/10 bg-white", className)}>
      <header className="px-5 pb-4 pt-5 sm:px-6">
        <h3 className="text-[14.5px] font-bold text-primary">How you delivered it</h3>
        <p className="mt-1 max-w-[560px] text-xs leading-relaxed text-black/50">
          Measured from your recording and compared with your own averages in this session, so the numbers describe how you spoke here, not a standard you
          were held to.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2.5 px-5 pb-5 xs:grid-cols-2 sm:px-6 lg:grid-cols-5">
        <PaceTile wpm={metrics.wpmMean} band={metrics.wpmReferenceBand} />
        <MetricTile
          label="Long pauses"
          value={String(metrics.longPauses)}
          unit={metrics.longPauses === 1 ? "pause" : "pauses"}
          note={
            <>
              Silences over 1.2 s mid-answer. A few read as thinking time; many can read as losing the thread.
              {metrics.speechRatio !== null && <> You were speaking for {Math.round(metrics.speechRatio * 100)}% of your answer time.</>}
            </>
          }
        />
        <MetricTile
          label="Filler words"
          value={metrics.fillersPer100Words === null ? null : metrics.fillersPer100Words.toFixed(1)}
          unit="per 100 words"
          note="“Um”, “uh”, “you know” and the like. A short pause does the same job without the sound."
        />
        <MetricTile
          label="Pitch variation"
          value={metrics.pitchVariationSt === null ? null : metrics.pitchVariationSt.toFixed(1)}
          unit="semitones"
          note="How far your pitch moved as you spoke. Movement helps key points stand out; very little can sound flat."
        />
        <EnergyTile trend={metrics.energyTrendDbPerAnswer} />
      </div>

      <div className="border-t border-black/10">
        {groups.length === 0 ? (
          <p className="px-5 py-5 text-sm leading-relaxed text-black/55 sm:px-6">
            Nothing stood out. Your pace, pauses and energy stayed close to your own averages all the way through.
          </p>
        ) : (
          groups.map(({ kind, items }) => (
            <div key={kind} className="border-b border-black/10 px-5 py-5 last:border-b-0 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h4 className="flex items-center gap-2 text-sm font-bold text-primary">
                  <span aria-hidden className="h-2 w-2 flex-none rotate-45 bg-[#b23c26]" />
                  {FLAG_KIND_META[kind].label}
                </h4>
                <span className="text-xs text-black/45">
                  {items.length} {items.length === 1 ? "moment" : "moments"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-black/50">{FLAG_KIND_META[kind].what}</p>

              <ul className="mt-3 flex flex-col gap-2.5">
                {items.map((flag) => {
                  const answer = numbers.get(flag.turnId);
                  return (
                    <li key={flag.id} className="flex items-start gap-3 rounded-xl border border-black/10 p-3.5">
                      <SeverityMeter severity={flag.severity} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-primary">{formatMeasure(flag.measure)}</p>
                        <p className="mt-1 text-sm leading-relaxed text-black/60">{flag.coaching}</p>
                        <p className="mt-1.5 text-[11.5px] text-black/40">
                          {answer !== undefined && <>Answer {answer} · </>}
                          {SEVERITY_LABELS[flag.severity]}
                        </p>
                      </div>
                      <TimestampChip atMs={flag.atMs} endMs={flag.endMs} className="mt-0.5" />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

/** Strongest group first; within a group, in the order they happened. */
function groupFlags(flags: readonly DeliveryFlag[]): Array<{ kind: DeliveryFlagKind; items: DeliveryFlag[] }> {
  return DELIVERY_FLAG_KINDS.map((kind) => ({ kind, items: flags.filter((f) => f.kind === kind).sort((a, b) => a.atMs - b.atMs) }))
    .filter((g) => g.items.length > 0)
    .map((g, order) => ({ ...g, order, top: Math.max(...g.items.map((f) => f.severity)) }))
    .sort((a, b) => b.top - a.top || a.order - b.order)
    .map(({ kind, items }) => ({ kind, items }));
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

const TILE = "flex flex-col rounded-xl border border-black/10 bg-[#fbfbf7] p-3.5";

const NOT_MEASURED = "Not enough speech in the recording to measure this.";

const TileValue: FC<{ value: string | null; unit: string }> = ({ value, unit }) =>
  value === null ? (
    <p className="text-[26px] font-bold leading-none text-black/30">—</p>
  ) : (
    <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
      <span className="text-[26px] font-bold text-primary">{value}</span>
      <span className="text-xs font-semibold text-black/45">{unit}</span>
    </p>
  );

const MetricTile: FC<{ label: string; value: string | null; unit: string; note: ReactNode }> = ({ label, value, unit, note }) => (
  <div className={TILE}>
    <p className="mb-2 text-[11.5px] font-medium text-black/50">{label}</p>
    <TileValue value={value} unit={unit} />
    <p className="mt-2.5 text-xs leading-relaxed text-black/50">{value === null ? NOT_MEASURED : note}</p>
  </div>
);

const SCALE_LO = 100;
const SCALE_HI = 200;
const toScale = (wpm: number) => ((Math.min(SCALE_HI, Math.max(SCALE_LO, wpm)) - SCALE_LO) / (SCALE_HI - SCALE_LO)) * 100;

/** Pace with its reference band drawn: where the average sat against 140–160, on a 100–200 scale. */
const PaceTile: FC<{ wpm: number | null; band: DeliveryMetrics["wpmReferenceBand"] }> = ({ wpm, band }) => {
  const where = wpm === null ? null : wpm < band.low ? "Slower than" : wpm > band.high ? "Faster than" : "Inside";
  return (
    <div className={TILE}>
      <p className="mb-2 text-[11.5px] font-medium text-black/50">Pace</p>
      <TileValue value={wpm === null ? null : String(Math.round(wpm))} unit="wpm" />
      {wpm !== null && (
        // Positions on a continuous scale can't be literal classes, so the
        // band and the marker are placed inline.
        <div aria-hidden className="relative mt-3 h-1.5 rounded-full bg-[#f0f0ea]">
          <div className="absolute inset-y-0 rounded-full bg-[#e1f073]" style={{ left: `${toScale(band.low)}%`, width: `${toScale(band.high) - toScale(band.low)}%` }} />
          <div className="absolute -top-[3px] h-3 w-1 -translate-x-1/2 rounded-full bg-[#222325] ring-2 ring-[#fbfbf7]" style={{ left: `${toScale(wpm)}%` }} />
        </div>
      )}
      <p className="mt-2.5 text-xs leading-relaxed text-black/50">
        {where === null ? NOT_MEASURED : `${where} the ${band.low}–${band.high} range many listeners find easy to follow. The range is context, not a score.`}
      </p>
    </div>
  );
};

const EnergyTile: FC<{ trend: number | null }> = ({ trend }) => {
  const word = trend === null ? null : trend <= -STEADY_DB ? "Fading" : trend >= STEADY_DB ? "Building" : "Steady";
  return (
    <div className={TILE}>
      <p className="mb-2 text-[11.5px] font-medium text-black/50">Energy</p>
      {trend === null ? (
        <TileValue value={null} unit="" />
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
          <span className="text-[26px] font-bold text-primary">{word}</span>
          <span className="text-xs font-semibold text-black/45">{formatSigned(trend)} dB per answer</span>
        </p>
      )}
      <p className="mt-2.5 text-xs leading-relaxed text-black/50">
        {trend === null ? NOT_MEASURED : "How your loudness changed from one answer to the next. Steady or rising holds attention to the end."}
      </p>
    </div>
  );
};

/** Three bars, filled up to the severity. The word sits beside it, so colour never carries it alone. */
const SeverityMeter: FC<{ severity: 1 | 2 | 3 }> = ({ severity }) => (
  <span aria-hidden className="mt-1 flex h-4 flex-none items-end gap-[3px]">
    {[1, 2, 3].map((level) => (
      <span
        key={level}
        className={cn("w-[4px] rounded-[1.5px]", level === 1 ? "h-2" : level === 2 ? "h-3" : "h-4", level <= severity ? "bg-[#b23c26]" : "bg-[#f0f0ea]")}
      />
    ))}
  </span>
);

export default DeliveryFindings;
