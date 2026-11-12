"use client";

import type { FC } from "react";
import { CHROME } from "./palette";
import { ChartEmpty, FOCUS_RING, Legend, TableView, Tooltip, useActiveIndex } from "./parts";
import { X_HEADINGS, formatValue, niceTicks, num, textWidth, tickFormatter, tickIndices, xLabel, type Unit, type XKind } from "./scale";
import { useChartWidth } from "./useChartWidth";

// Columns: grouped (series side by side), stacked (series on top of each other) or percent (each
// column a 100% split, for shares over time). Thin columns (at most 24px) with a 4px rounded data
// end and a square foot, a 2px surface gap between touching marks, one axis, the whole column as
// the hover target with one tooltip for every series, arrow keys, legend and table view.

export type BarSeries = { key: string; label: string; color: string; values: number[] };

export type BarsProps = {
  label: string;
  categories: string[];
  xKind?: XKind;
  series: BarSeries[];
  mode?: "grouped" | "stacked" | "percent";
  /** The unit of the values (percent mode still draws shares of each column). */
  unit?: Unit;
  height?: number;
  empty?: string;
  table?: boolean;
  /** What a column's total counts, for the tooltip: "answers" gives "12 answers". */
  totalLabel?: string;
};

const PAD_T = 10;
const AXIS_H = 22;
const GAP = 2;
const MAX_BAR = 24;

/** A column with a rounded top (the data end) and a square foot on the baseline. */
const colPath = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  const b = y + h;
  return `M${x},${b}L${x},${y + rr}Q${x},${y} ${x + rr},${y}L${x + w - rr},${y}Q${x + w},${y} ${x + w},${y + rr}L${x + w},${b}Z`;
};

