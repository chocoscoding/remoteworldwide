import { FC } from "react";
import { cn } from "@/lib/utils";

export interface AvailabilityPillProps {
  /** Paused wins: reviewers can't see you either way, and Resume is the one thing to do. */
  state: "available" | "ineligible" | "paused";
  /** Days left on a pause, or null for a pause with no end date. */
  pausedDaysLeft: number | null;
  onPause: () => void;
  onResume: () => void;
}

const LABEL: Record<AvailabilityPillProps["state"], string> = {
  available: "You're available",
  ineligible: "Not in the running yet",
  paused: "You're unavailable",
};

/** Where you stand with reviewers, in the header, with the pause switch beside it. */
const AvailabilityPill: FC<AvailabilityPillProps> = ({ state, pausedDaysLeft, onPause, onResume }) => {
  const paused = state === "paused";
  return (
    <div className="flex h-10 flex-none items-center gap-2 rounded-full border border-[#222325] bg-white pl-3 pr-1.5">
      <span
        aria-hidden
        className={cn(
          "h-[9px] w-[9px] flex-none rounded-full",
          state === "available" ? "bg-[#6c7a1e]" : cn("border-[1.5px]", paused ? "border-black/35" : "border-[#222325]"),
        )}
      />
      <span className="whitespace-nowrap text-[13px] font-bold text-primary">
        {LABEL[state]}
        {paused && pausedDaysLeft !== null && <span className="font-semibold text-[#5f6062]"> · {pausedDaysLeft}d left</span>}
      </span>
      <button
        type="button"
        onClick={paused ? onResume : onPause}
        className={cn(
          "h-7 cursor-pointer rounded-full px-3 text-xs font-bold text-primary transition-colors",
          paused ? "bg-[#e1f073] hover:bg-[#d4e35c]" : "bg-[#f0f0ea] hover:bg-[#e4e4dd]",
        )}>
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
};

export default AvailabilityPill;
