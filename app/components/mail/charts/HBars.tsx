"use client";

import { useState, type FC } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChartEmpty, Legend, TableView, Tooltip } from "./parts";
import { formatValue, num, type Unit } from "./scale";

// Horizontal bars, one row per name (links clicked, goals, actions, playbook steps), one or more
// series per row side by side. Plain HTML so long names wrap to the row and nothing is measured:
// the bars share one scale from a left baseline, square there and rounded at the data end, values
// at the tip when there are at most two series (the tooltip and table view carry the rest). The
// whole row is the hover and focus target.

/** `color` overrides a one-series chart's colour for this row (the emphasis form: one row in the accent, the rest gray). */
export type HBarRow = { key?: string; label: string; href?: string; values: number[]; sub?: string; color?: string };

export type HBarsProps = {
  label: string;
  rows: HBarRow[];
  series: Array<{ key: string; label: string; color: string }>;
  unit?: Unit;
  empty?: string;
  table?: boolean;
  /** A shared scale, when several lists should compare. */
  max?: number;
};

const THICK: Record<number, number> = { 1: 16, 2: 10, 3: 7 };

const HBars: FC<HBarsProps> = ({ label, rows, series, unit = "count", empty = "Nothing yet.", table = true, max }) => {
  const [active, setActive] = useState<number | null>(null);
  const top = Math.max(max ?? 0, ...rows.flatMap((r) => r.values.map(num)));
  if (!rows.length || top <= 0) return <ChartEmpty height={96}>{empty}</ChartEmpty>;

  const k = series.length;
  const thick = THICK[k] ?? 6;
  const tips = k <= 2;
  const colorOf = (row: HBarRow, j: number) => (k === 1 && row.color ? row.color : series[j].color);

  return (
    <div>
      {k > 1 ? <Legend className="mb-2" items={series.map((s) => ({ key: s.key, label: s.label, color: s.color, shape: "rect" }))} /> : null}
      <ul aria-label={label} className="flex flex-col" onPointerLeave={() => setActive(null)}>
        {rows.map((row, i) => {
          const on = active === i;
          const name = row.label || "(none)";
          return (
            <li
              key={row.key ?? `${row.label}-${i}`}
              tabIndex={row.href ? undefined : 0}
              aria-label={row.href ? undefined : `${name}: ${series.map((s, j) => `${s.label} ${formatValue(num(row.values[j]), unit)}`).join(", ")}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={cn(
                "relative grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 rounded px-1.5 py-1.5 outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-black",
                on && "bg-gray-50",
              )}>
              <div className="min-w-0">
                {row.href ? (
                  <Link href={row.href} className="block truncate text-sm hover:underline focus-visible:underline" title={name}>
                    {name}
                  </Link>
                ) : (
                  <span className="block truncate text-sm" title={name}>
                    {name}
                  </span>
                )}
                {row.sub ? <span className="block truncate text-[11px] text-gray-500">{row.sub}</span> : null}
              </div>
              <div className="flex min-w-0 flex-col gap-[2px]" aria-hidden>
                {series.map((s, j) => {
                  const v = num(row.values[j]);
                  return (
                    <div key={s.key} className="flex items-center gap-1.5" style={{ height: thick }}>
                      <span className="block h-full flex-none" style={{ width: `${(v / top) * 80}%`, minWidth: v > 0 ? 2 : 0, background: colorOf(row, j), borderRadius: "0 4px 4px 0" }} />
                      {tips ? <span className="whitespace-nowrap text-[11px] leading-none tabular-nums text-gray-700">{formatValue(v, unit)}</span> : null}
                    </div>
                  );
                })}
              </div>
              {on ? (
                <Tooltip
                  place={{ left: "40%", top: "100%", marginTop: 2 }}
                  title={name}
                  rows={series.map((s, j) => ({ key: s.key, color: colorOf(row, j), value: formatValue(num(row.values[j]), unit), label: s.label }))}
                  foot={row.sub}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {table ? <TableView caption={label} head={["Name", ...series.map((s) => s.label)]} rows={rows.map((r) => [r.label || "(none)", ...series.map((_, j) => formatValue(num(r.values[j]), unit))])} /> : null}
    </div>
  );
};

export default HBars;
