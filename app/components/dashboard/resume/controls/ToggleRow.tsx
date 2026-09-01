"use client";

import { type FC } from "react";
import { cn } from "@/lib/utils";
import { Toggle } from "../../settings/settings-ui";

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
    <Toggle
      checked={checked}
      aria-checked={checked}
      label={label}
      disabled={disabled}
      onChange={() => onCheckedChange(!checked)}
      size="sm"
    />
  </div>
);

export default ToggleRow;
