"use client";

// The users screen's growth chart (/heroshima/users): new accounts per day, week or month as one row
// of columns (the total lives in the Accounts tile above, and in the readout and the table). A hover
// finds the nearest period and one readout gives its new accounts and the running total; arrow keys do
// the same from the keyboard, and "See the numbers" lists every period as a table. Plain SVG sized to
// its box, no chart library, in the admin's black and lime.

import { useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent, type PointerEvent } from "react";

export interface UsersGrowthChartProps {
  /** Every day of the range, oldest first (UTC, YYYY-MM-DD). */
  daily: { day: string; signups: number }[];
  /** Accounts that existed before the first day: where the line starts. */
  before: number;
}

type Grain = "day" | "week" | "month";
interface Period {
  /** The readout's and the table's name for it: "21 Nov 2026", "Week of 15 Nov", "Nov 2026". */
  label: string;
  /** The axis's name for it. */
  tick: string;
  signups: number;
  /** Accounts at the end of the period. */
  total: number;
}

const n = (value: number) => value.toLocaleString("en-GB");
const compact = (value: number) => (Math.abs(value) >= 10_000 ? `${Math.round(value / 1000)}K` : n(value));
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const fmt = (day: string, opts: Intl.DateTimeFormatOptions) => asDate(day).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

/** Days up to three months, weeks up to two years, months past that. */
const grainOf = (days: number): Grain => (days <= 92 ? "day" : days <= 730 ? "week" : "month");

const GRAIN_LABEL: Record<Grain, string> = { day: "Per day", week: "Per week", month: "Per month" };

/** The days grouped by the grain, the running total carried through. Weeks are counted back from today, so the last one ends today. */
function periodsOf(daily: UsersGrowthChartProps["daily"], before: number, grain: Grain): Period[] {
  const groups: { days: typeof daily }[] = [];
  if (grain === "day") for (const d of daily) groups.push({ days: [d] });
  else if (grain === "week") {
    for (let end = daily.length; end > 0; end -= 7) groups.unshift({ days: daily.slice(Math.max(0, end - 7), end) });
  } else {
    for (const d of daily) {
      const last = groups[groups.length - 1];
      if (last && last.days[0].day.slice(0, 7) === d.day.slice(0, 7)) last.days.push(d);
      else groups.push({ days: [d] });
    }
  }
  let total = before;
  return groups.map(({ days }) => {
    const signups = days.reduce((sum, d) => sum + d.signups, 0);
    total += signups;
    const first = days[0].day;
    if (grain === "day") return { label: fmt(first, { day: "numeric", month: "short", year: "numeric" }), tick: fmt(first, { day: "numeric", month: "short" }), signups, total };
    if (grain === "week") return { label: `Week of ${fmt(first, { day: "numeric", month: "short", year: "numeric" })}`, tick: fmt(first, { day: "numeric", month: "short" }), signups, total };
    return { label: fmt(first, { month: "long", year: "numeric" }), tick: fmt(first, { month: "short", year: "2-digit" }), signups, total };
  });
}

/** Round ticks covering [min, max], about `count` steps of 1, 2, 2.5 or 5 times a power of ten. */
function niceTicks(min: number, max: number, count: number): number[] {
  const span = Math.max(1, max - min);
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power);
  const lo = Math.floor(min / step) * step;
  let hi = Math.ceil(max / step) * step;
  if (hi === lo) hi = lo + step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** A column with its top corners rounded and its foot square on the baseline. */
const columnPath = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

// The plot's geometry, in px.
const LEFT = 44;
const RIGHT = 16;
const TOP = 24;
const COL_H = 112;
const AXIS_H = 22;
const HEIGHT = TOP + COL_H + AXIS_H;

