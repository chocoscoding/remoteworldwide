"use client";

import { useState, type CSSProperties, type FC, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// The pieces every Outreach chart is built from: the series key, the legend, the tooltip, the
// table view (each chart's accessible twin), the empty state and arrow-key reading.

export type KeyShape = "line" | "dash" | "rect";

/** The small mark that names a series: a rect for bars and areas, a stroke for lines. */
export const Key: FC<{ color: string; shape?: KeyShape }> = ({ color, shape = "rect" }) =>
  shape === "rect" ? (
    <span aria-hidden className="inline-block h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: color }} />
  ) : (
    <svg aria-hidden width="16" height="6" className="flex-none">
      <line x1="1" x2="15" y1="3" y2="3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={shape === "dash" ? "3 3" : undefined} />
    </svg>
  );

export type LegendItem = { key: string; label: string; color: string; shape: KeyShape };

/** The legend: always there for two or more series. With `onToggle`, each entry shows or hides its series. */
export const Legend: FC<{ items: LegendItem[]; hidden?: readonly string[]; onToggle?: (key: string) => void; className?: string }> = ({ items, hidden = [], onToggle, className }) => (
  <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600", className)}>
    {items.map((item) => {
      const off = hidden.includes(item.key);
      const body = (
        <>
          <Key color={item.color} shape={item.shape} />
          <span className={cn(off && "line-through")}>{item.label}</span>
        </>
      );
      return (
        <li key={item.key}>
          {onToggle ? (
            <button
              type="button"
              aria-pressed={!off}
              title={off ? `Show ${item.label}` : `Hide ${item.label}`}
              onClick={() => onToggle(item.key)}
              className={cn("inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-gray-100", off && "opacity-50")}>
              {body}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-1 py-0.5">{body}</span>
          )}
        </li>
      );
    })}
  </ul>
);

/** Show or hide a series, never the last one shown. */
export function useHidden(allKeys: readonly string[]) {
  const [hidden, setHidden] = useState<string[]>([]);
  const toggle = (key: string) =>
    setHidden((current) => {
      if (current.includes(key)) return current.filter((k) => k !== key);
      const left = allKeys.filter((k) => k !== key && !current.includes(k));
      return left.length ? [...current, key] : current;
    });
  return [hidden, toggle] as const;
}

export type TipRow = { key: string; color: string; dashed?: boolean; value: string; label: string };

/**
 * One tooltip for every series at the pointer: the value leads, the series name follows. Placed
 * beside `x` (flipping left past the middle of `width`), or wherever `place` says.
 */
export const Tooltip: FC<{ x?: number; y?: number; width?: number; place?: CSSProperties; title: string; rows: TipRow[]; foot?: string }> = ({ x = 0, y = 4, width = 0, place, title, rows, foot }) => {
  const flip = x > width * 0.55;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute z-20 w-max min-w-[140px] max-w-[280px] rounded-md bg-white px-2.5 py-2 text-xs br-shadow"
      style={place ?? { left: x, top: y, transform: flip ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}>
      <p className="mb-1 font-semibold text-gray-500">{title}</p>
      {rows.length ? (
        <ul className="flex flex-col gap-0.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2">
              <Key color={r.color} shape={r.dashed ? "dash" : "line"} />
              <strong className="tabular-nums text-black">{r.value}</strong>
              <span className="min-w-0 truncate text-gray-500">{r.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {foot ? <p className={cn("text-gray-500", rows.length && "mt-1 border-t border-gray-200 pt-1")}>{foot}</p> : null}
    </div>
  );
};

/** The chart's numbers as a table, folded away under a small toggle. */
export const TableView: FC<{ caption: string; head: string[]; rows: string[][] }> = ({ caption, head, rows }) => (
  <details className="mt-2">
    <summary className="inline-block cursor-pointer select-none text-[11px] font-semibold text-gray-500 hover:text-black">Table view</summary>
    <div className="mt-2 max-h-64 overflow-auto rounded-md border border-gray-200">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-white">
          <tr>
            {head.map((h, i) => (
              <th key={`${h}-${i}`} scope="col" className={cn("border-b border-gray-200 px-2 py-1.5 font-semibold text-gray-500", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-gray-100 first:border-t-0">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-2 py-1 text-left font-normal text-gray-700">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="px-2 py-1 text-right tabular-nums">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);

/** Nothing to draw yet: the chart's height kept, a quiet line where the baseline would be. */
export const ChartEmpty: FC<{ height?: number; children: ReactNode }> = ({ height = 160, children }) => (
  <div className="flex flex-col" style={{ height }}>
    <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-gray-500">{children}</p>
    <div aria-hidden className="h-px w-full bg-gray-300" />
  </div>
);

/**
 * Which point the reader is on: set by the pointer, or by the arrow keys once the chart has focus
 * (Home and End jump to the ends). Leaving with the keyboard clears it.
 */
export function useActiveIndex(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!count) return;
    const moves: Record<string, (i: number) => number> = {
      ArrowRight: (i) => i + 1,
      ArrowDown: (i) => i + 1,
      ArrowLeft: (i) => i - 1,
      ArrowUp: (i) => i - 1,
      Home: () => 0,
      End: () => count - 1,
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setActive((current) => Math.min(count - 1, Math.max(0, move(current ?? count - 1))));
  };
  const keyProps = {
    tabIndex: 0,
    onKeyDown,
    onFocus: () => setActive((current) => current ?? Math.max(0, count - 1)),
    onBlur: () => setActive(null),
  };
  return { active: active !== null && active < count ? active : null, setActive, keyProps };
}

export const FOCUS_RING = "rounded-sm outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-black";
