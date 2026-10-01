// The week card — "this week" (or last week) in one shareable picture:
// Applied / Interviews / Offer tiles and the streak, as the server counted
// them (`StreakWeekReport`). The same words go on the canvas, in the caption
// and, server-side, in the Monday mail (remoteworldwideevents
// userWeekReport.ts), so a change to one wording belongs in all three.

import type { StreakWeekReport } from "@/app/lib/streak/types";
import { trackedLink } from "./win";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** A `YYYY-MM-DD` key's day and month, read off the key itself — never through a Date, so no zone can move it. */
function partsOf(key: string): { day: number; month: string } {
  const [, m, d] = key.split("-").map(Number);
  return { day: d, month: MONTHS[(m - 1) % 12] ?? "" };
}

/** "21–27 Sep", or "29 Sep – 5 Oct" when the week crosses a month. A single day reads "29 Sep". */
export function weekRangeLabel(report: Pick<StreakWeekReport, "weekStart" | "weekEnd">): string {
  const from = partsOf(report.weekStart);
  const to = partsOf(report.weekEnd);
  if (report.weekStart === report.weekEnd) return `${from.day} ${from.month}`;
  return from.month === to.month ? `${from.day}–${to.day} ${to.month}` : `${from.day} ${from.month} – ${to.day} ${to.month}`;
}

/** The card's eyebrow, without the dates: the week it is, from where the user stands. */
export const weekEyebrow = (report: StreakWeekReport): string => (report.partial ? "This week" : "Last week");

/** The three tiles, in the card's order. */
export function weekTiles(report: StreakWeekReport): { n: number; label: string }[] {
  return [
    { n: report.applied, label: "Applied" },
    { n: report.interviews, label: plural(report.interviews, "Interview", "Interviews") },
    { n: report.offers, label: plural(report.offers, "Offer", "Offers") },
  ];
}

/** The line under the tiles: the streak while there is one, else the days that counted. */
export function weekStreakLine(report: StreakWeekReport): { flame: boolean; text: string } {
  if (report.streak > 0) return { flame: true, text: `${report.streak}-day streak` };
  return { flame: false, text: `${report.activeDays} active ${plural(report.activeDays, "day", "days")}` };
}

/** Whether a week has anything to put on a card. */
export const hasWeekToShare = (report: StreakWeekReport | null | undefined): report is StreakWeekReport =>
  Boolean(report && report.activeDays > 0);

/** "a, b and c". */
function listOf(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * The pre-written caption, with the user's invite link (per-platform UTM when
 * `utmSource` is given). Only the numbers that happened are named; a week of
 * prep and follow-ups with no new applications still has its days to show.
 */
export function weekCaption(report: StreakWeekReport, link: string, utmSource?: string): string {
  const parts: string[] = [];
  if (report.applied > 0) parts.push(`${report.applied} ${plural(report.applied, "application", "applications")}`);
  if (report.interviews > 0) parts.push(`${report.interviews} ${plural(report.interviews, "interview", "interviews")}`);
  if (report.offers > 0) parts.push(`${report.offers} ${plural(report.offers, "offer", "offers")}`);
  if (parts.length === 0) parts.push(`${report.activeDays} active ${plural(report.activeDays, "day", "days")}`);
  const streak = report.streak > 0 ? `, and a ${report.streak}-day streak \u{1F525}` : "";
  const when = report.partial ? "this week so far" : "last week";
  return (
    `My job search ${when}: ${listOf(parts)}${streak}. ` +
    `Tracking it all on Remote Worldwide — if you're searching too: ${trackedLink(link, utmSource, "weekcard")}`
  );
}
