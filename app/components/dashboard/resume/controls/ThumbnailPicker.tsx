"use client";

import { type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grid of selectable *visual* cards — used wherever the choice is easier to
 * recognise than to read: Columns (One / Two / Mix), Heading Style (8
 * variants), Entry Structure, Header Details Arrangement, Icon Style (7).
 *
 * Each option brings its own `preview` node, so this component never knows
 * anything about what it is previewing. Selected cards get a ring in the
 * brand ink plus a corner check badge.
 *
 * Presentational and fully prop-driven: no design types, no context.
 */

export interface ThumbnailOption<T extends string = string> {
  id: T;
  /** Caption under the preview. Omit for preview-only cards. */
  label?: string;
  /** The small visual sample rendered inside the card. */
  preview: ReactNode;
  disabled?: boolean;
}

export interface ThumbnailPickerProps<T extends string = string> {
  options: ThumbnailOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** 1–4. Defaults to 3. Values outside the range clamp into it. */
  columns?: number;
  /** Optional label rendered above the grid. */
  label?: string;
  /** Falls back to `label` when omitted. */
  ariaLabel?: string;
  className?: string;
}

// Written out in full so every class is visible to Tailwind's static
// build-time scan — same house pattern as StickerButton's
// STICKER_SHADOW_HOVER and ProgressBar's WIDTH_CLASSES.
const GRID_COLS_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

function clampColumns(columns: number): 1 | 2 | 3 | 4 {
  if (columns <= 1) return 1;
  if (columns === 2) return 2;
  if (columns === 3) return 3;
  return 4;
}

export default function ThumbnailPicker<T extends string = string>({
  options,
  value,
  onChange,
  columns = 3,
  label,
  ariaLabel,
  className,
}: ThumbnailPickerProps<T>) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-xs font-semibold text-black/55">{label}</span>}
      <div role="radiogroup" aria-label={ariaLabel ?? label} className={cn("grid gap-2.5", GRID_COLS_CLASS[clampColumns(columns)])}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label ?? option.id}
              disabled={option.disabled}
              onClick={() => onChange(option.id)}
              className={cn(
                "group relative flex flex-col items-stretch gap-1.5 rounded-lg border bg-white p-2 text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                selected ? "border-[#222325] border-2 shadow-[3px_3px_0_0_#e1f073]" : "border-black/10 hover:border-black/25"
              )}>
              {selected && (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-content-center rounded-full bg-[#222325] text-[#e1f073]">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
              <span className="block overflow-hidden rounded-lg bg-[#fbfbf7]">{option.preview}</span>
              {option.label && (
                <span className={cn("block truncate text-center text-[11px] font-semibold", selected ? "text-primary" : "text-black/50")}>
                  {option.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
