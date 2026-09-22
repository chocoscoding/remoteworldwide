"use client";

import { FC, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, RotateCw } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import PipelineCard from "@/app/components/dashboard/recommend/PipelineCard";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { BackendError } from "@/app/lib/api/core";
import { toPipelineEntry } from "@/app/lib/recommendations/view";
import { useRecommendation, useWarmPaths } from "@/hooks/queries/useRecommendationsQuery";

/**
 * One recommendation, on its own page. The list keeps the headline; this is
 * where the stage tracker, the reviewer's note and the Q&A actually live.
 *
 * Read from GET /api/recommendations/:id — opening on the list's cached copy
 * when there is one, so a click from the list paints at once. Someone else's
 * id reads exactly like a deleted one (404), and says so without a retry;
 * anything else that fails offers one.
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
  const query = useRecommendation(entryId);
  // Mapped once per fetch: the day counts are read off the clock here, not on every render.
  const entry = useMemo(() => (query.data ? toPipelineEntry(query.data) : undefined), [query.data]);
  const warmPathAt = useWarmPaths(entry ? [entry.company] : []);

  const gone = query.error instanceof BackendError && query.error.status === 404;

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <Link
          href="/dashboard/recommend"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-black/60 transition-colors hover:bg-black/[0.05] hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Recommendations
        </Link>
        {entry && (
          <>
            <span aria-hidden className="text-black/25">/</span>
            <h1 className="truncate text-[15px] font-bold text-primary">{entry.company}</h1>
          </>
        )}
        <NotificationBell className="ml-auto" />
      </header>

      <main className="mx-auto max-w-[760px] px-8 py-7 pb-14">
        {entry ? (
          <PipelineCard entry={entry} warmPath={warmPathAt(entry.company)} />
        ) : query.isPending ? (
          <DetailSkeleton />
        ) : (
          <DashCard className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdeae6]">
              <CircleAlert className="h-5 w-5 text-[#b23c26]" />
            </div>
            <p className="text-[15px] font-bold text-primary">{gone ? "This recommendation isn't here" : "We couldn't load this recommendation"}</p>
            <p className="mx-auto mt-1.5 max-w-[380px] text-sm leading-relaxed text-black/55">
              {gone
                ? "It may have been removed, or the link is stale. Your recommendations are all on the main list."
                : "Something went wrong on our side. Try again, or head back to the list."}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2.5">
              {!gone && (
                <StickerButton variant="primary" size="md" onClick={() => void query.refetch()}>
                  <RotateCw className="h-4 w-4" />
                  Try again
                </StickerButton>
              )}
              <Link
                href="/dashboard/recommend"
                className="rounded-lg px-3 py-2 text-xs font-semibold text-black/60 transition-colors hover:bg-black/[0.05] hover:text-primary">
                Back to recommendations
              </Link>
            </div>
          </DashCard>
        )}
      </main>
    </div>
  );
};

export default RecDetailClient;
