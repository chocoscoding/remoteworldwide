import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Small presentational pieces shared by the admin Outreach screens. No hooks, so server pages and
// client editors both use them. Light brutalism: hairlines, airy rows, hard shadows only through
// the br-* classes (app/globals.css), and only on what can be pressed.

export const INPUT = "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-black focus:outline-none";
export const INPUT_SM = "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-black focus:outline-none";
export const LABEL = "flex flex-col gap-1 text-xs font-semibold text-gray-600";

export const BTN_PRIMARY = "inline-flex items-center justify-center gap-2 rounded-md bg-[#e1f073] px-4 py-2 text-sm font-bold text-black br-plain-press disabled:opacity-60";
export const BTN = "inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-black br-plain-press disabled:opacity-60";
export const BTN_DANGER = "inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-[#b23c26] br-plain-press disabled:opacity-60";
export const BTN_LINK = "text-xs font-semibold text-gray-600 hover:text-black hover:underline disabled:opacity-60";

export const TABLE = "w-full text-left text-sm";
export const TH = "px-3 py-2 text-xs font-semibold text-gray-500";
export const TD = "px-3 py-2";
export const ROW = "border-t border-gray-200";

export const ErrorBox: FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
  <div role="alert" className={cn("rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-3 text-sm text-[#b23c26]", className)}>
    {children}
  </div>
);

export const Notice: FC<{ children: ReactNode; className?: string; tone?: "info" | "warn" }> = ({ children, className, tone = "info" }) => (
  <div className={cn("rounded-md border p-3 text-sm", tone === "warn" ? "border-[#e8d27a] bg-[#fdf7dc] text-[#6b5800]" : "border-gray-300 bg-gray-50 text-gray-700", className)}>{children}</div>
);

export const Empty: FC<{ children: ReactNode }> = ({ children }) => <p className="py-6 text-center text-sm text-gray-500">{children}</p>;

type Tone = "lime" | "dark" | "gray" | "red" | "amber" | "outline";
const TONES: Record<Tone, string> = {
  lime: "bg-[#e1f073] text-black",
  dark: "bg-black text-[#e1f073]",
  gray: "bg-gray-100 text-gray-600",
  red: "bg-[#fdeae6] text-[#b23c26]",
  amber: "bg-[#fdf7dc] text-[#6b5800]",
  outline: "border border-gray-300 bg-white text-gray-700",
};

export const Chip: FC<{ tone?: Tone; children: ReactNode; title?: string }> = ({ tone = "gray", children, title }) => (
  <span title={title} className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", TONES[tone])}>
    {children}
  </span>
);

const STATUS_TONE: Record<string, Tone> = {
  draft: "outline",
  scheduled: "amber",
  sending: "lime",
  testing: "lime",
  sent: "dark",
  paused: "amber",
  canceled: "gray",
  failed: "red",
  live: "lime",
  open: "lime",
  done: "gray",
  active: "lime",
  waiting: "amber",
  exited: "gray",
  holdout: "outline",
  ok: "lime",
  warn: "amber",
  pause: "red",
};

export const StatusChip: FC<{ status: string; label?: string }> = ({ status, label }) => <Chip tone={STATUS_TONE[status] ?? "gray"}>{label ?? status}</Chip>;

export const Field: FC<{ label: string; hint?: string; children: ReactNode; className?: string }> = ({ label, hint, children, className }) => (
  <label className={cn(LABEL, className)}>
    <span>{label}</span>
    {children}
    {hint ? <span className="font-normal text-gray-500">{hint}</span> : null}
  </label>
);

/** A row of mutually exclusive choices, like tabs. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap overflow-hidden rounded-md border border-gray-300 bg-white">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-bold disabled:opacity-60",
            i > 0 && "border-l border-gray-300",
            o.value === value ? "bg-black text-[#e1f073]" : "text-gray-700 hover:bg-gray-50",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pick any of a few values, as chips. */
export function ChipPicker<T extends string>({
  values,
  options,
  onChange,
  label,
}: {
  values: readonly T[];
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (values: T[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
            className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", on ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** An on/off switch. */
export const Switch: FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn("relative inline-flex h-6 w-11 flex-none items-center rounded-full border border-black transition-colors disabled:opacity-60", checked ? "bg-black" : "bg-white")}>
    <span className={cn("inline-block h-4 w-4 rounded-full transition-transform", checked ? "translate-x-6 bg-[#e1f073]" : "translate-x-1 bg-gray-400")} />
  </button>
);

/** A thin segmented bar (8px, rounded ends, a 2px gap between parts, no text): each part's width is its share of the sum. */
export const ShareBar: FC<{ parts: Array<{ label: string; value: number; color: string }> }> = ({ parts }) => {
  const total = parts.reduce((s, p) => s + (p.value || 0), 0);
  if (!total) return <div className="h-2 w-full rounded-full bg-gray-100" aria-label="No answers yet" />;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div role="img" aria-label={shown.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")} className="flex h-2 w-full gap-[2px]">
      {shown.map((p, i) => (
        <div
          key={p.label}
          className={cn("h-full min-w-[2px]", i === 0 && "rounded-l-full", i === shown.length - 1 && "rounded-r-full")}
          style={{ flexGrow: p.value, flexBasis: 0, background: p.color }}
          title={`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`}
        />
      ))}
    </div>
  );
};
