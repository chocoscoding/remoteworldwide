"use client";

// Insights — the funnel, and what it means.
//
// The diagnosis comes first and the chart second, deliberately. A stack of
// percentages is a report; the user came here to find out what to change, and
// making them derive that from five bars is work we should have done for them.
//
// Everything is computed from the live board, so this page cannot disagree
// with the tracker.

import { type FC } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import LogoMini from "@/app/components/svg/LogoMini";
import { useTracker } from "@/app/components/dashboard/tracker/TrackerProvider";
import { CLOSED_META, COLUMN_LABELS, COLUMN_META } from "@/app/components/dashboard/tracker/tracker-meta";
import { buildFunnel, diagnose } from "@/app/lib/dashboard/funnel";

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

const InsightsClient: FC = () => {
  const { placed, closed } = useTracker();
  const funnel = buildFunnel(placed, closed);
  const diagnosis = diagnose(funnel);
  const widest = Math.max(...funnel.stages.map((s) => s.reached), 1);

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 h-16 flex items-center gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Insights</h1>
        <p className="truncate text-xs text-black/45">Where your applications actually go.</p>
      </header>

      <main className="mx-auto w-full max-w-[1000px] px-8 py-7 pb-14">
        {/* The read, before the numbers. */}
        <DashCard className="border-2 border-[#222325] p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#e1f073]">
              <Sparkles className="h-4 w-4 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">What this says</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-primary">{diagnosis}</p>
            </div>
          </div>
        </DashCard>

        {/* The funnel */}
        <DashCard className="mt-5 p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-bold text-primary">Your funnel</p>
            <p className="text-xs text-black/45">
              {funnel.total} applications tracked · {funnel.open} open, {funnel.closed} closed
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {funnel.stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-3">
                <span className="w-[104px] flex-none text-xs font-semibold text-black/60">{COLUMN_LABELS[stage.id]}</span>
                <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-md bg-black/[0.05]">
                  <div
                    className={cn("h-full rounded-md transition-[width] duration-500", COLUMN_META[stage.id].dot)}
                    // Runtime proportion — no static Tailwind equivalent, same
                    // exception the ScoreRing and the resume fit-scaler make.
                    style={{ width: `${Math.max(2, (stage.reached / widest) * 100)}%` }}
                  />
                </div>
                <span className="w-8 flex-none text-right text-sm font-bold tabular-nums text-primary">{stage.reached}</span>
                <span className="w-11 flex-none text-right text-[11px] font-semibold tabular-nums text-black/45">
                  {pct(stage.conversion)}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3.5 text-[11px] leading-relaxed text-black/40">
            Counts every application that ever reached a stage, including ones that later closed — so a rejection after three
            interview rounds still counts as having reached Interviewing. The right-hand figure is the share of the previous
            stage that made it through.
          </p>
        </DashCard>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* How they ended */}
          <DashCard className="p-5">
            <p className="text-[15px] font-bold text-primary">How they ended</p>
            <p className="mt-0.5 text-xs text-black/45">{funnel.closed} closed applications.</p>
            {funnel.closures.length === 0 ? (
              <p className="mt-4 text-sm text-black/45">Nothing closed yet.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {funnel.closures.map(({ reason, n }) => {
                  const meta = CLOSED_META[reason];
                  return (
                    <div key={reason} className="flex items-center gap-3">
                      <span className={cn("inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", meta.pill)}>
                        <meta.icon className="h-3 w-3 flex-none" aria-hidden />
                        {meta.label}
                      </span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                        <div
                          className={cn("h-full rounded-full", meta.dot)}
                          style={{ width: `${(n / Math.max(funnel.closed, 1)) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 flex-none text-right text-sm font-bold tabular-nums text-primary">{n}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </DashCard>

          {/* Source comparison — the one split the board can honestly make. */}
          <DashCard className="p-5">
            <p className="text-[15px] font-bold text-primary">Where they came from</p>
            <p className="mt-0.5 text-xs text-black/45">Share that reached an interview.</p>
            <div className="mt-4 flex flex-col gap-3.5">
              {(
                [
                  { key: "rww", label: "Remote Worldwide", split: funnel.bySource.rww, badge: true },
                  { key: "elsewhere", label: "Everywhere else", split: funnel.bySource.elsewhere, badge: false },
                ] as const
              ).map(({ key, label, split, badge }) => (
                <div key={key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/60">
                      {badge && <LogoMini className="h-3.5 w-3.5 flex-none" />}
                      {label}
                    </span>
                    {/* A rate from three applications is an anecdote. Showing
                        it in the same bold type as one from thirty would invite
                        a real decision on noise, so it stays unstated. */}
                    <span className={cn("text-sm font-bold tabular-nums", split.reliable ? "text-primary" : "text-black/30")}>
                      {split.reliable ? pct(split.rate) : "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                    <div
                      className={cn("h-full rounded-full", !split.reliable ? "bg-black/10" : badge ? "bg-[#cddd54]" : "bg-black/25")}
                      style={{ width: `${(split.rate ?? 0) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-black/40">
                    {split.reachedInterview} of {split.applied} applications
                    {!split.reliable && " — too few to compare yet"}
                  </p>
                </div>
              ))}
            </div>
          </DashCard>
        </div>

        <Link
          href="/dashboard/tracker"
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-black/55 transition-colors hover:text-primary">
          Open the tracker
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </main>
    </div>
  );
};

export default InsightsClient;
