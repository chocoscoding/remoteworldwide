import { addDays, set } from "date-fns";
import { Clock, Users, MessageSquare, Eye } from "lucide-react";
import { COLUMN_META } from "@/app/components/dashboard/tracker/tracker-meta";
import type { TrackerColumn, TrackerColumnId } from "@/app/lib/dashboard/types";
import type { ChipMetaResult, TrackerEvent, TrackerEventType } from "./tracker";

/**
 * Format a days-ago number into a human-readable label.
 * @param n - Number of days ago, or undefined
 * @returns Label string or null if undefined
 */
export function daysAgoLabel(n?: number): string | null {
  if (n === undefined) return null;
  if (n === 0) return "Today";
  return `${n} day${n === 1 ? "" : "s"} ago`;
}

/**
 * Map a card's free-text status chip to a Pill variant + leading icon.
 * @param chip - Status chip text
 * @returns Object with variant and icon
 */
export function chipMeta(chip: string): ChipMetaResult {
  if (chip.startsWith("Closes in")) return { variant: "urgent", icon: Clock };
  if (chip === "Referral available") return { variant: "positive", icon: Users };
  if (chip === "Follow up") return { variant: "neutral", icon: MessageSquare };
  if (chip.includes("Recruiter opened")) return { variant: "positive", icon: Eye };
  return { variant: "neutral", icon: Clock };
}

/**
 * Mapping of weekday names to numeric indices.
 */
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Parse a "... Thu 14:00 GMT+1" style chip into the next occurrence of that
 * weekday (today counts as a match) at that time, relative to `today`.
 * @param chip - Status chip containing weekday and time
 * @param today - Reference date (typically today's date)
 * @returns Parsed Date or null if no match
 */
export function parseInterviewDate(chip: string, today: Date): Date | null {
  const match = chip.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const targetDow = WEEKDAY_INDEX[match[1]];
  const diff = (targetDow - today.getDay() + 7) % 7;
  const day = addDays(today, diff);
  return set(day, { hours: Number(match[2]), minutes: Number(match[3]), seconds: 0, milliseconds: 0 });
}

/**
 * Parse a "Closes in N days" chip into a deadline date, relative to `today`.
 * @param chip - Status chip containing deadline info
 * @param today - Reference date (typically today's date)
 * @returns Parsed Date or null if no match
 */
export function parseDeadlineDate(chip: string, today: Date): Date | null {
  const match = chip.match(/^Closes in (\d+) day/);
  return match ? addDays(today, Number(match[1])) : null;
}

/**
 * Flatten every card across every column into calendar events.
 * Creates one saved/applied "activity" event from `daysAgo`, plus a deadline
 * and/or interview event when the status chip carries that info.
 * @param cols - Array of tracker columns
 * @param today - Reference date for relative calculations
 * @returns Array of tracker events
 */
export function buildTrackerEvents(cols: TrackerColumn[], today: Date): TrackerEvent[] {
  const events: TrackerEvent[] = [];
  for (const col of cols) {
    for (const card of col.cards) {
      if (card.daysAgo !== undefined) {
        events.push({
          id: `${card.id}-activity`,
          date: addDays(today, -card.daysAgo),
          cardId: card.id,
          company: card.company,
          title: card.title,
          type: col.id === "saved" ? "saved" : "applied",
          columnId: col.id,
          rww: card.rww,
        });
      }
      if (card.statusChip) {
        const deadlineDate = parseDeadlineDate(card.statusChip, today);
        if (deadlineDate) {
          events.push({
            id: `${card.id}-deadline`,
            date: deadlineDate,
            cardId: card.id,
            company: card.company,
            title: card.title,
            type: "deadline",
            columnId: col.id,
            rww: card.rww,
            detail: card.statusChip,
          });
        }

        const interviewDate = parseInterviewDate(card.statusChip, today);
        if (interviewDate) {
          events.push({
            id: `${card.id}-interview`,
            date: interviewDate,
            cardId: card.id,
            company: card.company,
            title: card.title,
            type: "interview",
            columnId: col.id,
            rww: card.rww,
            detail: card.statusChip,
          });
        }
      }
    }
  }
  return events;
}

/**
 * Event type metadata for display in calendar view.
 */
export const EVENT_TYPE_META: Record<TrackerEventType, { label: string; dot: string }> = {
  saved: { label: "Saved", dot: COLUMN_META.saved.dot },
  applied: { label: "Applied", dot: COLUMN_META.applied.dot },
  interview: { label: "Interview", dot: COLUMN_META.interviewing.dot },
  deadline: { label: "Deadline", dot: "bg-orange-500" },
};
