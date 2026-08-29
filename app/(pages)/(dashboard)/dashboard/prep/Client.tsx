"use client";

// Interview Prep — index (/dashboard/prep).
//
// Real routes back this feature (list -> /prep/[trackId] -> setup/live -> a
// session report at /prep/[trackId]/sessions/[sessionId]) rather than a
// single-page view-router, so a track or a report can be linked to directly.
// Track/session state itself lives in PrepProvider (mounted by layout.tsx),
// which survives navigation between these routes.

import { FC, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrep } from "./PrepProvider";
import PrepIndex from "@/app/components/dashboard/prep/PrepIndex";

const PrepClient: FC = () => {
  const router = useRouter();
  const { tracks, addTrack } = usePrep();
  // Lazy init so the clock is read once on mount, never during a re-render —
  // the react-hooks purity rule rejects Date reads in render.
  const [now] = useState(() => new Date());

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Interview prep</h1>
        <span className="text-xs text-black/40 hidden sm:block">Pick a track below, or jump straight into a practice format.</span>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1240px] mx-auto">
        <PrepIndex
          tracks={tracks}
          now={now}
          onOpenTrack={(trackId) => router.push(`/dashboard/prep/${trackId}`)}
          onQuickPractice={(trackId, formats) => router.push(`/dashboard/prep/${trackId}/setup${formats?.length ? `?format=${formats.join(",")}` : ""}`)}
          onAddTrack={(input) => router.push(`/dashboard/prep/${addTrack(input).id}`)}
        />
      </main>
    </div>
  );
};

export default PrepClient;
