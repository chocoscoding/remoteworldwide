"use client";

import { useId, type FC } from "react";
import { cn } from "@/lib/utils";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import type { DimensionScore } from "@/app/lib/dashboard/prep-data";
import type { UnscoredDimension } from "@/app/lib/voice/types";
import Chip from "../Chip";
import { BAND_BG, dimensionBand, formatScore } from "./reportScales";

/**
 * The scorecard as a grid, lowest score first, so the first cell read is the
 * first thing to fix. Each cell opens the evidence behind it. A dimension the
 * session gave too little to judge has no number and no bar, which would read
 * as a low score: it says so in words, and opens what would get it judged.
 */
export interface ScorecardProps {
  dimensions: readonly DimensionScore[];
  unscored: readonly UnscoredDimension[];
  /** A short session's score: the card says so beside its title. */
  provisional?: boolean;
  onOpen: (pick: { kind: "dimension"; dimension: DimensionScore } | { kind: "unscored"; dimension: UnscoredDimension }) => void;
}

const CELL =
  "flex min-w-0 cursor-pointer flex-col gap-1.5 border-b border-r border-black/[0.12] px-4 py-3 text-left text-[#222325] transition-colors hover:bg-[#f6f6f1] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#222325]";

const Scorecard: FC<ScorecardProps> = ({ dimensions, unscored, provisional = false, onOpen }) => {
  const titleId = useId();
  if (dimensions.length === 0 && unscored.length === 0) return null;
  const lowestFirst = [...dimensions].sort((a, b) => a.score - b.score);
  return (
    <section aria-labelledby={titleId} className="overflow-hidden rounded-[14px] border border-black/[0.16] bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-extrabold text-[#222325]">
          Scorecard
          {provisional && <Chip tone="blue">Short session</Chip>}
        </h2>
        <span className="text-xs text-[#5f6062]">Lowest first · click one to see why</span>
      </div>
      {/* Hairlines between cells, none on the card's own edge: every cell rules
          its right and bottom, and the grid hangs a pixel past the card on
          both, where the card's overflow hides them. */}
      <div className="border-t border-black/[0.12]">
        <ul className="-mb-px -mr-px grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3">
          {lowestFirst.map((d) => {
            const band = dimensionBand(d.score);
            return (
              <li key={d.id} className="flex">
                <button type="button" onClick={() => onOpen({ kind: "dimension", dimension: d })} className={cn(CELL, "w-full", band === "low" && "bg-[#fbfbf7]")}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("min-w-0 text-[13px]", band === "low" ? "font-extrabold" : "font-bold")}>{d.label}</span>
                    <span className="flex-none text-base font-extrabold tabular-nums">
                      {formatScore(d.score)}
                      <span className="ml-0.5 text-[11px] font-semibold text-[#9a9b95]">/ 10</span>
                    </span>
                  </span>
                  <ProgressBar value={d.score * 10} height="h-1.5" className="bg-[#e4e4dd]" fillClassName={BAND_BG[band]} />
                </button>
              </li>
            );
          })}
          {unscored.map((d) => (
            <li key={d.id} className="flex">
              <button type="button" onClick={() => onOpen({ kind: "unscored", dimension: d })} className={cn(CELL, "w-full")}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-[13px] font-bold">{d.label}</span>
                </span>
                <span className="text-xs font-semibold text-[#5f6062]">Not enough to judge</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Scorecard;
