"use client";

// Interview Prep — index (/dashboard/prep).
//
// Real routes back this feature (list -> /prep/[trackId] -> setup/live -> a
// session report at /prep/[trackId]/sessions/[sessionId]) rather than a
// single-page view-router, so a track or a report can be linked to directly.
// Track/session state itself lives in PrepProvider (mounted by layout.tsx),
// which survives navigation between these routes. Tracks are the user's own,
// saved in the backend; a new one is created before the page moves to it.

import { FC, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrep, type AddedTrack } from "./PrepProvider";
import PrepIndex from "@/app/components/dashboard/prep/PrepIndex";
import { TrackLoadError, TrackLoading } from "@/app/components/dashboard/prep/PrepTrackStates";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { announceTrackerChange } from "@/app/components/dashboard/prep/announceTrackerChange";
import type { CreatePrepTrackInput } from "@/app/lib/prep/types";

const PrepClient: FC = () => {
  const router = useRouter();
  const { tracks, status, error, retry, addTrack } = usePrep();
  // Lazy init so the clock is read once on mount, never during a re-render —
  // the react-hooks purity rule rejects Date reads in render.
  const [now] = useState(() => new Date());

  // Rejects with the server's refusal (the account cap, a link that is not
  // the user's), which the add dialog shows in place. A job that already has
  // a track answers with that track, and the page opens it all the same.
  async function handleAddTrack(input: CreatePrepTrackInput) {
    const { track, alreadyTracked, tracker }: AddedTrack = await addTrack(input);
    router.push(`/dashboard/prep/${track.id}`);
    // The dialog previewed this; the toast confirms what the server actually did.
    announceTrackerChange({ company: track.company, role: track.role, alreadyTracked, tracker }, () => router.push("/dashboard/tracker"));
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Interview prep</h1>
        <div className="flex flex-none items-center gap-4">
          <span className="text-xs text-black/40 hidden sm:block">Pick a track below, or jump straight into a practice format.</span>
          <NotificationBell />
        </div>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1320px] mx-auto">
        {status === "loading" ? (
          <TrackLoading bare />
        ) : status === "error" ? (
          <TrackLoadError bare error={error} onRetry={retry} />
        ) : (
          <PrepIndex
            tracks={tracks}
            now={now}
            onOpenTrack={(trackId) => router.push(`/dashboard/prep/${trackId}`)}
            onQuickPractice={(trackId, formats) =>
              router.push(`/dashboard/prep/${trackId}/setup${formats?.length ? `?format=${formats.join(",")}` : ""}`)
            }
            onAddTrack={handleAddTrack}
          />
        )}
      </main>
    </div>
  );
};

export default PrepClient;
