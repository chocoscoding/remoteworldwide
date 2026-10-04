"use client";

// Small, generic labeled input/textarea used throughout the Content tab's
// editing form. Presentational only — no design types, no design context.
//
// The owner's 2026-10-04 field: white, a soft ink border, 9px corners, an ink
// border and a lime halo while focused. `isActive` (an entry being worked on)
// no longer changes the tone — the entry's own card says it — and is kept so
// every caller still compiles.

import type { ChangeEvent, FC } from "react";
import { cn } from "@/lib/utils";

// Exported for the two editors that need a bare element instead of these
// wrappers — the bullets rows (a ref per textarea) and the skills input (key
// handling) — so they wear the same field without restating it.
export const FIELD_CLASS =
  "rounded-[9px] border px-3 py-2.5 text-sm outline-none transition-[border-color,box-shadow] focus:border-[#222325] focus:ring-[3px] focus:ring-[#eef6ad]";

const TONE = "border-black/40 bg-white text-primary placeholder:text-black/40 hover:border-black/60";

export const FIELD_TONE = {
  active: TONE,
  idle: TONE,
} as const;

const LABEL_TONE = {
  active: "text-[#44453f]",
  idle: "text-[#44453f]",
} as const;

export interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  isActive?: boolean;
  maxLength?: number;
}

export const TextField: FC<TextFieldProps> = ({ label, value, onChange, placeholder, type = "text", className, isActive = false, maxLength }) => (
  <label className={cn("flex min-w-0 flex-col gap-[5px]", className)}>
    {label && <span className={cn("text-xs font-bold", isActive ? LABEL_TONE.active : LABEL_TONE.idle)}>{label}</span>}
    <input
      type={type}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={cn(FIELD_CLASS, "h-11 min-w-0 py-0", isActive ? FIELD_TONE.active : FIELD_TONE.idle)}
    />
  </label>
);

export interface TextAreaFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  isActive?: boolean;
}

export const TextAreaField: FC<TextAreaFieldProps> = ({ label, value, onChange, placeholder, rows = 4, className, isActive = false }) => (
  <label className={cn("flex flex-col gap-[5px]", className)}>
    {label && <span className={cn("text-xs font-bold", isActive ? LABEL_TONE.active : LABEL_TONE.idle)}>{label}</span>}
    <textarea
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        FIELD_CLASS,
        "resize-none leading-relaxed min-h-20 [scrollbar-width:none] hover:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden hover:[&::-webkit-scrollbar]:block",
        isActive ? FIELD_TONE.active : FIELD_TONE.idle,
      )}
    />
  </label>
);
