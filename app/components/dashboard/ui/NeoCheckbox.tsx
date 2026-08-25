import { FC } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The neobrutalist checkbox used everywhere in the dashboard: a hard 2px ink
 * border, a flat offset shadow instead of a blur, near-square corners, and a
 * lime fill when checked.
 *
 * Rendered as a `<span>`, not a `<button>`, because nearly every call site
 * already wraps it in its own clickable row — nesting a button inside a button
 * is invalid HTML and breaks keyboard focus order. Where the box itself is the
 * only interactive element (the Landed checklist), the call site puts the
 * button on the outside and passes `interactive` so the press states still
 * apply.
 *
 * Motion is on the shadow rather than colour, in two stages: hovering the row
 * grows the shadow by 0.5px so the box lifts without moving, and pressing
 * translates it onto the shadow while the shadow collapses, so it lands flush
 * against the surface.
 */
export type NeoCheckboxSize = "sm" | "md";

const SIZE_CLASS: Record<NeoCheckboxSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

const ICON_CLASS: Record<NeoCheckboxSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
};

export interface NeoCheckboxProps {
  checked: boolean;
  size?: NeoCheckboxSize;
  /** Adds hover/active press states. Use when the box (or its row) is clickable. */
  interactive?: boolean;
  /** Renders against a dark surface — swaps the ink border/shadow for white. */
  dark?: boolean;
  className?: string;
}

const NeoCheckbox: FC<NeoCheckboxProps> = ({ checked, size = "md", interactive = true, dark = false, className }) => (
  <span
    aria-hidden
    className={cn(
      "flex-none inline-flex items-center justify-center rounded-[3px] border-2 transition-all",
      SIZE_CLASS[size],
      dark
        ? checked
          ? "bg-secondary border-white text-primary shadow-[2px_2px_0_0_#ffffff]"
          : "bg-transparent border-white/60 shadow-[2px_2px_0_0_rgba(255,255,255,0.35)]"
        : checked
          ? "bg-secondary border-[#222325] text-[#222325] shadow-[2px_2px_0_0_#222325]"
          : "bg-white border-[#222325] shadow-[2px_2px_0_0_#222325]",
      // Hovering the row grows the shadow by 0.5px — the box lifts without
      // moving. Pressing translates it by the resting shadow's full 2px while
      // that shadow collapses, so it lands flush and reads as pushed in.
      // Checked and unchecked share the behaviour; the fill carries the state.
      interactive && "group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-none",
      interactive && !dark && "group-hover:shadow-[2.5px_2.5px_0_0_#222325]",
      interactive && dark && checked && "group-hover:shadow-[2.5px_2.5px_0_0_#ffffff]",
      interactive && dark && !checked && "group-hover:shadow-[2.5px_2.5px_0_0_rgba(255,255,255,0.5)]",
      className,
    )}>
    {checked && <Check className={cn(ICON_CLASS[size], "stroke-[3.5]")} />}
  </span>
);

export default NeoCheckbox;
