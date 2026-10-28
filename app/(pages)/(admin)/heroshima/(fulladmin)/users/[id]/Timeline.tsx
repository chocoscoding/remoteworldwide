"use client";

import { useState, useTransition, type FC } from "react";
import { LoaderCircle } from "lucide-react";
import { getUserEvents } from "@/libs/analytics-admin";
import type { EventPage, TrackEventView } from "@/app/lib/tracking/types";
import EventRow from "@/app/components/ADMIN/analytics/EventRow";

/** Visits are told apart by a gap this long between two rows, or a new tab's visit id. */
const GAP_MS = 30 * 60 * 1000;

/** A person's timeline, newest first, grouped into sittings, with "Show older" paging back through it. */
const Timeline: FC<{ userId: string; initial: EventPage; kind?: string; feature?: string }> = ({ userId, initial, kind, feature }) => {
  const [items, setItems] = useState<TrackEventView[]>(initial.items);
  const [next, setNext] = useState<string | null>(initial.next);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const older = () =>
    startLoading(async () => {
      try {
        const page = await getUserEvents(userId, { before: next, kind, feature });
        setItems((current) => [...current, ...page.items]);
        setNext(page.next);
        setError(null);
      } catch {
        setError("Couldn't load older activity. Try again.");
      }
    });

  if (!items.length) return <p className="text-sm text-gray-500">Nothing recorded{kind || feature ? " for this filter" : ""} yet.</p>;

  // Sittings: a run of rows with no long gap between them (web rows of one tab share a visit id; API rows have none).
  const groups: TrackEventView[][] = [];
  for (const event of items) {
    const group = groups[groups.length - 1];
    const prev = group?.[group.length - 1];
    const split = !prev || new Date(prev.at).getTime() - new Date(event.at).getTime() > GAP_MS;
    if (split) groups.push([event]);
    else group.push(event);
  }

  return (
    <div>
      {groups.map((group) => {
        const start = group[group.length - 1].at;
        const end = group[0].at;
        const minutes = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
        return (
          <div key={group[0].id} className="mb-4">
            <p className="sticky top-0 z-10 mb-1 bg-white py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
              {new Date(start).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {group.length} things ·
              about {minutes} min
            </p>
            <ol>
              {group.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ol>
          </div>
        );
      })}
      {error ? <p className="text-sm text-[#b23c26]">{error}</p> : null}
      {next ? (
        <button type="button" onClick={older} disabled={loading} className="mt-2 inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-bold br-plain-press disabled:opacity-60">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Show older
        </button>
      ) : (
        <p className="mt-2 text-xs text-gray-500">That&apos;s everything kept (activity is kept for 180 days).</p>
      )}
    </div>
  );
};

export default Timeline;
