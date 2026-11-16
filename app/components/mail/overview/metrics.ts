// Pure helpers for the Outreach overview: the four headlines and their change against the previous
// window, the daily series behind the main chart, the "What's working" ranking and the health words.
// No hooks and no JSX, so the server page and the client pieces share them.

import type { AlarmLevel, ConversionDay, MailAlarms, Overview, OverviewDay, OverviewPrevious, Rates, TableBy, TableRow, Totals } from "@/app/lib/mail/types";
import { CONVERSION, METRIC } from "../charts/palette";
import type { Unit } from "../charts/scale";

/* ----------------------------------------------------------------------------- headlines */

export type HeadlineKey = "sent" | "clickRate" | "upgrades" | "revenue";
export const HEADLINE_KEYS: readonly HeadlineKey[] = ["sent", "clickRate", "upgrades", "revenue"];

export const HEADLINES: Record<HeadlineKey, { label: string; chart: string; unit: Unit; color: string; change: "relative" | "points" }> = {
  sent: { label: "Sent", chart: "Mail sent a day", unit: "count", color: METRIC.sent, change: "relative" },
  clickRate: { label: "Click rate", chart: "Click rate a day, clicked of delivered", unit: "percent", color: METRIC.clicked, change: "points" },
  upgrades: { label: "Upgrades from mail", chart: "Upgrades credited to mail a day", unit: "count", color: CONVERSION.credited, change: "relative" },
  revenue: { label: "Revenue from mail", chart: "Revenue credited to mail a day", unit: "cents", color: CONVERSION.credited, change: "relative" },
};

const num = (value: unknown) => {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
};

/** A headline's value for a window: totals and rates as the backend sent them. */
export function headlineValue(key: HeadlineKey, totals: Partial<Totals> | undefined, rates: Partial<Rates> | undefined): number {
  if (key === "sent") return num(totals?.sent);
  if (key === "clickRate") return rates?.clicked !== undefined ? num(rates.clicked) : num(totals?.delivered) > 0 ? num(totals?.clicked) / num(totals?.delivered) : 0;
  if (key === "upgrades") return num(totals?.converted);
  return num(totals?.revenueCents);
}

/** Better, worse or the same: every headline here is better when it goes up. */
export type Change = { text: string; tone: "better" | "worse" | "same" };

/**
 * The change against the previous window: "+12% vs previous 30 d" for counts and money, "+0.8 pts"
 * for rates. Nothing to compare against (no previous window): null, and the tile shows no line.
 */
export function changeOf(key: HeadlineKey, current: number, previous: number | null, days: number, previousBase?: number): Change | null {
  if (previous === null || !Number.isFinite(previous)) return null;
  const vs = `vs previous ${days} d`;
  if (HEADLINES[key].change === "points") {
    // A rate with nothing delivered before has no meaning to compare against.
    if (previousBase !== undefined && previousBase <= 0) return { text: `Nothing delivered in the previous ${days} d`, tone: "same" };
    const pts = (current - previous) * 100;
    const rounded = Math.round(pts * 10) / 10;
    if (rounded === 0) return { text: `No change ${vs}`, tone: "same" };
    return { text: `${rounded > 0 ? "+" : "-"}${Math.abs(rounded).toFixed(1)} pts ${vs}`, tone: rounded > 0 ? "better" : "worse" };
  }
  if (previous <= 0) return current > 0 ? { text: `Up from 0 ${vs}`, tone: "better" } : { text: `No change ${vs}`, tone: "same" };
  const change = ((current - previous) / previous) * 100;
  const size = Math.abs(change);
  const shown = size >= 10 ? Math.round(size).toString() : (Math.round(size * 10) / 10).toString();
  if (Number(shown) === 0) return { text: `No change ${vs}`, tone: "same" };
  return { text: `${change > 0 ? "+" : "-"}${shown}% ${vs}`, tone: change > 0 ? "better" : "worse" };
}

type PrevDay = OverviewPrevious["daily"][number];

const rateOf = (part: unknown, whole: unknown): number | null => (num(whole) > 0 ? num(part) / num(whole) : null);

