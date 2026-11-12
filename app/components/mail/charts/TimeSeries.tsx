"use client";

import type { FC, PointerEvent } from "react";
import { CHROME } from "./palette";
import { ChartEmpty, FOCUS_RING, Legend, TableView, Tooltip, useActiveIndex, useHidden } from "./parts";
import { X_HEADINGS, formatValue, niceTicks, textWidth, tickFormatter, tickIndices, xLabel, type Unit, type XKind } from "./scale";
import { useChartWidth } from "./useChartWidth";

// A line chart over time: one axis, 2px lines (dashed for an estimate), an area wash when one
// series stands alone, a crosshair that snaps to the nearest day with one tooltip for every series,
// arrow keys to read it, end labels when they don't collide, a legend that shows or hides a series,
// and the table view. Gaps (null) break the line instead of pretending to be zero.

export type LineSeries = {
  key: string;
  label: string;
  color: string;
  values: Array<number | null>;
  dashed?: boolean;
  /** A shorter name for the end label. */
  short?: string;
};

export type TimeSeriesProps = {
  /** The accessible name, e.g. "Mail delivered, opened, clicked and converted a day". */
  label: string;
  x: string[];
  xKind?: XKind;
  series: LineSeries[];
  unit?: Unit;
  /** A 10% wash under the line when one series is shown. */
  area?: boolean;
  /** The whole chart, x-axis band included. */
  height?: number;
  empty?: string;
  table?: boolean;
};

const PAD_T = 10;
const AXIS_H = 22;
const GAP_LABEL = 13;

const finite = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

const lastIndex = (values: Array<number | null>) => {
  for (let i = values.length - 1; i >= 0; i--) if (finite(values[i])) return i;
  return -1;
};

