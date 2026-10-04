"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSlidingPill } from "./useSlidingPill";

/**
 * Pill/segmented group of 2–4 text options — the customize panel's default
 * control for short closed enums: Columns (One / Two / Mix), Capitalization,
 * Icons (None / Outline / Filled), Date Position, Subtitle Placement, Color
 * Mode, Header Alignment, Application Area.
 *
 * The editor's switch look (owner, 2026-10-04): a quiet sand track, the
 * choice in a dark pill that slides to the next one, an option's icon in lime
 * while it is chosen. The same recipe as the editor's header tabs.
 *
 * Generic over the option id so the caller keeps its literal union type all
 * the way through `onChange` — no `as` casts at the call site.
 *
 * Presentational and fully prop-driven: no design types, no context.
 */

export interface SegmentedControlOption<T extends string = string> {
  id: T;
  label: string;
  /** Drawn before the label; lime while the option is chosen. */
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Optional label rendered above the group. */
  label?: string;
  size?: "sm" | "md";
  /** Disables every segment. */
  disabled?: boolean;
  /** Falls back to `label` when omitted. */
  ariaLabel?: string;
  className?: string;
}

const TRACK_CLASS: Record<"sm" | "md", string> = {
  sm: "gap-0.5 rounded-lg p-0.5",
  md: "gap-1 rounded-xl p-1",
};

const SEGMENT_CLASS: Record<"sm" | "md", string> = {
  sm: "h-7 gap-1.5 rounded-[7px] px-2.5 text-[11px]",
  md: "h-9 gap-2 rounded-[9px] px-3 text-[13px]",
};

const PILL_RADIUS: Record<"sm" | "md", string> = {
  sm: "rounded-[7px]",
  md: "rounded-[9px]",
};

export default function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  disabled = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const { groupRef, itemRef, style } = useSlidingPill(value);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-xs font-semibold text-black/55">{label}</span>}
      <div ref={groupRef} role="radiogroup" aria-label={ariaLabel ?? label} className={cn("relative flex items-center bg-[#f0f0ea]", TRACK_CLASS[size])}>
        {style && (
          <span
            aria-hidden
            style={style}
            className={cn(
              "pointer-events-none absolute bg-[#222325] transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none",
              PILL_RADIUS[size],
            )}
          />
        )}
        {options.map((option) => {
          const selected = option.id === value;
          const off = disabled || option.disabled;
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              ref={itemRef(option.id)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={off}
              onClick={() => onChange(option.id)}
              className={cn(
                "relative z-[1] flex min-w-0 flex-1 items-center justify-center transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                SEGMENT_CLASS[size],
                selected ? "font-bold text-white" : "font-semibold text-[#55564f] hover:text-primary",
                // Before the pill is measured, the chosen option paints itself.
                selected && !style && "bg-[#222325]",
              )}>
              {Icon && <Icon aria-hidden className={cn("flex-none", size === "sm" ? "h-3 w-3" : "h-4 w-4", selected && "text-[#e1f073]")} />}
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