/** One day's value of a headline. Click rate is clicked of delivered, a gap (null) when nothing was delivered. */
function dayValue(key: HeadlineKey, d: OverviewDay | PrevDay, revenueFallback?: number): number | null {
  if (key === "sent") return num(d.sent);
  if (key === "clickRate") return rateOf(d.clicked, d.delivered);
  if (key === "upgrades") return num(d.converted);
  return d.revenueCents !== undefined && d.revenueCents !== null ? num(d.revenueCents) : num(revenueFallback);
}

/**
 * The main chart's two lines for a headline: this window a day and, when the backend sends it, the
 * previous window aligned by position (previous.daily[i] is `days` days before daily[i]), with its
 * own dates for the tooltip.
 */
export function seriesFor(key: HeadlineKey, daily: OverviewDay[], previous: OverviewPrevious | undefined, conversionsDaily: ConversionDay[] | undefined) {
  const valueByDay = new Map((conversionsDaily ?? []).map((c) => [c.day, num(c.valueCents)]));
  const x = daily.map((d) => d.day);
  const current = daily.map((d) => dayValue(key, d, valueByDay.get(d.day)));
  const prevDaily = previous?.daily ?? [];
  const prev = previous ? daily.map((_, i) => (prevDaily[i] ? dayValue(key, prevDaily[i]) : null)) : null;
  const prevDays = previous ? daily.map((_, i) => prevDaily[i]?.day ?? null) : null;
  return { x, current, previous: prev, previousDays: prevDays };
}

/* ----------------------------------------------------------------------------- what's working */

/** The three views of "What's working", in the order the segmented control shows them. */
export const WORKING_BYS = [
  { value: "template", label: "Mails" },
  { value: "playbook_step", label: "Playbooks" },
  { value: "campaign", label: "Campaigns" },
] as const satisfies ReadonlyArray<{ value: TableBy; label: string }>;
export type WorkingBy = (typeof WORKING_BYS)[number]["value"];

const OBJECT_ID = /[a-f\d]{24}/i;

/** Where a row of the analytics table opens: its campaign, playbook or template. Product mails open nowhere. */
export const hrefFor = (by: TableBy, id: string): string | null => {
  const oid = id.match(OBJECT_ID)?.[0];
  if (!oid) return null;
  if (by === "campaign") return `/heroshima/outreach/campaigns/${oid}`;
  if (by === "playbook_step") return `/heroshima/outreach/playbooks/${oid}`;
  if (by === "template") return `/heroshima/outreach/templates/${oid}`;
  return null;
};

/** Upgrades credited first, clicks as the tiebreak, then sent. */
export const rankRows = (rows: TableRow[]) =>
  [...rows].sort((a, b) => num(b.converted) - num(a.converted) || num(b.clicked) - num(a.clicked) || num(b.sent) - num(a.sent));

/** What the thin bar measures: upgrades when any row has one, else clicks. */
export const barMeasure = (rows: TableRow[]): "converted" | "clicked" => (rows.some((r) => num(r.converted) > 0) ? "converted" : "clicked");

/* ----------------------------------------------------------------------------- health */

export type Health = { level: AlarmLevel; text: string };

/** The alarm in words: which rate crossed which line, from the overview's rates and the settings limits. */
export function healthOf(alarms: Overview["alarms"] | undefined, limits: MailAlarms): Health {
  const level: AlarmLevel = alarms?.level === "warn" || alarms?.level === "pause" ? alarms.level : "ok";
  if (level === "ok") return { level, text: "Mail is healthy" };
  const complaints = num(alarms?.complaintRate);
  const bounces = num(alarms?.bounceRate);
  const over = (rate: number, line: number) => line > 0 && rate >= line;
  const names = (c: boolean, b: boolean) => (c && b ? "Complaints and bounces" : c ? "Complaints" : b ? "Bounces" : null);
  if (level === "pause") {
    const who = names(over(complaints, limits.complaintPause), over(bounces, limits.bouncePause));
    return { level, text: `${who ?? "Complaints or bounces"} at the pause line` };
  }
  const who = names(over(complaints, limits.complaintWarn), over(bounces, limits.bounceWarn));
  return { level, text: `${who ?? "Complaints or bounces"} over the warn line` };
}
