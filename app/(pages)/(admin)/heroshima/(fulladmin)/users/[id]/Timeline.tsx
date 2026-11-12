"use client";

import { useState, useTransition, type FC } from "react";
import { LoaderCircle } from "lucide-react";
import { getUserEvents, getUserMailEvents } from "@/libs/analytics-admin";
import { dateTime, type EventPage, type TrackEventView } from "@/app/lib/tracking/types";
import { MAIL_FILTER, shortLink, type MailTimelinePage, type MailTimelineRow } from "@/app/lib/mail/userMail";
import EventRow from "@/app/components/ADMIN/analytics/EventRow";

/** Visits are told apart by a gap this long between two rows, or a new tab's visit id. */
const GAP_MS = 30 * 60 * 1000;

type Item = { key: string; at: string } & ({ source: "track"; event: TrackEventView } | { source: "mail"; row: MailTimelineRow });

const time = (at: string) => Date.parse(at) || 0;

/** The oldest row loaded from a stream, or nothing when none is. */
const oldest = (rows: { at: string }[]) => (rows.length ? time(rows[rows.length - 1].at) : -Infinity);

/** One mail row: opened, clicked, visited from mail, a conversion credited to it. */
const MailRow: FC<{ row: MailTimelineRow }> = ({ row }) => {
  const link = row.link ? shortLink(row.link) : null;
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-gray-100 py-2 text-sm last:border-0">
      <time className="w-[128px] flex-none text-xs tabular-nums text-gray-500" dateTime={row.at}>
        {dateTime(row.at)}
      </time>
      <span className="flex-none rounded bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black ring-1 ring-inset ring-black">Outreach</span>
      <span className="min-w-0 break-words font-medium">{row.label}</span>
      {link && !row.label.includes(link) ? (
        <span className="text-xs text-gray-500" title={row.link ?? undefined}>
          → {link}
        </span>
      ) : null}
    </li>
  );
};

/**
 * A person's timeline, newest first, grouped into sittings, with "Show older" paging back through it.
 * With no filter, their mail rows (opened, clicked, visited from mail) are woven in by time; the
 * "Outreach" filter (`kind` = "mail") shows those alone. Two streams page separately, so a row is only
 * shown once nothing still to load from the other stream could be newer than it.
 */
const Timeline: FC<{
  userId: string;
  initial: EventPage;
  /** The first page of mail rows, when this view shows them; null when it doesn't or they couldn't be loaded. */
  mail?: MailTimelinePage | null;
  /** The mail rows were asked for and the backend refused. */
  mailFailed?: boolean;
  kind?: string;
  feature?: string;
}> = ({ userId, initial, mail = null, mailFailed = false, kind, feature }) => {
  const mailOnly = kind === MAIL_FILTER;
  const [items, setItems] = useState<TrackEventView[]>(mailOnly ? [] : initial.items);
  const [next, setNext] = useState<string | null>(mailOnly ? null : initial.next);
  const [mails, setMails] = useState<MailTimelineRow[]>(mail?.rows ?? []);
  const [mailNext, setMailNext] = useState<MailTimelinePage["next"]>(mail?.next ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const trackMore = next !== null;
  const mailMore = mailNext !== null && mailNext !== undefined;
  // Anything older than this could still have a newer row waiting in the other stream.
  const cutoff = Math.max(trackMore ? oldest(items) : -Infinity, mailMore ? oldest(mails) : -Infinity);

  const older = () =>
    startLoading(async () => {
      try {
        // Page the stream that holds the line back: the one whose oldest loaded row is the newest.
        if (trackMore && (!mailMore || oldest(items) >= oldest(mails))) {
          const page = await getUserEvents(userId, { before: next, kind: mailOnly ? undefined : kind, feature });
          setItems((current) => [...current, ...page.items]);
          setNext(page.next);
        } else if (mailMore) {
          const page = await getUserMailEvents(userId, { page: mailNext });
          setMails((current) => [...current, ...page.rows]);
          setMailNext(page.next ?? null);
        }
        setError(null);
      } catch {
        setError("Couldn't load older activity. Try again.");
      }
    });

  const merged: Item[] = [
    ...items.map((event): Item => ({ key: event.id, at: event.at, source: "track", event })),
    ...mails.map((row, i): Item => ({ key: `mail-${i}-${row.at}`, at: row.at, source: "mail", row })),
  ]
    .filter((item) => time(item.at) >= cutoff)
    .sort((a, b) => time(b.at) - time(a.at));

  const failedNote = mailFailed ? <p className="mb-2 text-xs text-[#b23c26]">Their mail rows couldn&apos;t be loaded{mailOnly ? "" : ", so only site activity shows"}.</p> : null;

  if (!merged.length && !trackMore && !mailMore) {
    return (
      <>
        {failedNote}
        {!(mailOnly && mailFailed) ? <p className="text-sm text-gray-500">{mailOnly ? "No mail activity yet." : `Nothing recorded${kind || feature ? " for this filter" : ""} yet.`}</p> : null}
      </>
    );
  }

  // Sittings: a run of rows with no long gap between them (web rows of one tab share a visit id; API rows have none).
  const groups: Item[][] = [];
  for (const item of merged) {
    const group = groups[groups.length - 1];
    const prev = group?.[group.length - 1];
    const split = !prev || time(prev.at) - time(item.at) > GAP_MS;
    if (split) groups.push([item]);
    else group.push(item);
  }

  return (
    <div>
      {failedNote}
      {groups.map((group) => {
        const start = group[group.length - 1].at;
        const end = group[0].at;
        const minutes = Math.max(1, Math.round((time(end) - time(start)) / 60_000));
        return (
          <div key={group[0].key} className="mb-4">
            <p className="sticky top-0 z-10 mb-1 bg-white py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
              {new Date(start).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {group.length} things ·
              about {minutes} min
            </p>
            <ol>{group.map((item) => (item.source === "track" ? <EventRow key={item.key} event={item.event} /> : <MailRow key={item.key} row={item.row} />))}</ol>
          </div>
        );
      })}
      {error ? <p className="text-sm text-[#b23c26]">{error}</p> : null}
      {trackMore || mailMore ? (
        <button type="button" onClick={older} disabled={loading} className="mt-2 inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-bold br-plain-press disabled:opacity-60">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Show older
        </button>
      ) : (
        <p className="mt-2 text-xs text-gray-500">
          {mailOnly ? "That's every mail event kept (mail events are kept for 400 days)." : "That's everything kept (activity is kept for 180 days)."}
        </p>
      )}
    </div>
  );
};

export default Timeline;