const TimeSeries: FC<TimeSeriesProps> = ({ label, x, xKind = "day", series, unit = "count", area = false, height = 220, empty = "Nothing in this range yet.", table = true }) => {
  const [ref, width] = useChartWidth();
  const [hidden, toggle] = useHidden(series.map((s) => s.key));
  const n = x.length;
  const { active, setActive, keyProps } = useActiveIndex(n);

  const hasData = n > 0 && series.some((s) => s.values.some((v) => finite(v) && v !== 0));
  if (!hasData) return <ChartEmpty height={height}>{empty}</ChartEmpty>;

  const shown = series.filter((s) => !hidden.includes(s.key));
  const single = shown.length === 1;
  const ticks = niceTicks(Math.max(0, ...shown.flatMap((s) => s.values.filter(finite))), unit);
  const top = ticks[ticks.length - 1] || 1;
  const fmtTick = tickFormatter(unit, ticks);
  const endText = (s: LineSeries) => {
    const i = lastIndex(s.values);
    return single ? (i >= 0 ? formatValue(s.values[i], unit) : "") : (s.short ?? s.label);
  };
  const withEnds = width >= 420;
  const padL = Math.ceil(Math.max(...ticks.map((t) => textWidth(fmtTick(t), 10)))) + 10;
  const padR = withEnds ? Math.min(110, Math.ceil(Math.max(0, ...shown.map((s) => textWidth(endText(s), 11)))) + 14) : 12;
  const plotW = Math.max(40, width - padL - padR);
  const plotH = Math.max(40, height - PAD_T - AXIS_H);
  const baseY = PAD_T + plotH;
  const xAt = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => PAD_T + plotH * (1 - Math.min(v, top) / top);

  const segments = (values: Array<number | null>) => {
    const out: Array<Array<[number, number]>> = [];
    let run: Array<[number, number]> = [];
    values.forEach((v, i) => {
      if (finite(v)) run.push([xAt(i), yAt(v)]);
      else if (run.length) {
        out.push(run);
        run = [];
      }
    });
    if (run.length) out.push(run);
    return out;
  };
  const line = (seg: Array<[number, number]>) => seg.map(([px, py], j) => `${j ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");

  // End labels: the series name (or the value, for one series), placed top to bottom, skipping any that would collide.
  const ends: Array<{ key: string; y: number; text: string; x: number }> = [];
  if (withEnds) {
    const wanted = shown
      .map((s) => {
        const i = lastIndex(s.values);
        return i < 0 ? null : { key: s.key, y: yAt(s.values[i] as number), x: xAt(i), text: endText(s) };
      })
      .filter((e): e is { key: string; y: number; text: string; x: number } => Boolean(e))
      .sort((a, b) => a.y - b.y);
    for (const e of wanted) if (!ends.some((p) => Math.abs(p.y - e.y) < GAP_LABEL)) ends.push(e);
  }

  const labelEvery = tickIndices(n, plotW / (xKind === "hour" ? 96 : 62));
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / Math.max(1, box.width)) * width;
    const i = n === 1 ? 0 : Math.round(((px - padL) / plotW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  };

  const range = n > 1 ? `, ${xLabel(x[0], xKind, true)} to ${xLabel(x[n - 1], xKind, true)}` : "";

  return (
    <div>
      {series.length > 1 ? <Legend className="mb-2" items={series.map((s) => ({ key: s.key, label: s.label, color: s.color, shape: s.dashed ? "dash" : "line" }))} hidden={hidden} onToggle={toggle} /> : null}
      <div ref={ref} className="relative">
        <div {...keyProps} role="group" aria-label={`${label}. Use the arrow keys to read each point.`} className={FOCUS_RING}>
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" style={{ maxWidth: "100%", height: "auto" }} role="img" aria-label={`${label}${range}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={padL + plotW} y1={yAt(t)} y2={yAt(t)} stroke={t === 0 ? CHROME.axis : CHROME.grid} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={padL - 6} y={yAt(t) + 3.5} textAnchor="end" fontSize={10} fill={CHROME.text} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmtTick(t)}
                </text>
              </g>
            ))}
            {labelEvery.map((i) => (
              <text
                key={i}
                x={xAt(i)}
                y={height - 6}
                fontSize={10}
                fill={CHROME.text}
                textAnchor={n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                style={{ fontVariantNumeric: "tabular-nums" }}>
                {xLabel(x[i], xKind)}
              </text>
            ))}

            {single && area
              ? segments(shown[0].values)
                  .filter((seg) => seg.length > 1)
                  .map((seg, j) => (
                    <path key={`area-${j}`} d={`${line(seg)}L${seg[seg.length - 1][0].toFixed(1)},${baseY}L${seg[0][0].toFixed(1)},${baseY}Z`} fill={shown[0].color} fillOpacity={0.1} />
                  ))
              : null}
            {shown.map((s) => (
              <g key={s.key}>
                {segments(s.values).map((seg, j) =>
                  seg.length > 1 ? (
                    <path key={j} d={line(seg)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "5 4" : undefined} />
                  ) : (
                    <circle key={j} cx={seg[0][0]} cy={seg[0][1]} r={4} fill={s.color} stroke={CHROME.surface} strokeWidth={2} />
                  ),
                )}
              </g>
            ))}

            {ends.map((e) => (
              <text key={e.key} x={e.x + 7} y={e.y + 3.5} fontSize={11} fill={CHROME.label} style={{ fontVariantNumeric: "tabular-nums" }}>
                {e.text}
              </text>
            ))}

            {active !== null ? (
              <g aria-hidden>
                <line x1={xAt(active)} x2={xAt(active)} y1={PAD_T} y2={baseY} stroke={CHROME.crosshair} strokeWidth={1} shapeRendering="crispEdges" />
                {shown.map((s) =>
                  finite(s.values[active]) ? <circle key={s.key} cx={xAt(active)} cy={yAt(s.values[active] as number)} r={4} fill={s.color} stroke={CHROME.surface} strokeWidth={2} /> : null,
                )}
              </g>
            ) : null}

            <rect x={padL - 8} y={PAD_T} width={plotW + 16} height={plotH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)} />
          </svg>
        </div>
        {active !== null ? (
          <Tooltip
            x={xAt(active)}
            width={width}
            title={xLabel(x[active], xKind, true)}
            rows={shown.map((s) => ({ key: s.key, color: s.color, dashed: s.dashed, value: formatValue(s.values[active], unit), label: s.label }))}
          />
        ) : null}
      </div>
      {table ? (
        <TableView caption={label} head={[X_HEADINGS[xKind], ...series.map((s) => s.label)]} rows={x.map((xi, i) => [xLabel(xi, xKind, true), ...series.map((s) => formatValue(s.values[i], unit))])} />
      ) : null}
    </div>
  );
};

export default TimeSeries;
