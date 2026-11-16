"use client";

import { useId, useState, type FC } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ConversionDay, OverviewDay, OverviewPrevious, Rates, Totals } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import TimeSeries, { type LineSeries } from "../charts/TimeSeries";
import { CONTEXT } from "../charts/palette";
import { Key } from "../charts/parts";
import { formatValue } from "../charts/scale";
import { HEADLINES, HEADLINE_KEYS, changeOf, headlineValue, seriesFor, type Change, type HeadlineKey } from "./metrics";

// The overview's top: four headline tiles (sent, click rate, upgrades and revenue from mail), each
// with its change against the previous window when the backend sends one, and one chart below. The
// tile you press picks the chart's series: a 2px line for this window and the previous window as a
// dashed gray line, one tooltip for both with each line's own date, the table view behind a toggle.

const TONE: Record<Change["tone"], string> = { better: "text-[#5b6b12]", worse: "text-[#b23c26]", same: "text-gray-500" };
const TONE_ICON: Record<Change["tone"], typeof Minus> = { better: ArrowUpRight, worse: ArrowDownRight, same: Minus };

const EMPTY: Record<HeadlineKey, string> = {
  sent: "No mail in this range yet.",
  clickRate: "No clicks in this range yet.",
  upgrades: "No upgrades credited to mail in this range yet.",
  revenue: "No revenue credited to mail in this range yet.",
};

const SHORT: Record<HeadlineKey, string> = { sent: "Sent", clickRate: "Click rate", upgrades: "Upgrades", revenue: "Revenue" };

const num = (value: unknown) => {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
};

/** A headline's figure: counts in full, rates as a percentage, money in dollars. */
const figure = (key: HeadlineKey, value: number) => {
  const unit = HEADLINES[key].unit;
  if (unit === "percent") return `${(value * 100).toFixed(value > 0 && value < 0.01 ? 2 : 1)}%`;
  return formatValue(value, unit);
};

const Headline: FC<{
  days: number;
  totals: Totals;
  rates: Rates;
  daily: OverviewDay[];
  previous?: OverviewPrevious;
  conversionsDaily?: ConversionDay[];
}> = ({ days, totals, rates, daily, previous, conversionsDaily }) => {
  const [picked, setPicked] = useState<HeadlineKey>("sent");
  const chartId = useId();
  const spec = HEADLINES[picked];
  const lines = seriesFor(picked, daily, previous, conversionsDaily);
  const series: LineSeries[] = [{ key: picked, label: SHORT[picked], color: spec.color, values: lines.current }];
  if (lines.previous) series.push({ key: "previous", label: `Previous ${days} days`, short: "Previous", color: CONTEXT, dashed: true, values: lines.previous, at: lines.previousDays ?? undefined });

  return (
    <div>
      <div role="group" aria-label="Headlines. Press one to chart it." className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {HEADLINE_KEYS.map((key) => {
          const value = headlineValue(key, totals, rates);
          const before = previous ? headlineValue(key, previous.totals, previous.rates) : null;
          const change = changeOf(key, value, before, days, key === "clickRate" && previous ? num(previous.totals?.delivered) : undefined);
          const on = key === picked;
          const Icon = change ? TONE_ICON[change.tone] : null;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              aria-controls={chartId}
              onClick={() => setPicked(key)}
              className={cn("flex min-w-0 flex-col items-start rounded-md bg-white px-4 py-3.5 text-left", on ? "br-shadow" : "br-plain-press")}>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                {on ? <Key color={HEADLINES[key].color} shape="line" /> : null}
                {HEADLINES[key].label}
              </span>
              <span className="mt-1 text-2xl font-bold">{figure(key, value)}</span>
              {change && Icon ? (
                <span className={cn("mt-1 inline-flex items-center gap-1 text-xs font-semibold", TONE[change.tone])}>
                  <Icon className="h-3.5 w-3.5 flex-none" aria-hidden />
                  {change.text}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <section id={chartId} aria-label={spec.chart} className="mt-3 rounded-md border border-gray-300 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold">{spec.chart}</h2>
        <TimeSeries key={picked} label={spec.chart} x={lines.x} series={series} unit={spec.unit} area={!lines.previous} height={240} empty={EMPTY[picked]} />
      </section>
    </div>
  );
};

export default Headline;
