"use client";

import { type FC } from "react";
import { cn } from "@/lib/utils";

/**
 * Label (+ optional description) on the left, switch on the right.
 *
 * Collapses the six near-identical ~18-line toggle blocks the resume screen
 * currently repeats (Entries / Photo / Links / Footer / per-section
 * visibility / house style) into one call each. Markup and sizing are kept
 * byte-for-byte compatible with those blocks so nothing shifts visually.
 *
 * Presentational and fully prop-driven: no design types, no context.
 */

export interface ToggleRowProps {
  label: string;
  /** Muted helper line under the label. */
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** `"md"` (default) is the panel-level toggle; `"sm"` is the in-list toggle. */
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}

// Written out in full so every class is visible to Tailwind's static
// build-time scan — same house pattern as StickerButton's STICKER_SHADOW_HOVER.
const TRACK_CLASS: Record<"sm" | "md", string> = {
  sm: "h-5 w-9 rounded-md border border-black/15",
  md: "h-6 w-11 rounded-md border border-black/15",
};

const KNOB_CLASS: Record<"sm" | "md", string> = {
  sm: "h-3.5 w-3.5 rounded-sm",
  md: "h-4 w-4 rounded-sm",
};

const KNOB_ON_CLASS: Record<"sm" | "md", string> = {
  sm: "translate-x-4",
  md: "translate-x-5",
};

const LABEL_CLASS: Record<"sm" | "md", string> = {
  sm: "text-xs font-semibold text-black/60",
  md: "text-[13px] font-bold text-primary",
};

const ToggleRow: FC<ToggleRowProps> = ({ label, description, checked, onCheckedChange, size = "md", disabled = false, className }) => (
  <div className={cn("flex items-center justify-between gap-3", className)}>
    <div className="min-w-0">
      <p className={LABEL_CLASS[size]}>{label}</p>
      {description && <p className="mt-0.5 text-[11px] text-black/45">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative flex-none transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
        TRACK_CLASS[size],
        checked ? "bg-primary" : "bg-[#e5e5e0]"
      )}>
      <span
        className={cn(
          "absolute left-0.5 top-0.5 bg-white shadow-[1px_1px_0_0_rgba(34,35,37,0.3)] transition-transform",
          KNOB_CLASS[size],
          checked && KNOB_ON_CLASS[size]
        )}
      />
    </button>
  </div>
);

export default ToggleRow;
