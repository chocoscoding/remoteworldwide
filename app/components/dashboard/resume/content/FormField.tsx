"use client";

// Small, generic labeled input/textarea used throughout the Content tab's
// editing form. Presentational only — no design types, no design context.

import type { ChangeEvent, FC } from "react";
import { cn } from "@/lib/utils";

const FIELD_CLASS = "rounded-none border px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-[#222325]";

export interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  isDark?: boolean;
}

export const TextField: FC<TextFieldProps> = ({ label, value, onChange, placeholder, type = "text", className, isDark = false }) => (
  <label className={cn("flex min-w-0 flex-col gap-1", className)}>
    {label && <span className={cn("text-xs font-semibold", isDark ? "text-white/75" : "text-black/60")}>{label}</span>}
    <input
      type={type}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        FIELD_CLASS,
        "rounded-sm",
        isDark
          ? "border-white/20 bg-[#242424] text-white placeholder:text-white/45 focus:border-white/40"
          : "border-black/40 bg-white text-primary placeholder:text-black/40 focus:border-[#222325]",
      )}
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
  isDark?: boolean;
}

export const TextAreaField: FC<TextAreaFieldProps> = ({ label, value, onChange, placeholder, rows = 4, className, isDark = false }) => (
  <label className={cn("flex flex-col gap-1", className)}>
    {label && <span className={cn("text-xs font-semibold", isDark ? "text-white/75" : "text-black/60")}>{label}</span>}
    <textarea
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        FIELD_CLASS,
        "resize-none leading-relaxed rounded-md min-h-20  [scrollbar-width:none] hover:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden hover:[&::-webkit-scrollbar]:block",
        isDark
          ? "border-white/20 bg-[#242424] text-white placeholder:text-white/45 focus:border-white/40"
          : "border-black/40 bg-white text-primary placeholder:text-black/40 focus:border-[#222325]",
      )}
    />
  </label>
);
