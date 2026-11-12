"use client";

import type { FC } from "react";
import { CHROME, CONTEXT, SLOT } from "./palette";
import { ChartEmpty, FOCUS_RING, TableView, Tooltip, useActiveIndex } from "./parts";
import { X_HEADINGS, formatValue, num, xLabel, type Unit, type XKind } from "./scale";

// Sparkbars: a few small rows of columns on one shared scale (say sent, opened and clicked over 12
// weeks), each row named in text, so no legend. Bars wear the context gray and the latest period
// the accent. A slot is the full row height wide target; one tooltip lists every row for it.

export type SparkRow = { key: string; label: string; values: number[] };

export type SparkbarsProps = {
  label: string;
  x: string[];
  xKind?: XKind;
  rows: SparkRow[];
  unit?: Unit;
  empty?: string;
  table?: boolean;
};

const LABEL_W = 64;
const TOTAL_W = 52;

const Sparkbars: FC<SparkbarsProps> = ({ label, x, xKind = "week", rows, unit = "count", empty = "Nothing in this range yet.", table = true }) => {
  const n = x.length;
  const { active, setActive, keyProps } = useActiveIndex(n);
  const max = Math.max(0, ...rows.flatMap((r) => r.values.map(num)));
  if (!n || max <= 0) return <ChartEmpty height={56 + rows.length * 8}>{empty}</ChartEmpty>;

  const total = (r: SparkRow) => r.values.reduce((s, v) => s + num(v), 0);
  const columns = { gridTemplateColumns: `${LABEL_W}px minmax(0,1fr) ${TOTAL_W}px` };

  return (
    <div>
      <div className="relative" onPointerLeave={() => setActive(null)}>
        <div {...keyProps} role="group" aria-label={`${label}. Use the arrow keys to read each ${xKind === "week" ? "week" : "point"}.`} className={FOCUS_RING}>
          {rows.map((r) => (
            <div key={r.key} className="grid items-end gap-2 py-0.5" style={columns}>
              <span className="truncate text-xs text-gray-600">{r.label}</span>
              <div className="flex h-7 items-end gap-[2px]" aria-hidden>
                {r.values.map((raw, i) => {
                  const v = num(raw);
                  return (
                    <span key={i} className="flex h-full min-w-0 flex-1 items-end justify-center" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
                      <span
                        className="block w-full max-w-[24px] rounded-t-[2px]"
                        style={{
                          height: v > 0 ? `${Math.max(10, (v / max) * 100)}%` : 2,
                          background: v > 0 ? (i === n - 1 ? SLOT[0] : CONTEXT) : CHROME.empty,
                          opacity: active !== null && active !== i ? 0.45 : 1,
                        }}
                      />
                    </span>
                  );
                })}
              </div>
              <span className="text-right text-xs font-semibold tabular-nums">{formatValue(total(r), unit)}</span>
            </div>
          ))}
          <div className="grid gap-2" style={columns} aria-hidden>
            <span />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{xLabel(x[0], xKind)}</span>
              {n > 1 ? <span>{xLabel(x[n - 1], xKind)}</span> : null}
            </div>
            <span className="text-right text-[10px] text-gray-500">total</span>
          </div>
        </div>
        {active !== null ? (
          <Tooltip
            place={{ left: `calc(${LABEL_W + 8}px + (100% - ${LABEL_W + TOTAL_W + 16}px) * ${(active + 0.5) / n})`, top: "100%", marginTop: 2, transform: "translateX(-50%)" }}
            title={xLabel(x[active], xKind, true)}
            rows={rows.map((r) => ({ key: r.key, color: active === n - 1 ? SLOT[0] : CONTEXT, value: formatValue(num(r.values[active]), unit), label: r.label }))}
          />
        ) : null}
      </div>
      {table ? <TableView caption={label} head={[X_HEADINGS[xKind], ...rows.map((r) => r.label)]} rows={x.map((xi, i) => [xLabel(xi, xKind, true), ...rows.map((r) => formatValue(num(r.values[i]), unit))])} /> : null}
    </div>
  );
};

export default Sparkbars;
