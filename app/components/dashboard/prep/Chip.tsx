import { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Semantic state chip for Interview Prep.
 *
 * Colour carries *urgency and outcome*, never category — so the same tone
 * always means the same thing wherever it appears:
 *
 *   red    — needs you now, or it went badly (today, tomorrow, overdue, rejected)
 *   blue   — scheduled and informational (a date further out, a round label)
 *   green  — resolved well, or you're ready (offer, answer ready)
 *   white  — inert; no action implied (not started, closed, no date)
 *
 * Every tone is defined twice because half of them sit on the dark hero card
 * and half on white rows; a single palette can't stay legible on both.
 */
export type ChipTone = "red" | "blue" | "green" | "white";

const ON_LIGHT: Record<ChipTone, string> = {
  red: "bg-[#fdeae6] text-[#b23c26]",
  blue: "bg-[#e8eefc] text-[#2f5bb7]",
  green: "bg-[#e6f4ec] text-[#1f7a4c]",
  white: "bg-[#f0f0ea] text-black/55",
};

const ON_DARK: Record<ChipTone, string> = {
  red: "bg-[#e5533d] text-white",
  blue: "bg-[#5b8def] text-white",
  green: "bg-[#3fa66a] text-white",
  white: "bg-white/12 text-white/80",
};

export interface ChipProps {
  tone?: ChipTone;
  /** Renders the variant tuned for a dark surface. */
  onDark?: boolean;
  children: ReactNode;
  className?: string;
}

const Chip: FC<ChipProps> = ({ tone = "white", onDark = false, children, className }) => (
  <span
    className={cn(
      // `gap-1` costs the text-only chips nothing — flexbox wraps a contiguous
      // run of text in one anonymous item and gap only applies between items —
      // and keeps a leading glyph's spacing out of every call site.
      "inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none whitespace-nowrap",
      onDark ? ON_DARK[tone] : ON_LIGHT[tone],
      className
    )}>
    {children}
  </span>
);

export default Chip;
