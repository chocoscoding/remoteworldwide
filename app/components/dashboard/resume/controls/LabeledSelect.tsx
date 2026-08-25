"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Labelled dropdown, built on the installed Radix select. Replaces the local
 * `SettingSelect` the resume screen currently hand-rolls three times
 * (Language / Date format / Page format) and serves the Font panel too.
 *
 * ## Why per-option `className` / `renderOption` exist
 *
 * The Font picker renders every row in its own typeface. The option's node is
 * wrapped in a span carrying `option.className` *inside* Radix's `ItemText`,
 * which Radix clones into the trigger — so the closed dropdown also renders in
 * the selected face, not just the open list. Pass a static Tailwind class
 * (e.g. a `font-[family-name:var(--r-f-lora)]` preview class); a class string
 * assembled at runtime would be invisible to Tailwind's build-time scan.
 *
 * Presentational and fully prop-driven: no design types, no context.
 */

export interface LabeledSelectOption<T extends string = string> {
  id: T;
  label: string;
  /** Static Tailwind applied to the row *and* mirrored onto the trigger. */
  className?: string;
  disabled?: boolean;
}

export interface LabeledSelectProps<T extends string = string> {
  label: string;
  options: LabeledSelectOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Full control over a row's content. Defaults to `option.label`. */
  renderOption?: (option: LabeledSelectOption<T>) => ReactNode;
  /** `"inline"` (default) puts the label left of the value; `"stacked"` puts it above. */
  orientation?: "inline" | "stacked";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

const TRIGGER_CLASS =
  "h-auto w-full gap-2 rounded-lg border border-black/12 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-none transition-colors hover:border-black/25 focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed";

export default function LabeledSelect<T extends string = string>({
  label,
  options,
  value,
  onChange,
  renderOption,
  orientation = "inline",
  placeholder,
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
}: LabeledSelectProps<T>) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {orientation === "stacked" && <span className="text-xs font-semibold text-black/55">{label}</span>}

      <Select value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
        <SelectTrigger aria-label={label} className={cn(TRIGGER_CLASS, triggerClassName)}>
          {orientation === "inline" && <span className="flex-1 truncate text-left font-medium text-black/45">{label}</span>}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent className={cn("rounded-lg border-black/10 bg-white", contentClassName)}>
          {options.map((option) => (
            <SelectItem
              key={option.id}
              value={option.id}
              disabled={option.disabled}
              className="cursor-pointer py-2 text-xs font-semibold text-black/70 focus:bg-[#f6f6f6] focus:text-primary data-[state=checked]:text-primary">
              {/* The class must sit INSIDE ItemText so Radix mirrors it onto the trigger. */}
              <span className={cn("block truncate", option.className)}>{renderOption ? renderOption(option) : option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
