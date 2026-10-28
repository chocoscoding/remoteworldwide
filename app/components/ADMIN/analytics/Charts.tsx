import type { FC, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Small server-rendered pieces for the admin's users and activity screens: no chart library, just
// boxes sized by their share, so the pages stay plain HTML.

const n = (value: number) => value.toLocaleString("en-GB");

export const StatTile: FC<{ label: string; value: number | string; hint?: string; dark?: boolean }> = ({ label, value, hint, dark }) => (
  <div className={cn("rounded-md border p-4", dark ? "border-black bg-black text-white" : "border-gray-300 bg-white")}>
    <p className={cn("text-xs font-semibold uppercase tracking-wide", dark ? "text-[#e1f073]" : "text-gray-500")}>{label}</p>
    <p className="mt-1 text-2xl font-bold tabular-nums">{typeof value === "number" ? n(value) : value}</p>
    {hint ? <p className={cn("mt-0.5 text-xs", dark ? "text-white/60" : "text-gray-500")}>{hint}</p> : null}
  </div>
);

export const Panel: FC<{ title: string; children: ReactNode; className?: string; aside?: ReactNode }> = ({ title, children, className, aside }) => (
  <section className={cn("rounded-md border border-gray-300 bg-white p-4", className)}>
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-sm font-bold">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

/** A ranked list with a bar per row, its width the row's share of the biggest. */
export const BarList: FC<{
  rows: { label: string; value: number; sub?: string; href?: string }[];
  empty?: string;
}> = ({ rows, empty = "Nothing yet." }) => {
  if (!rows.length) return <p className="text-sm text-gray-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((row, i) => {
        const label = (
          <span className="relative z-10 min-w-0 truncate" title={row.label}>
            {row.label || "(none)"}
          </span>
        );
        return (
          <li key={`${row.label}-${i}`} className="relative flex items-center justify-between gap-3 overflow-hidden rounded px-2 py-1 text-sm">
            <span aria-hidden className="absolute inset-y-0 left-0 rounded bg-[#e1f073]/60" style={{ width: `${(row.value / max) * 100}%` }} />
            {row.href ? (
              <Link href={row.href} className="relative z-10 min-w-0 truncate hover:underline">
                {row.label}
              </Link>
            ) : (
              label
            )}
            <span className="relative z-10 flex-none tabular-nums text-gray-700">
              {n(row.value)}
              {row.sub ? <span className="ml-1.5 text-xs text-gray-500">{row.sub}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

/** One column per day, its height the day's share of the busiest; the hover title says the numbers. */
export const DayColumns: FC<{ days: { day: string; value: number; title?: string }[]; height?: number }> = ({ days, height = 120 }) => {
  const max = Math.max(...days.map((d) => d.value), 1);
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" title={d.title ?? `${d.day}: ${n(d.value)}`}>
            <div className={cn("w-full rounded-t-sm", d.value ? "bg-black group-hover:bg-[#5b6b12]" : "bg-gray-200")} style={{ height: `${Math.max(d.value ? 4 : 2, (d.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>{days[0]?.day}</span>
        <span>{days[days.length - 1]?.day}</span>
      </div>
    </div>
  );
};

export const TierBadge: FC<{ tier: string }> = ({ tier }) => (
  <span
    className={cn(
      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold capitalize",
      tier === "ultra" ? "bg-black text-[#e1f073]" : tier === "pro" ? "bg-[#e1f073] text-black" : tier === "basic" ? "border border-black bg-white text-black" : "bg-gray-100 text-gray-600",
    )}>
    {tier}
  </span>
);
