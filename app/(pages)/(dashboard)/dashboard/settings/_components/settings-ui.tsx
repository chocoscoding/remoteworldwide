"use client";

import { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The building blocks every settings section is made of.
 *
 * Settings pages go wrong when each one invents its own row shape, so the
 * whole area is composed from these five: a Section, a Row, and three
 * controls. Surfaces stay quiet — the hairline card the rest of the
 * dashboard uses — and weight is reserved for the things you can press.
 */

export const CARD = "rounded-2xl border border-black/10 bg-white";

export const INPUT =
  "w-full rounded-lg border border-black/15 bg-[#fbfbf7] px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325] disabled:opacity-50";

export const BUTTON_SOLID =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#222325] px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[3px_3px_0_0_#e1f073] hover:-translate-x-px hover:-translate-y-px active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-40 disabled:pointer-events-none";

export const BUTTON_OUTLINE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-white px-3.5 py-2 text-xs font-bold text-[#222325] cursor-pointer transition-colors hover:border-[#222325] disabled:opacity-40 disabled:pointer-events-none";

export const BUTTON_DANGER =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#c0392b]/35 bg-white px-3.5 py-2 text-xs font-bold text-[#b23c26] cursor-pointer transition-colors hover:border-[#b23c26] hover:bg-[#fdeae6]";

export interface SettingsSectionProps {
  title: string;
  description?: string;
  /** Right-aligned control in the section header, e.g. a Save button. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Red-tinted framing for irreversible actions. */
  danger?: boolean;
}

export const SettingsSection: FC<SettingsSectionProps> = ({ title, description, action, children, className, danger }) => (
  <section className={cn(CARD, danger && "border-[#c0392b]/25", className)}>
    <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
      <div className="min-w-0">
        <h2 className={cn("text-sm font-bold", danger ? "text-[#b23c26]" : "text-primary")}>{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-black/50">{description}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
    <div className="px-5 py-4">{children}</div>
  </section>
);

export interface SettingsRowProps {
  label: string;
  hint?: ReactNode;
  /** The control. Sits right on wide rows, below the label on stacked ones. */
  children: ReactNode;
  /** Puts the control under the label instead of beside it — for inputs. */
  stacked?: boolean;
  htmlFor?: string;
  className?: string;
}

export const SettingsRow: FC<SettingsRowProps> = ({ label, hint, children, stacked, htmlFor, className }) => (
  <div
    className={cn(
      "border-b border-black/8 py-3.5 first:pt-0 last:border-b-0 last:pb-0",
      stacked ? "" : "flex items-center justify-between gap-6",
      className
    )}>
    <div className={cn("min-w-0", stacked && "mb-2")}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-primary">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-black/45">{hint}</p>}
    </div>
    <div className={cn(stacked ? "" : "flex-none")}>{children}</div>
  </div>
);

/**
 * Neobrutalist switch. Rendered as a real `<button role="switch">` so it is
 * keyboard-operable and announces its state, rather than a styled div.
 */
export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

export const Toggle: FC<ToggleProps> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative inline-flex h-6 w-11 flex-none items-center rounded-full border-[1.5px] border-[#222325] cursor-pointer",
      "transition-[background-color,box-shadow,transform] duration-100 ease-out",
      "shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
      "disabled:opacity-40 disabled:pointer-events-none",
      checked ? "bg-[#e1f073]" : "bg-white"
    )}>
    <span
      className={cn(
        "block h-4 w-4 rounded-full border-[1.5px] border-[#222325] bg-white transition-transform duration-150 ease-out",
        checked ? "translate-x-[22px]" : "translate-x-[3px]"
      )}
    />
  </button>
);

/** Segmented single-choice control for short option sets. */
export interface ChoiceProps<T extends string> {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}

export function Choice<T extends string>({ value, options, onChange, className }: ChoiceProps<T>) {
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#f0f0ea] p-1", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap",
            value === o.id ? "bg-[#222325] text-white" : "text-black/55 hover:text-primary"
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Removable tag list, for skills and target roles. */
export interface TagListProps {
  tags: string[];
  onRemove: (tag: string) => void;
  emptyNote?: string;
}

export const TagList: FC<TagListProps> = ({ tags, onRemove, emptyNote }) =>
  tags.length === 0 ? (
    <p className="text-xs text-black/45">{emptyNote ?? "Nothing added yet."}</p>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f0ea] py-1 pl-3 pr-1.5 text-xs font-semibold text-primary">
          {t}
          <button
            type="button"
            onClick={() => onRemove(t)}
            aria-label={`Remove ${t}`}
            className="grid h-4 w-4 place-content-center rounded-full text-black/40 transition-colors hover:bg-black/10 hover:text-primary cursor-pointer">
            ×
          </button>
        </span>
      ))}
    </div>
  );
