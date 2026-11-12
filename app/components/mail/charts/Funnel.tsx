"use client";

import { useState, type FC } from "react";
import { cn } from "@/lib/utils";
import { ChartEmpty, TableView, Tooltip } from "./parts";
import { formatValue, num } from "./scale";

// The funnel: each stage a bar on one left baseline, its width the stage's share of the first, the
// count at the tip and the rates under it (of the first stage and of the stage before). Each stage
// keeps its measure's colour from the other charts.

export type FunnelStage = { key: string; label: string; value: number; color: string };

export type FunnelProps = {
  label: string;
  stages: FunnelStage[];
  /** What the first stage is a share of, e.g. { label: "sent", value: 1200 }. */
  base?: { label: string; value: number };
  empty?: string;
  table?: boolean;
};

const share = (part: number, whole: number) => formatValue(whole > 0 ? part / whole : 0, "percent");

const Funnel: FC<FunnelProps> = ({ label, stages, base, empty = "Nothing delivered in this range yet.", table = true }) => {
  const [active, setActive] = useState<number | null>(null);
  const first = num(stages[0]?.value);
  if (!stages.length || first <= 0) return <ChartEmpty height={120}>{empty}</ChartEmpty>;
  const lower = (text: string) => text.replace(/\s*\(.*\)$/, "").toLowerCase();

  const rates = (i: number) => {
    const v = num(stages[i].value);
    if (i === 0) return base && base.value > 0 ? `${share(v, base.value)} of ${formatValue(base.value)} ${base.label}` : "";
    const ofFirst = `${share(v, first)} of ${lower(stages[0].label)}`;
    return i === 1 ? ofFirst : `${ofFirst} · ${share(v, num(stages[i - 1].value))} of ${lower(stages[i - 1].label)}`;
  };

  return (
    <div>
      <ol aria-label={label} className="flex flex-col gap-1" onPointerLeave={() => setActive(null)}>
        {stages.map((s, i) => {
          const v = num(s.value);
          const on = active === i;
          return (
            <li
              key={s.key}
              tabIndex={0}
              aria-label={`${s.label}: ${formatValue(v)}${rates(i) ? `, ${rates(i)}` : ""}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={cn(
                "relative grid grid-cols-[minmax(72px,104px)_minmax(0,1fr)] items-center gap-3 rounded px-1.5 py-1.5 outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-black",
                on && "bg-gray-50",
              )}>
              <span className="text-sm font-semibold">{s.label}</span>
              <div className="min-w-0" aria-hidden>
                <div className="flex items-center gap-2">
                  <span className="block h-5 flex-none" style={{ width: `${Math.min(1, v / first) * 80}%`, minWidth: v > 0 ? 2 : 0, background: s.color, borderRadius: "0 4px 4px 0" }} />
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{formatValue(v)}</span>
                </div>
                {rates(i) ? <p className="mt-0.5 truncate text-[11px] text-gray-500">{rates(i)}</p> : null}
              </div>
              {on ? (
                <Tooltip
                  place={{ left: "40%", top: "100%", marginTop: 2 }}
                  title={s.label}
                  rows={[
                    { key: "n", color: s.color, value: formatValue(v), label: lower(s.label) },
                    ...(i > 0 ? [{ key: "first", color: s.color, value: share(v, first), label: `of ${lower(stages[0].label)}` }] : []),
                    ...(i > 1 ? [{ key: "prev", color: s.color, value: share(v, num(stages[i - 1].value)), label: `of ${lower(stages[i - 1].label)}` }] : []),
                    ...(i === 0 && base && base.value > 0 ? [{ key: "base", color: s.color, value: share(v, base.value), label: `of ${base.label}` }] : []),
                  ]}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {table ? (
        <TableView
          caption={label}
          head={["Stage", "Count", `Of ${lower(stages[0].label)}`, "Of the stage before"]}
          rows={stages.map((s, i) => [s.label, formatValue(num(s.value)), share(num(s.value), first), i ? share(num(s.value), num(stages[i - 1].value)) : ""])}
        />
      ) : null}
    </div>
  );
};

export default Funnel;