const UsersGrowthChart: FC<UsersGrowthChartProps> = ({ daily, before }) => {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const grain = grainOf(daily.length);
  const periods = useMemo(() => periodsOf(daily, before, grain), [daily, before, grain]);

  if (!periods.length) return <p className="text-sm text-gray-500">No accounts yet.</p>;

  const plotW = Math.max(0, width - LEFT - RIGHT);
  const slot = plotW / periods.length;
  const cx = (i: number) => LEFT + slot * (i + 0.5);

  const colBase = TOP + COL_H;
  const colTicks = niceTicks(0, Math.max(1, ...periods.map((p) => p.signups)), 3);
  const colHi = colTicks[colTicks.length - 1];
  const colW = Math.max(1, Math.min(24, slot - 2));
  const last = periods.length - 1;

  // Five or so axis names, the last one always today's period.
  const every = Math.max(1, Math.ceil(periods.length / Math.max(2, Math.floor(plotW / 90))));
  const ticks = periods.map((_, i) => i).filter((i) => (last - i) % every === 0);

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect || !slot) return;
    setActive(Math.min(last, Math.max(0, Math.floor((event.clientX - rect.left - LEFT) / slot))));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key in moves) setActive((i) => Math.min(last, Math.max(0, (i ?? last) + moves[event.key])));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(last);
    else if (event.key === "Escape") setActive(null);
    else return;
    event.preventDefault();
  };

  const shown = active ?? null;
  const readout = shown === null ? null : periods[shown];
  const readoutLeft = shown === null ? 0 : cx(shown);
  const flip = readoutLeft > width * 0.62;

  return (
    <div>
      <div
        ref={box}
        tabIndex={0}
        role="group"
        aria-label={`Accounts over time, ${n(periods[last].total)} now. Left and right arrows read each period.`}
        onKeyDown={onKey}
        onFocus={() => setActive((i) => i ?? last)}
        onBlur={() => setActive(null)}
        className="relative rounded outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="block select-none overflow-visible" aria-hidden>
            {/* The hovered period, a lime band behind its column. */}
            {shown !== null && <rect x={cx(shown) - Math.max(colW, 8) / 2 - 3} y={TOP - 6} width={Math.max(colW, 8) + 6} height={colBase - TOP + 6} rx={4} fill="#e1f073" opacity={0.45} />}

            <text x={LEFT} y={10} className="fill-gray-500 text-[11px] font-semibold uppercase tracking-wide">
              {GRAIN_LABEL[grain]}
            </text>
            {colTicks.map((t) => (
              <g key={`c${t}`}>
                <line x1={LEFT} x2={LEFT + plotW} y1={colBase - (t / colHi) * COL_H} y2={colBase - (t / colHi) * COL_H} stroke={t ? "#ececec" : "#d4d4d4"} strokeWidth={1} />
                <text x={LEFT - 8} y={colBase - (t / colHi) * COL_H} dy="0.32em" textAnchor="end" className="fill-gray-500 text-[10px] tabular-nums">
                  {compact(t)}
                </text>
              </g>
            ))}
            {periods.map((p, i) => {
              if (!p.signups) return null;
              const h = Math.max(2, (p.signups / colHi) * COL_H);
              return <path key={i} d={columnPath(cx(i) - colW / 2, colBase - h, colW, h)} fill={i === shown ? "#5b6b12" : "#111"} />;
            })}

            {ticks.map((i) => (
              <text key={`t${i}`} x={cx(i)} y={colBase + 15} textAnchor={i === last ? "end" : i === 0 ? "start" : "middle"} className="fill-gray-500 text-[10px]">
                {periods[i].tick}
              </text>
            ))}

            {/* The pointer's target: the whole plot, so the reader aims at a date, never at a 2px line. */}
            <rect x={LEFT} y={0} width={plotW} height={colBase} fill="transparent" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} />
          </svg>
        )}

        {readout && (
          <div
            role="status"
            className="pointer-events-none absolute top-6 z-10 min-w-[150px] rounded-md bg-white px-3 py-2 text-xs br-shadow"
            style={flip ? { right: width - readoutLeft + 14 } : { left: readoutLeft + 14 }}>
            <p className="mb-1 font-semibold text-gray-500">{readout.label}</p>
            <p className="flex items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-black" />
              <strong className="text-sm tabular-nums">{readout.signups ? `+${n(readout.signups)}` : "0"}</strong>
              <span className="text-gray-500">new</span>
            </p>
            <p className="mt-0.5 text-gray-500">
              <span className="tabular-nums">{n(readout.total)}</span> accounts in total
            </p>
          </div>
        )}
      </div>

      <details className="group mt-2 text-sm">
        <summary className="w-fit cursor-pointer select-none text-xs font-semibold text-gray-500 hover:text-black hover:underline">See the numbers</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-500">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-semibold">
                  {grain === "day" ? "Day" : grain === "week" ? "Week" : "Month"}
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                  New
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                  Accounts
                </th>
              </tr>
            </thead>
            <tbody>
              {[...periods].reverse().map((p) => (
                <tr key={p.label} className="border-t border-gray-100">
                  <td className="px-3 py-1">{p.label}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{n(p.signups)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{n(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

export default UsersGrowthChart;
