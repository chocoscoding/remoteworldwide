"use client";

// Home's follow-up line.
//
// It used to be a panel with three written drafts in it, which is the wrong
// place for them: the drafts belong on the tracker, beside the application they
// are about. What Home owes the user is the fact — these companies are waiting
// — in the smallest form that still gets read. So: one 12px marquee of the
// companies owed a nudge, and a button that goes where the work is.
//
// Reads the same board as the tracker, so a card closed there disappears from
// here on the next render.

import { type FC } from "react";
import Link from "next/link";
import { ArrowRight, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTracker } from "@/app/components/dashboard/tracker/TrackerProvider";
import { GHOST_AFTER_DAYS } from "@/app/components/dashboard/tracker/tracker-meta";
import { dueFollowUps } from "@/app/lib/dashboard/follow-up";

/** Below this the track is shorter than its rail, so scrolling it looks broken. */
const MARQUEE_MIN = 3;

const NeedsANudge: FC = () => {
  const { placed } = useTracker();
  const due = dueFollowUps(placed, GHOST_AFTER_DAYS);

  if (due.length === 0) return null;

  const items = due.map((d) => `${d.company} · silent ${d.daysSilent}d`);
  // The track is duplicated so the loop has something to scroll into; a short
  // list is repeated until it is long enough to cover the rail.
  const track = items.length >= MARQUEE_MIN ? items : Array.from({ length: Math.ceil(MARQUEE_MIN / items.length) }, () => items).flat();

  return (
    <div className="flex items-center gap-3 rounded-sm border border-black/15 bg-white px-3 py-2">
      <span className="grid h-6 w-6 flex-none place-content-center rounded-md bg-[#e1f073]">
        <BellRing className="h-3.5 w-3.5 text-primary" />
      </span>

      <p className="flex-none text-[11px] font-bold text-primary whitespace-nowrap">
        {due.length} {due.length === 1 ? "needs" : "need"} a nudge
      </p>

      {/* The marquee: a 12px rail, masked at both ends so items enter and
          leave rather than snapping. Paused on hover so a name can be read. */}
      <div className="group relative h-3 min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]">
        <div className="marquee-track absolute inset-y-0 left-0 flex items-center gap-6 whitespace-nowrap group-hover:[animation-play-state:paused]">
          {[...track, ...track].map((label, i) => (
            <span key={i} className={cn("text-[10px] font-semibold leading-3 text-black/55")}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <Link
        href="/dashboard/tracker"
        className="inline-flex h-7 flex-none items-center gap-1.5 rounded-md border-[1.5px] border-[#222325] bg-white px-2.5 text-[11px] font-bold text-primary transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#e1f073] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
        Nudge them
        <ArrowRight className="h-3 w-3 flex-none" />
      </Link>
    </div>
  );
};

export default NeedsANudge;
