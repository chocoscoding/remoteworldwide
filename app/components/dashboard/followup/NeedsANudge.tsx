"use client";

// Home's follow-up list.
//
// Sits above ProofOfProgress deliberately: that panel reports what came back,
// and this one is the single highest-leverage thing the user can do to make
// more of it come back. Both read the same board, so a card closed on the
// tracker disappears from here on the next render — the old failure mode of a
// reminder list quietly outliving the thing it reminded you about can't happen.

import { type FC } from "react";
import Link from "next/link";
import { ArrowRight, BellRing } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import { useTracker } from "@/app/components/dashboard/tracker/TrackerProvider";
import { GHOST_AFTER_DAYS } from "@/app/components/dashboard/tracker/tracker-meta";
import { dueFollowUps } from "@/app/lib/dashboard/follow-up";
import FollowUpNudge from "./FollowUpNudge";

/** Home shows the most-overdue few; the rest live on the tracker. */
const HOME_LIMIT = 3;

const NeedsANudge: FC = () => {
  const { placed } = useTracker();
  const due = dueFollowUps(placed, GHOST_AFTER_DAYS);

  // Nothing owed is a real state worth showing — it means the board is current.
  if (due.length === 0) {
    return (
      <DashCard className="p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
            <BellRing className="h-4 w-4 text-black/45" />
          </span>
          <div>
            <p className="text-sm font-bold text-primary">Nobody&apos;s waiting on you</p>
            <p className="text-xs text-black/50">Every open application has been touched recently.</p>
          </div>
        </div>
      </DashCard>
    );
  }

  const shown = due.slice(0, HOME_LIMIT);

  return (
    <DashCard className="p-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#e1f073]">
            <BellRing className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="text-sm font-bold text-primary">
              {due.length} {due.length === 1 ? "application needs" : "applications need"} a nudge
            </p>
            <p className="text-xs text-black/50">Written already — send, or copy and edit.</p>
          </div>
        </div>
        <Link
          href="/dashboard/tracker"
          className="inline-flex flex-none items-center gap-1 text-xs font-bold text-black/55 transition-colors hover:text-primary">
          Tracker
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        {shown.map((d) => (
          <FollowUpNudge key={d.cardId} due={d} dense />
        ))}
      </div>

      {due.length > shown.length && (
        <p className="mt-2.5 text-[11px] font-medium text-black/40">
          +{due.length - shown.length} more on the tracker
        </p>
      )}
    </DashCard>
  );
};

export default NeedsANudge;
