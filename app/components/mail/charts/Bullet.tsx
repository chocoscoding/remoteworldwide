"use client";

import { useState, type FC } from "react";
import { CircleCheck, OctagonX, TriangleAlert } from "lucide-react";
import { STATUS } from "./palette";
import { TableView, Tooltip } from "./parts";

// Bullet bars: a rate against its warn and pause lines (complaints and bounces against the limits in
// Outreach settings). The fill wears the reserved status colour and always comes with an icon and a
// word, so the state never rests on colour alone. Warn's label reads to the left of its line and
// pause's to the right, so the two never run into each other.

export type BulletRow = { key: string; label: string; value: number; warn: number; pause: number };
type Level = keyof typeof STATUS;

const LEVEL: Record<Level, { word: string; Icon: typeof CircleCheck }> = {
  ok: { word: "Under warn", Icon: CircleCheck },
  warn: { word: "Over warn", Icon: TriangleAlert },
  pause: { word: "At pause", Icon: OctagonX },
};

const levelOf = (row: BulletRow): Level => (row.value >= row.pause ? "pause" : row.value >= row.warn ? "warn" : "ok");
const rate = (v: number, digits: number) => `${(v * 100).toFixed(digits)}%`;

const Bullet: FC<{ label: string; rows: BulletRow[]; digits?: number; table?: boolean }> = ({ label, rows, digits = 2, table = true }) => {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div>
      <ul aria-label={label} className="flex flex-col gap-4 sm:flex-row sm:gap-8" onPointerLeave={() => setActive(null)}>
        {rows.map((row, i) => {
          const level = levelOf(row);
          const { word, Icon } = LEVEL[level];
          const scale = Math.max(row.pause * 1.25, row.value * 1.1, 1e-6);
          const at = (v: number) => Math.min(100, (Math.max(0, v) / scale) * 100);
          const pos = (v: number) => `${at(v)}%`;
          // Squeezed to the left by a very high rate: one line of text under the start instead.
          const squeezed = at(row.warn) < 22;
          return (
            <li
              key={row.key}
              tabIndex={0}
              aria-label={`${row.label} ${rate(row.value, digits)}, ${word.toLowerCase()}. Warn at ${rate(row.warn, digits)}, pause at ${rate(row.pause, digits)}.`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="relative min-w-0 flex-1 rounded px-1 outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-black">
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs" aria-hidden>
                <span className="font-semibold">
                  {row.label} <span className="tabular-nums">{rate(row.value, digits)}</span>
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
                  <Icon className="h-3.5 w-3.5 self-center" style={{ color: STATUS[level] }} aria-hidden />
                  {word}
                </span>
              </div>
              <div className="relative h-8" aria-hidden>
                <div className="absolute inset-x-0 top-1.5 h-3 rounded-sm bg-gray-100" />
                <div className="absolute left-0 top-1.5 h-3" style={{ width: pos(row.value), minWidth: row.value > 0 ? 2 : 0, background: STATUS[level], borderRadius: "0 4px 4px 0" }} />
                <div className="absolute top-0 h-6 w-px bg-gray-500" style={{ left: pos(row.warn) }} />
                <div className="absolute top-0 h-6 w-px bg-[#222325]" style={{ left: pos(row.pause) }} />
                {squeezed ? (
                  <span className="absolute left-0 top-[22px] whitespace-nowrap text-[10px] tabular-nums text-gray-500">
                    warn {rate(row.warn, digits)} · pause {rate(row.pause, digits)}
                  </span>
                ) : (
                  <>
                    <span className="absolute top-[22px] -translate-x-full whitespace-nowrap pr-1 text-[10px] tabular-nums text-gray-500" style={{ left: pos(row.warn) }}>
                      warn {rate(row.warn, digits)}
                    </span>
                    <span className="absolute top-[22px] whitespace-nowrap pl-1 text-[10px] tabular-nums text-gray-700" style={{ left: pos(row.pause) }}>
                      pause {rate(row.pause, digits)}
                    </span>
                  </>
                )}
              </div>
              {active === i ? (
                <Tooltip
                  place={{ left: pos(row.value), top: "100%", marginTop: 2 }}
                  title={row.label}
                  rows={[
                    { key: "v", color: STATUS[level], value: rate(row.value, digits), label: word.toLowerCase() },
                    { key: "w", color: "#6b7280", value: rate(row.warn, digits), label: "warn line" },
                    { key: "p", color: "#222325", value: rate(row.pause, digits), label: "pause line" },
                  ]}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {table ? (
        <TableView
          caption={label}
          head={["Rate", "Now", "Warn at", "Pause at", "State"]}
          rows={rows.map((r) => [r.label, rate(r.value, digits), rate(r.warn, digits), rate(r.pause, digits), LEVEL[levelOf(r)].word])}
        />
      ) : null}
    </div>
  );
};

export default Bullet;
