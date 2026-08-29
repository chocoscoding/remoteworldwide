"use client";

import { FC } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INTRO_STAGES } from "@/app/lib/dashboard/mock-data";

/**
 * Where you are with one company. Four stages, because a recommendation skips
 * the funnel: reviewers put you forward, the company asks a question or two,
 * you answer, you talk.
 */
export interface IntroStageTrackerProps {
  currentIndex: number;
  className?: string;
}

const IntroStageTracker: FC<IntroStageTrackerProps> = ({ currentIndex, className }) => (
  <div className={cn("flex items-start", className)}>
    {INTRO_STAGES.map((stage, i) => {
      const done = i < currentIndex;
      const current = i === currentIndex;
      const last = i === INTRO_STAGES.length - 1;

      return (
        <div key={stage} className={cn("flex min-w-0 flex-col items-center", !last && "flex-1")}>
          <div className="flex w-full items-center">
            <span
              className={cn(
                "grid h-6 w-6 flex-none place-content-center rounded-full border-[1.5px] text-[10px] font-bold transition-colors",
                done && "border-[#222325] bg-[#222325] text-[#e1f073]",
                current && "border-[#222325] bg-[#e1f073] text-[#222325] ring-4 ring-secondary/25",
                !done && !current && "border-black/20 bg-white text-black/35"
              )}>
              {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
            </span>
            {!last && <span className={cn("h-[2px] flex-1 transition-colors", i < currentIndex ? "bg-[#222325]" : "bg-black/10")} />}
          </div>
          <span
            className={cn(
              "mt-1.5 max-w-[86px] text-center text-[10.5px] leading-tight",
              current ? "font-bold text-primary" : done ? "font-semibold text-black/60" : "text-black/55"
            )}>
            {stage}
          </span>
        </div>
      );
    })}
  </div>
);

export default IntroStageTracker;
