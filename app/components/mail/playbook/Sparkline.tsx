"use client";

import { useState, type FC, type PointerEvent } from "react";

// A 30-day sparkline for a list row: one gray line, no axes, no legend. Hovering a day shows its
// count and date. The date is worked out in the pointer handler (the last value is today, UTC), so
// rendering stays pure and the server and browser draw the same markup.

const LINE = "#898781";
const DOT = "#222325";

const dayLabel = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

const Sparkline: FC<{ values: number[]; label: string; unit?: string; width?: number; height?: number }> = ({ values, label, unit = "entered", width = 112, height = 28 }) => {
  const [active, setActive] = useState<{ i: number; date: string } | null>(null);
  const count = values.length;
  if (!count) return <span className="text-xs text-gray-400">-</span>;

  const nums = values.map((v) => Math.max(0, Number(v) || 0));
  const max = Math.max(...nums);
  const pad = 2;
  const x = (i: number) => (count === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (count - 1));
  const y = (v: number) => (max > 0 ? height - pad - (v / max) * (height - pad * 2) : height - pad);
  const points = nums.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const total = nums.reduce((s, v) => s + v, 0);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const at = Math.round(((e.clientX - box.left) / Math.max(1, box.width)) * (count - 1));
    const i = Math.min(count - 1, Math.max(0, at));
    if (active?.i !== i) setActive({ i, date: dayLabel(count - 1 - i) });
  };

  return (
    <span className="relative inline-flex">
      <svg
        role="img"
        aria-label={`${label}: ${total.toLocaleString("en-GB")} in ${count} days, at most ${max.toLocaleString("en-GB")} a day`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block overflow-visible"
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}>
        <line x1={0} x2={width} y1={height - pad} y2={height - pad} stroke="#e5e7eb" strokeWidth={1} />
        <polyline points={points} fill="none" stroke={LINE} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {active ? <circle cx={x(active.i)} cy={y(nums[active.i])} r={2.5} fill={DOT} /> : null}
      </svg>
      {active ? (
        <span role="status" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] br-shadow">
          <strong className="tabular-nums">{nums[active.i].toLocaleString("en-GB")}</strong> {unit} <span className="text-gray-500">· {active.date}</span>
        </span>
      ) : null}
    </span>
  );
};

export default Sparkline;
