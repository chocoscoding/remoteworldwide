"use client";

// Small, generic labeled input/textarea used throughout the Content tab's
// editing form. Presentational only — no design types, no design context.

import type { ChangeEvent, FC } from "react";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "rounded-none border border-black/40 bg-white px-2.5 py-1.5 text-sm text-primary placeholder:text-black/40 outline-none focus:border-[#222325] transition-colors";

export interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}

export const TextField: FC<TextFieldProps> = ({ label, value, onChange, placeholder, type = "text", className }) => (
  <label className={cn("flex flex-col gap-1 min-w-0", className)}>
    {label && <span className="text-xs font-semibold text-black/60">{label}</span>}
    <input
      type={type}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      className={FIELD_CLASS}
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
}

export const TextAreaField: FC<TextAreaFieldProps> = ({ label, value, onChange, placeholder, rows = 4, className }) => (
  <label className={cn("flex flex-col gap-1", className)}>
    {label && <span className="text-xs font-semibold text-black/60">{label}</span>}
    <textarea
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(FIELD_CLASS, "resize-none leading-relaxed")}
    />
  </label>
);
