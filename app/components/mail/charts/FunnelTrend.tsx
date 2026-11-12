"use client";

import { useState, type FC } from "react";
import { Segmented } from "../ui";
import { METRIC } from "./palette";
import { num, type XKind } from "./scale";
import TimeSeries, { type LineSeries } from "./TimeSeries";

// The funnel measures over time with a Counts / Rates switch. Rates are of delivered in the same
// period (a period with nothing delivered is a gap, not zero), so delivered itself drops out there.
// Opens are an estimate, so their line is dashed.

export type FunnelPoint = { at: string; delivered: number; opened: number; clicked: number; converted: number };

const FunnelTrend: FC<{ label: string; points: FunnelPoint[]; xKind?: XKind; height?: number; empty?: string }> = ({ label, points, xKind = "day", height = 240, empty }) => {
  const [mode, setMode] = useState<"counts" | "rates">("counts");
  const x = points.map((p) => p.at);
  const of = (p: FunnelPoint, key: "opened" | "clicked" | "converted") => (num(p.delivered) > 0 ? num(p[key]) / num(p.delivered) : null);
  const rates = mode === "rates";
  const series: LineSeries[] = [
    ...(rates ? [] : [{ key: "delivered", label: "Delivered", color: METRIC.delivered, values: points.map((p) => num(p.delivered)) }]),
    { key: "opened", label: "Opened (estimate)", short: "Opened", color: METRIC.opened, dashed: true, values: points.map((p) => (rates ? of(p, "opened") : num(p.opened))) },
    { key: "clicked", label: "Clicked", color: METRIC.clicked, values: points.map((p) => (rates ? of(p, "clicked") : num(p.clicked))) },
    { key: "converted", label: "Converted", color: METRIC.converted, values: points.map((p) => (rates ? of(p, "converted") : num(p.converted))) },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented
          label="Show counts or rates"
          value={mode}
          onChange={setMode}
          options={[
            { value: "counts", label: "Counts" },
            { value: "rates", label: "Rates" },
          ]}
        />
        {rates ? <span className="text-[11px] text-gray-500">Share of what was delivered in the same {xKind === "hour" ? "hour" : "day"}</span> : null}
      </div>
      <TimeSeries key={mode} label={`${label}, ${rates ? "rates" : "counts"}`} x={x} xKind={xKind} series={series} unit={rates ? "percent" : "count"} height={height} empty={empty} />
    </div>
  );
};

export default FunnelTrend;
