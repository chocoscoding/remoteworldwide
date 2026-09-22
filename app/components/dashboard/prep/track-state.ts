import { differenceInCalendarDays, format as formatDate } from "date-fns";
import type { PrepTrack } from "@/app/lib/dashboard/prep-data";
import { currentRound } from "@/app/lib/prep/tracks";
import type { ChipTone } from "./Chip";

/**
 * The one place a track's status becomes a label + a colour, so the index
 * list and the track hub can never drift into saying different things about
 * the same track.
 */
export interface TrackState {
  label: string;
  tone: ChipTone;
  /** The label says WHEN the round is, so every surface can lead it with a clock — and none can decide for itself which labels those are. */
  timed: boolean;
}

export function trackState(track: PrepTrack, now: Date): TrackState {
  if (track.status === "closed") {
    if (track.outcome === "offer") return { label: "Offer", tone: "green", timed: false };
    if (track.outcome === "rejected") return { label: "Didn't move forward", tone: "red", timed: false };
    return { label: "Closed", tone: "white", timed: false };
  }
  if (track.status === "awaiting-outcome") return { label: "Awaiting outcome", tone: "red", timed: false };
  if (track.status === "not-started") return { label: "Not started", tone: "white", timed: false };

  // Through the last round with the next one not added yet: its date is in
  // the past, and "Overdue" would be exactly wrong.
  const round = track.saved ? currentRound(track.saved.rounds) : null;
  if (round?.outcome === "passed") return { label: "Next round not booked", tone: "white", timed: false };

  if (track.roundDate) {
    const days = differenceInCalendarDays(new Date(track.roundDate), now);
    // Derived from a past date, but it asks for an outcome rather than naming
    // a time — a clock in front of it would read as the interview being AT
    // "how did it go".
    if (days < 0) return { label: "How did it go?", tone: "red", timed: false };
    if (days === 0) return { label: "Today", tone: "red", timed: true };
    if (days === 1) return { label: "Tomorrow", tone: "red", timed: true };
    if (days <= 7) return { label: `In ${days} days`, tone: "blue", timed: true };
    return { label: formatDate(new Date(track.roundDate), "d MMM"), tone: "blue", timed: true };
  }
  return { label: "Not booked yet", tone: "white", timed: false };
}

/** Full date for surfaces with room for it, e.g. the hub header. */
export function roundDateLabel(track: PrepTrack): string | null {
  if (!track.roundDate) return null;
  return formatDate(new Date(track.roundDate), "EEE d MMM");
}
