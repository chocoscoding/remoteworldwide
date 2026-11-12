// Pure helpers for the Outreach charts: value and tick formatting, nice axis steps, UTC day labels
// and grouping days into weeks. No Intl date formatting: the server render and the browser must
// print the same label, whatever their ICU data, or hydration complains.

export type Unit = "count" | "percent" | "cents";
export type XKind = "day" | "week" | "hour" | "label";

export const num = (value: unknown) => {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
};

const en = (value: number, digits = 0) => value.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: digits });

/** A value for a label, a tooltip or a table cell. Percent values are 0 to 1 rates. */
export function formatValue(value: number | null | undefined, unit: Unit = "count"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "None";
  if (unit === "percent") {
    const p = value * 100;
    return `${p.toFixed(p !== 0 && Math.abs(p) < 1 ? 2 : 1)}%`;
  }
  if (unit === "cents") return `$${(value / 100).toLocaleString("en-GB", { minimumFractionDigits: value % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
  return en(value, 1);
}

/** Round axis steps (1, 2, 2.5, 5 times a power of ten) from zero to just over `max`. */
export function niceTicks(max: number, unit: Unit, target = 4): number[] {
  const floor = unit === "percent" ? 0.01 : unit === "cents" ? 100 : 1;
  const top = max > 0 && Number.isFinite(max) ? max : floor;
  const raw = top / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const steps = unit === "count" ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = (steps.find((s) => norm <= s) ?? 10) * mag;
  if (unit === "count" && step < 1) step = 1;
  if (unit === "cents" && step < 1) step = 1;
  const count = Math.max(1, Math.ceil(top / step - 1e-9));
  return Array.from({ length: count + 1 }, (_, i) => Number((i * step).toPrecision(12)));
}

/** One label style per axis: in full under 10,000, compact (10K, 1.2M) on an axis that reaches it. */
export function tickFormatter(unit: Unit, ticks: number[]): (value: number) => string {
  const top = ticks[ticks.length - 1] ?? 0;
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : top;
  if (unit === "percent") {
    const sp = step * 100;
    const digits = sp >= 1 && Math.abs(sp - Math.round(sp)) < 1e-6 ? 0 : sp >= 0.1 ? 1 : 2;
    return (v) => `${(v * 100).toFixed(digits)}%`;
  }
  const scale = unit === "cents" ? 100 : 1;
  const prefix = unit === "cents" ? "$" : "";
  const max = top / scale;
  return (v) => {
    const x = v / scale;
    if (max >= 1_000_000) return `${prefix}${en(x / 1_000_000, 1)}M`;
    if (max >= 10_000) return `${prefix}${en(x / 1000, 1)}K`;
    return `${prefix}${en(x, 2)}`;
  };
}

/** About how wide a label is at a font size, for padding and collision checks. */
export const textWidth = (text: string, size = 11) => text.length * size * 0.6;

/** Which x positions get a label: the first, the last and evenly spaced ones between, at most `maxTicks`. */
export function tickIndices(n: number, maxTicks: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const m = Math.max(2, Math.min(n, Math.floor(maxTicks)));
  if (m >= n) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil((n - 1) / (m - 1));
  const out: number[] = [];
  for (let i = 0; i < n - 1; i += step) out.push(i);
  if (out.length > 1 && n - 1 - out[out.length - 1] < step * 0.6) out.pop();
  out.push(n - 1);
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parseDay = (x: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(x);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseHour = (x: string): Date | null => {
  let s = x.trim();
  if (/T\d{2}$/.test(s)) s += ":00";
  if (/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s += "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const shortDay = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const longDay = (d: Date) => `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const clock = (d: Date) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

/** An x value in words: "3 Nov" on the axis, "Mon 3 Nov 2026" in the tooltip and table. Days are UTC. */
export function xLabel(x: string, kind: XKind, long = false): string {
  if (kind === "label") return x;
  if (kind === "week") {
    const iso = /^(\d{4})-W(\d{1,2})$/.exec(x);
    if (iso) return long ? `Week ${Number(iso[2])}, ${iso[1]}` : `W${Number(iso[2])}`;
    const d = parseDay(x);
    return d ? (long ? `Week of ${longDay(d)}` : shortDay(d)) : x;
  }
  if (kind === "hour") {
    const d = parseHour(x);
    if (!d) return x;
    return long ? `${longDay(d)}, ${clock(d)} UTC` : `${shortDay(d)} ${clock(d)}`;
  }
  const d = parseDay(x);
  return d ? (long ? longDay(d) : shortDay(d)) : x;
}

export const X_HEADINGS: Record<XKind, string> = { day: "Day (UTC)", week: "Week", hour: "Hour (UTC)", label: "Name" };

/** The Monday (UTC) that starts a day's week, as YYYY-MM-DD. */
export function weekStart(day: string): string {
  const d = parseDay(day);
  if (!d) return day;
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

/** Days summed into Monday-start weeks, oldest first. */
export function groupByWeek<K extends string>(rows: ReadonlyArray<{ day: string } & Partial<Record<K, number>>>, keys: readonly K[]): Array<{ day: string } & Record<K, number>> {
  const weeks = new Map<string, Record<K, number>>();
  for (const row of rows) {
    const week = weekStart(row.day);
    const sum = weeks.get(week) ?? (Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>);
    for (const k of keys) sum[k] += num(row[k]);
    weeks.set(week, sum);
  }
  return [...weeks.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([day, sum]) => ({ day, ...sum }));
}
