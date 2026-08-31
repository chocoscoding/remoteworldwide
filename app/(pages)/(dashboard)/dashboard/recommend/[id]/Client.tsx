"use client";

import { FC, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, RotateCw } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import PipelineCard from "@/app/components/dashboard/recommend/PipelineCard";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";

/**
 * One recommendation, on its own page. The list keeps the headline; this is
 * where the stage tracker and Q&A actually live.
 *
 * The load is simulated — provider data is synchronous in this build — but
 * the states are real UI a fetch would need: a skeleton while loading, an
 * error card with retry when the entry can't be found. A real API call
 * replaces the timer and nothing else changes shape.
 */
export interface RecDetailClientProps {
  entryId: string;
}

/** Neobrutalist skeleton — flat pulse blocks in the card's own layout. */
const DetailSkeleton: FC = () => (
  <DashCard className="p-6" aria-busy="true" aria-label="Loading recommendation">
    <div className="flex items-center gap-3">
      <span className="h-11 w-11 flex-none animate-pulse rounded-full bg-black/[0.07]" />
      <div className="min-w-0 flex-1">
        <span className="block h-4 w-40 animate-pulse rounded bg-black/[0.07]" />
        <span className="mt-2 block h-3 w-56 animate-pulse rounded bg-black/[0.06]" />
      </div>
    </div>
    <span className="mt-6 block h-2 w-full animate-pulse rounded bg-black/[0.06]" />
    <span className="mt-6 block h-3.5 w-3/4 animate-pulse rounded bg-black/[0.06]" />
    <span className="mt-3 block h-24 w-full animate-pulse rounded-xl bg-black/[0.05]" />
    <span className="mt-5 block h-3.5 w-2/3 animate-pulse rounded bg-black/[0.06]" />
    <span className="mt-3 block h-24 w-full animate-pulse rounded-xl bg-black/[0.05]" />
  </DashCard>
);

const RecDetailClient: FC<RecDetailClientProps> = ({ entryId }) => {
  const { pipeline } = useNetwork();
  // Bumped by "Try again" — re-runs the (simulated) load from scratch.
  const [attempt, setAttempt] = useState(0);
  // Loading is DERIVED: we're loading whenever the finished marker doesn't
  // match the current entry+attempt. No setState in the effect body — the
  // timer callback is the only writer, which keeps the compiler's
  // set-state-in-effect rule satisfied and makes retry reset for free.
  const loadKey = `${entryId}:${attempt}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  // The timer stands in for the fetch; a real API call replaces it 1:1.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoadedKey(loadKey), 550);
    return () => window.clearTimeout(timer);
  }, [loadKey]);

  // Found-ness is decided at render time against live provider state, so
  // answering questions on this page never re-triggers the loading gate.
  const entry = pipeline.find((e) => e.id === entryId);

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <Link
          href="/dashboard/recommend"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-black/60 transition-colors hover:bg-black/[0.05] hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Recommendations
        </Link>
        {!loading && entry && (
          <>
            <span aria-hidden className="text-black/25">/</span>
            <h1 className="truncate text-[15px] font-bold text-primary">{entry.company}</h1>
          </>
        )}
      </header>

      <main className="mx-auto max-w-[760px] px-8 py-7 pb-14">
        {loading ? (
          <DetailSkeleton />
        ) : !entry ? (
          <DashCard className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdeae6]">
              <CircleAlert className="h-5 w-5 text-[#b23c26]" />
            </div>
            <p className="text-[15px] font-bold text-primary">We couldn&apos;t load this recommendation</p>
            <p className="mx-auto mt-1.5 max-w-[380px] text-sm leading-relaxed text-black/55">
              It may have been closed, or the link is stale. Your live recommendations are all on the main list.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2.5">
              <StickerButton variant="primary" size="md" onClick={() => setAttempt((n) => n + 1)}>
                <RotateCw className="h-4 w-4" />
                Try again
              </StickerButton>
              <Link
                href="/dashboard/recommend"
                className="rounded-lg px-3 py-2 text-xs font-semibold text-black/60 transition-colors hover:bg-black/[0.05] hover:text-primary">
                Back to recommendations
              </Link>
            </div>
          </DashCard>
        ) : (
          <PipelineCard entry={entry} />
        )}
      </main>
    </div>
  );
};

export default RecDetailClient;