const Bars: FC<BarsProps> = ({ label, categories, xKind = "day", series, mode = "grouped", unit = "count", height = 220, empty = "Nothing in this range yet.", table = true, totalLabel }) => {
  const [ref, width] = useChartWidth();
  const n = categories.length;
  const { active, setActive, keyProps } = useActiveIndex(n);
  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + Math.max(0, num(s.values[i])), 0));

  if (!n || !totals.some((t) => t > 0)) return <ChartEmpty height={height}>{empty}</ChartEmpty>;

  const percent = mode === "percent";
  const axisUnit: Unit = percent ? "percent" : unit;
  const ticks = percent ? [0, 0.25, 0.5, 0.75, 1] : niceTicks(mode === "stacked" ? Math.max(...totals) : Math.max(0, ...series.flatMap((s) => s.values.map(num))), unit);
  const top = ticks[ticks.length - 1] || 1;
  const fmtTick = tickFormatter(axisUnit, ticks);
  const padL = Math.ceil(Math.max(...ticks.map((t) => textWidth(fmtTick(t), 10)))) + 10;
  const padR = 8;
  const plotW = Math.max(40, width - padL - padR);
  const plotH = Math.max(40, height - PAD_T - AXIS_H);
  const baseY = PAD_T + plotH;
  const band = plotW / n;
  const hOf = (v: number) => (Math.max(0, v) / top) * plotH;

  const k = series.length;
  const groupGap = k > 1 && band * 0.8 >= k + (k - 1) * GAP ? GAP : 0;
  const groupBar = Math.max(1, Math.min(MAX_BAR, (band * 0.8 - (k - 1) * groupGap) / k));
  const stackBar = Math.max(1, Math.min(MAX_BAR, band * 0.7, band >= 3 ? band - GAP : band));

  const marks = categories.map((_, i) => {
    const left = padL + band * i;
    if (mode === "grouped") {
      const groupW = k * groupBar + (k - 1) * groupGap;
      const x0 = left + (band - groupW) / 2;
      return series.map((s, j) => {
        const v = num(s.values[i]);
        const h = hOf(v);
        return h > 0 ? <path key={s.key} d={colPath(x0 + j * (groupBar + groupGap), baseY - h, groupBar, h, 4)} fill={s.color} /> : null;
      });
    }
    const x = left + (band - stackBar) / 2;
    const total = totals[i];
    if (!total) return percent ? <rect key="none" x={x} y={baseY - 2} width={stackBar} height={2} fill={CHROME.empty} /> : null;
    const parts = series.map((s) => ({ s, v: Math.max(0, num(s.values[i])) })).filter((p) => p.v > 0);
    let y0 = baseY;
    return parts.map(({ s, v }, j) => {
      const h = percent ? (v / total) * plotH : hOf(v);
      const yTop = y0 - h;
      y0 = yTop;
      const last = j === parts.length - 1;
      const drawn = last ? h : h - GAP;
      if (drawn < 0.5) return null;
      return <path key={s.key} d={colPath(x, last ? yTop : yTop + GAP, stackBar, drawn, last ? 4 : 0)} fill={s.color} />;
    });
  });

  const maxChars = Math.max(3, Math.floor(band / 6.2));
  const fit = (text: string) => (xKind === "label" && text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text);
  const labelEvery = xKind === "label" ? tickIndices(n, plotW / Math.max(28, Math.min(band, 120))) : tickIndices(n, plotW / (xKind === "hour" ? 96 : 62));
  const centered = xKind === "label" || n < 8;

  const tipRows = (i: number) =>
    series.map((s) => {
      const v = num(s.values[i]);
      const value = percent ? `${formatValue(totals[i] ? v / totals[i] : 0, "percent")} (${formatValue(v, unit)})` : formatValue(v, unit);
      return { key: s.key, color: s.color, value, label: s.label };
    });
  const foot = (i: number) => {
    if (mode === "grouped") return undefined;
    if (!totals[i]) return totalLabel ? `No ${totalLabel}` : "Nothing";
    return totalLabel ? `${formatValue(totals[i], unit)} ${totalLabel}` : `Total ${formatValue(totals[i], unit)}`;
  };
  const range = n > 1 ? `, ${xLabel(categories[0], xKind, true)} to ${xLabel(categories[n - 1], xKind, true)}` : "";

  return (
    <div>
      {k > 1 ? <Legend className="mb-2" items={series.map((s) => ({ key: s.key, label: s.label, color: s.color, shape: "rect" }))} /> : null}
      <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
        <div {...keyProps} role="group" aria-label={`${label}. Use the arrow keys to read each column.`} className={FOCUS_RING}>
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" style={{ maxWidth: "100%", height: "auto" }} role="img" aria-label={`${label}${range}`}>
            {active !== null ? <rect x={padL + band * active} y={PAD_T} width={band} height={plotH} fill="#f3f4f6" /> : null}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={padL + plotW} y1={baseY - hOf(t)} y2={baseY - hOf(t)} stroke={t === 0 ? CHROME.axis : CHROME.grid} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={padL - 6} y={baseY - hOf(t) + 3.5} textAnchor="end" fontSize={10} fill={CHROME.text} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmtTick(t)}
                </text>
              </g>
            ))}
            {marks.map((m, i) => (
              <g key={categories[i] ?? i}>{m}</g>
            ))}
            {labelEvery.map((i) => {
              const cx = padL + band * (i + 0.5);
              const anchor = centered ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle";
              const tx = centered ? cx : i === 0 ? padL + band * i : i === n - 1 ? padL + band * (i + 1) : cx;
              return (
                <text key={i} x={tx} y={height - 6} fontSize={10} fill={CHROME.text} textAnchor={anchor} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fit(xLabel(categories[i], xKind))}
                </text>
              );
            })}
            {categories.map((_, i) => (
              <rect key={`hit-${i}`} x={padL + band * i} y={PAD_T} width={band} height={plotH} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
            ))}
          </svg>
        </div>
        {active !== null ? <Tooltip x={padL + band * (active + 0.5)} width={width} title={xLabel(categories[active], xKind, true)} rows={tipRows(active)} foot={foot(active)} /> : null}
      </div>
      {table ? (
        <TableView
          caption={label}
          head={[X_HEADINGS[xKind], ...series.map((s) => s.label), ...(mode === "grouped" ? [] : ["Total"])]}
          rows={categories.map((c, i) => [
            xLabel(c, xKind, true),
            ...series.map((s) => (percent ? `${formatValue(num(s.values[i]), unit)} (${formatValue(totals[i] ? num(s.values[i]) / totals[i] : 0, "percent")})` : formatValue(num(s.values[i]), unit))),
            ...(mode === "grouped" ? [] : [formatValue(totals[i], unit)]),
          ])}
        />
      ) : null}
    </div>
  );
};

export default Bars;
