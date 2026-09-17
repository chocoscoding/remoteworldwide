"use client";

import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { DeliverySummaryLine } from "@/app/lib/voice/types";
import TimestampChip from "./TimestampChip";

/**
 * The report's summary, a sentence at a time, each with the moment it is
 * about. It takes the coach note's place on a voice report, so by default it
 * wears the coach note's dark card.
 *
 * Outside a PlaybackProvider the chips don't render and the sentences read as
 * a plain note.
 */
export interface SummaryLinesProps {
  /** Three to six lines, in the order the report wrote them. */
  lines: readonly DeliverySummaryLine[];
  title?: string;
  tone?: "dark" | "light";
  className?: string;
}

const SummaryLines: FC<SummaryLinesProps> = ({ lines, title = "Coach note", tone = "dark", className }) => {
  if (lines.length === 0) return null;
  const dark = tone === "dark";
  return (
    <section aria-label={title} className={cn("rounded-2xl p-5", dark ? "bg-[#222325] text-white" : "border border-black/10 bg-white", className)}>
      <h3 className={cn("mb-3 text-[11px] font-bold uppercase tracking-[0.1em]", dark ? "text-secondary" : "text-black/45")}>{title}</h3>
      <ol className="flex flex-col gap-2.5">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start gap-3">
            <TimestampChip atMs={line.atMs} endMs={line.endMs} onDark={dark} className="mt-px" />
            <p className={cn("min-w-0 flex-1 text-sm leading-relaxed", dark ? "text-white/80" : "text-black/65")}>{line.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default SummaryLines;
