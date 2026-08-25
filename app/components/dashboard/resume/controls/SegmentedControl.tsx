"use client";

import { cn } from "@/lib/utils";

/**
 * Pill/segmented group of 2–4 text options — the customize panel's default
 * control for short closed enums: Capitalization (Capitalize / Uppercase),
 * Icons (None / Outline / Filled), Date Position (Right / Left / Split),
 * Subtitle Placement, Color Mode, Header Alignment, Application Area.
 *
 * Generic over the option id so the caller keeps its literal union type all
 * the way through `onChange` — no `as` casts at the call site.
 *
 * Presentational and fully prop-driven: no design types, no context.
 */

export interface SegmentedControlOption<T extends string = string> {
  id: T;
  label: string;
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

const SEGMENT_SIZE_CLASS: Record<"sm" | "md", string> = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3 py-1.5 text-xs",
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
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-xs font-semibold text-black/55">{label}</span>}
      <div role="radiogroup" aria-label={ariaLabel ?? label} className="flex items-center gap-1 rounded-lg border border-black/15 bg-[#f0f0ea] p-1">
        {options.map((option) => {
          const selected = option.id === value;
          const off = disabled || option.disabled;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={off}
              onClick={() => onChange(option.id)}
              className={cn(
                "min-w-0 flex-1 truncate rounded font-semibold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                SEGMENT_SIZE_CLASS[size],
                selected ? "bg-[#222325] text-white shadow-[2px_2px_0_0_#e1f073]" : "text-black/55 hover:bg-black/[0.04] hover:text-primary"
              )}>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
