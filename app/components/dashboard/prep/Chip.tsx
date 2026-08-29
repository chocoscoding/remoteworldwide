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

/**
 * Two quieter takes on the dark-surface chip, side by side for comparison.
 * The solid fills above read as loud against ink — a saturated blue block
 * pulls harder than the job title next to it. Delete whichever loses.
 */
export const ON_DARK_VARIANT_A: Record<ChipTone, string> = {
  red: "bg-white text-[#c33f28]",
  blue: "bg-white text-[#2f5bb7]",
  green: "bg-white text-[#1f7a4c]",
  white: "bg-white/90 text-[#222325]",
};

export const ON_DARK_VARIANT_B: Record<ChipTone, string> = {
  red: "bg-[#f5a898] text-[#222325]",
  blue: "bg-[#a8c4f5] text-[#222325]",
  green: "bg-[#a8e0bd] text-[#222325]",
  white: "bg-[#e6e6df] text-[#222325]",
};

export interface ChipProps {
  tone?: ChipTone;
  /** Renders the variant tuned for a dark surface. */
  onDark?: boolean;
  /** Temporary: which dark-surface palette to use while both are on trial. */
  darkVariant?: "solid" | "a" | "b";
  children: ReactNode;
  className?: string;
}

function darkPalette(variant: ChipProps["darkVariant"]): Record<ChipTone, string> {
  if (variant === "a") return ON_DARK_VARIANT_A;
  if (variant === "b") return ON_DARK_VARIANT_B;
  return ON_DARK;
}

const Chip: FC<ChipProps> = ({ tone = "white", onDark = false, darkVariant = "solid", children, className }) => (
  <span
    className={cn(
      "inline-flex flex-none items-center rounded-full px-2.5 py-1 text-[11px] font-bold leading-none whitespace-nowrap",
      onDark ? darkPalette(darkVariant)[tone] : ON_LIGHT[tone],
      className
    )}>
    {children}
  </span>
);

export default Chip;
