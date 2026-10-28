import type { FC } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TRACK_KIND_LABELS, dateTime, type TrackEventView, type UserBrief } from "@/app/lib/tracking/types";

const KIND_STYLE: Record<string, string> = {
  page_view: "bg-gray-100 text-gray-700",
  click: "bg-[#e1f073] text-black",
  submit: "bg-[#e2ebf8] text-[#1c3d6e]",
  api: "bg-black text-[#e1f073]",
  session_start: "bg-[#fde3d8] text-[#8a3b1c]",
  custom: "bg-gray-100 text-gray-700",
};

/** The facts beside a row, in words: "→ /dashboard/tracker", "201 in 84 ms", "Chrome on Windows". */
const details = (e: TrackEventView): string[] => {
  const out: string[] = [];
  const p = e.props;
  if (typeof p.href === "string") out.push(`→ ${p.href}`);
  if (typeof p.region === "string") out.push(`in ${p.region}`);
  if (typeof p.checked === "boolean") out.push(p.checked ? "ticked" : "unticked");
  if (typeof p.status === "number") out.push(`${p.status}${typeof p.ms === "number" ? ` in ${p.ms} ms` : ""}`);
  if (typeof p.button === "string") out.push(`with “${p.button}”`);
  if (typeof p.referrer === "string" && p.referrer) out.push(`from ${p.referrer}`);
  if (typeof p.client === "string") out.push(p.client);
  return out;
};

/** One thing someone did, for a timeline or the overview's feed. `user` shows who, on the platform-wide feed. */
const EventRow: FC<{ event: TrackEventView; user?: UserBrief | null }> = ({ event, user }) => {
  const facts = details(event);
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-gray-100 py-2 text-sm last:border-0">
      <time className="w-[128px] flex-none text-xs tabular-nums text-gray-500" dateTime={event.at}>
        {dateTime(event.at)}
      </time>
      <span className={cn("flex-none rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", KIND_STYLE[event.kind])}>{TRACK_KIND_LABELS[event.kind]}</span>
      {user !== undefined ? (
        user ? (
          <Link href={`/heroshima/users/${user.id}`} className="max-w-[180px] flex-none truncate font-semibold hover:underline">
            {user.name || user.email || user.id}
          </Link>
        ) : (
          <span className="flex-none text-gray-500">Visitor</span>
        )
      ) : null}
      <span className="min-w-0 break-words font-medium">{event.name}</span>
      {event.kind !== "page_view" && event.path ? <span className="text-xs text-gray-500">on {event.path}</span> : null}
      <span className="text-xs text-gray-500">{event.feature}</span>
      {facts.length ? <span className="text-xs text-gray-500">{facts.join(" · ")}</span> : null}
    </li>
  );
};

export default EventRow;
