// The Outreach chart set: inline SVG and plain HTML, no chart library. Every chart takes plain,
// serialisable props (units instead of formatter functions), so server pages hand data straight in.

export { default as TimeSeries, type LineSeries, type TimeSeriesProps } from "./TimeSeries";
export { default as Bars, type BarSeries, type BarsProps } from "./Bars";
export { default as HBars, type HBarRow, type HBarsProps } from "./HBars";
export { default as Funnel, type FunnelStage, type FunnelProps } from "./Funnel";
export { default as Bullet, type BulletRow } from "./Bullet";
export { default as Sparkbars, type SparkRow, type SparkbarsProps } from "./Sparkbars";
export { default as FunnelTrend, type FunnelPoint } from "./FunnelTrend";
export { ChartEmpty, Legend, TableView } from "./parts";
export { CHROME, CONTEXT, CONVERSION, FACE, METRIC, SLOT, SOURCE, STATUS } from "./palette";
export { formatValue, groupByWeek, num, weekStart, xLabel, type Unit, type XKind } from "./scale";
