"use client";

// Insights — the funnel, and what it means.
//
// A dialog on the tracker rather than a page of its own: the numbers are a
// reading of the board, and asking someone to leave the board to find out what
// it says put a navigation step between the question and the answer.
//
// The diagnosis comes first and the chart second, deliberately. A stack of
// percentages is a report; the user opened this to find out what to change,
// and making them derive that from five bars is work we should have done.

import { type FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import LogoMini from "@/app/components/svg/LogoMini";
import { useTracker } from "@/app/components/dashboard/tracker/TrackerProvider";
import { CLOSED_META, COLUMN_LABELS, COLUMN_META } from "@/app/components/dashboard/tracker/tracker-meta";
import { buildFunnel, diagnose } from "@/app/lib/dashboard/funnel";

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

export interface InsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InsightsDialog: FC<InsightsDialogProps> = ({ open, onOpenChange }) => {
  const { placed, closed } = useTracker();
  const funnel = buildFunnel(placed, closed);
  const diagnosis = diagnose(funnel);
  const widest = Math.max(...funnel.stages.map((s) => s.reached), 1);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-full max-w-[720px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-[1.5px] border-[#222325] bg-[#f6f6f6] shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 border-b border-black/10 bg-white px-6 py-5">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-bold text-primary">Insights</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-black/45">
                Where your applications actually go.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="px-6 py-5">
            {/* The read, before the numbers. */}
            <div className="rounded-xl border-2 border-[#222325] bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#e1f073]">
                  <Sparkles className="h-4 w-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">What this says</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-primary">{diagnosis}</p>
                </div>
              </div>
            </div>

            {/* The funnel, ending in the outcomes — the stages say how far
                applications got, the outcomes say how they stopped, and
                splitting those across two cards made the reader do the join. */}
            <div className="mt-5 rounded-xl border border-black/12 bg-white p-5">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-bold text-primary">Your funnel</p>
                <p className="text-xs text-black/45">
                  {funnel.total} tracked · {funnel.open} open, {funnel.closed} closed
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

              <div className="mt-4 border-t border-black/10 pt-4">
                <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">How they ended</p>
                {funnel.closures.length === 0 ? (
                  <p className="text-sm text-black/45">Nothing closed yet.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {funnel.closures.map(({ reason, n }) => {
                      const meta = CLOSED_META[reason];
                      return (
                        <div key={reason} className="flex items-center gap-3">
                          <span
                            className={cn(
                              "inline-flex w-[104px] flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
                              meta.pill,
                            )}>
                            <meta.icon className="h-3 w-3 flex-none" aria-hidden />
                            {meta.label}
                          </span>
                          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                            <div
                              className={cn("h-full rounded-full", meta.dot)}
                              style={{ width: `${(n / Math.max(funnel.closed, 1)) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 flex-none text-right text-sm font-bold tabular-nums text-primary">{n}</span>
                          <span className="w-11 flex-none text-right text-[11px] font-semibold tabular-nums text-black/45">
                            {pct(funnel.closed === 0 ? null : n / funnel.closed)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="mt-3.5 text-[11px] leading-relaxed text-black/40">
                Counts every application that ever reached a stage, including ones that later closed — so a rejection after three
                interview rounds still counts as having reached Interviewing. The right-hand figure is the share of the previous
                stage that made it through.
              </p>
            </div>

            {/* Source comparison — the one split the board can honestly make. */}
            <div className="mt-5 rounded-xl border border-black/12 bg-white p-5">
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
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default InsightsDialog;
