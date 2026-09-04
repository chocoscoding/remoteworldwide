"use client";

// Small, generic labeled input/textarea used throughout the Content tab's
// editing form. Presentational only — no design types, no design context.
//
// `isActive` is the entry-group hover/focus state: the group wrapper turns a
// tone of gray and these fields a deeper gray inside it. Ink text throughout —
// the active state is never a black block.

import type { ChangeEvent, FC } from "react";
import { cn } from "@/lib/utils";

const FIELD_CLASS = "rounded-none border px-2.5 py-1.5 text-sm outline-none transition-colors";

const FIELD_TONE = {
  active: "border-black/20 bg-[#d9d9d3] text-primary placeholder:text-black/45 focus:border-[#222325]",
  idle: "border-black/40 bg-white text-primary placeholder:text-black/40 focus:border-[#222325]",
} as const;

const LABEL_TONE = {
  active: "text-black/65",
  idle: "text-black/60",
} as const;

export interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  isActive?: boolean;
}

export const TextField: FC<TextFieldProps> = ({ label, value, onChange, placeholder, type = "text", className, isActive = false }) => (
  <label className={cn("flex min-w-0 flex-col gap-1", className)}>
    {label && <span className={cn("text-xs font-semibold", isActive ? LABEL_TONE.active : LABEL_TONE.idle)}>{label}</span>}
    <input
      type={type}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(FIELD_CLASS, "rounded-sm", isActive ? FIELD_TONE.active : FIELD_TONE.idle)}
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
  <label className={cn("flex flex-col gap-1", className)}>
    {label && <span className={cn("text-xs font-semibold", isActive ? LABEL_TONE.active : LABEL_TONE.idle)}>{label}</span>}
    <textarea
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        FIELD_CLASS,
        "resize-none leading-relaxed rounded-md min-h-20  [scrollbar-width:none] hover:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden hover:[&::-webkit-scrollbar]:block",
        isActive ? FIELD_TONE.active : FIELD_TONE.idle,
      )}
    />
  </label>
);
