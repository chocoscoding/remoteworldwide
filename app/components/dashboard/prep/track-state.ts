import { differenceInCalendarDays, format as formatDate } from "date-fns";
import type { PrepTrack } from "@/app/lib/dashboard/prep-data";
import type { ChipTone } from "./Chip";

/**
 * The one place a track's status becomes a label + a colour, so the index
 * list and the track hub can never drift into saying different things about
 * the same track.
 */
export interface TrackState {
  label: string;
  tone: ChipTone;
}

export function trackState(track: PrepTrack, now: Date): TrackState {
  if (track.status === "closed") {
    if (track.outcome === "offer") return { label: "Offer", tone: "green" };
    if (track.outcome === "rejected") return { label: "Didn't move forward", tone: "red" };
    return { label: "Closed", tone: "white" };
  }
  if (track.status === "awaiting-outcome") return { label: "Awaiting outcome", tone: "red" };
  if (track.status === "not-started") return { label: "Not started", tone: "white" };

  if (track.roundDate) {
    const days = differenceInCalendarDays(new Date(track.roundDate), now);
    if (days < 0) return { label: "Overdue", tone: "red" };
    if (days === 0) return { label: "Today", tone: "red" };
    if (days === 1) return { label: "Tomorrow", tone: "red" };
    if (days <= 7) return { label: `In ${days} days`, tone: "blue" };
    return { label: formatDate(new Date(track.roundDate), "d MMM"), tone: "blue" };
  }
  return { label: "In progress", tone: "white" };
}

/** Full date for surfaces with room for it, e.g. the hub header. */
export function roundDateLabel(track: PrepTrack): string | null {
  if (!track.roundDate) return null;
  return formatDate(new Date(track.roundDate), "EEE d MMM");
}
