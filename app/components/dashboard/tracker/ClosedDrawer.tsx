"use client";

// Where closed applications go.
//
// Deliberately NOT a sixth kanban column. Most applications end in rejection
// or silence, so a column would be the widest and saddest one on the board and
// would grow forever — the exact thing that makes people stop opening their
// tracker. They leave the board entirely and live here, one click away,
// counted but not staring at anyone.
//
// The counts are the point. "11 rejected, 4 ghosted" is the denominator every
// honest funnel number needs, and it only exists because closing is cheap.

import { useState, type FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import LogoMini from "@/app/components/svg/LogoMini";
import type { TrackerCard, TrackerClosedReason } from "@/app/lib/dashboard/types";
import { CLOSED_META, CLOSED_ORDER } from "./tracker-meta";

export interface ClosedDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: TrackerCard[];
  /** Puts a card back on the board, in the stage it left from. */
  onReopen: (cardId: string) => void;
}

/** "closed today" / "closed 4 days ago" — same relative voice as the board. */
function closedLabel(days: number | undefined): string {
  if (days === undefined) return "closed";
  if (days <= 0) return "closed today";
  if (days === 1) return "closed yesterday";
  return `closed ${days} days ago`;
}

const ClosedDrawer: FC<ClosedDrawerProps> = ({ open, onOpenChange, cards, onReopen }) => {
  // null = "all". Filtering is local to the drawer; nothing above it cares.
  const [filter, setFilter] = useState<TrackerClosedReason | null>(null);

  const counts = CLOSED_ORDER.map((reason) => ({
    reason,
    n: cards.filter((c) => c.closedReason === reason).length,
  })).filter((c) => c.n > 0);

  const shown = filter ? cards.filter((c) => c.closedReason === filter) : cards;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setFilter(null);
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-none items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">Closed applications</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-black/55">
                Every search produces more of these than offers. They&apos;re here so your numbers stay true — not to be dwelt on.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {counts.length > 0 && (
            <div className="flex flex-none flex-wrap gap-1.5 border-t border-black/10 px-6 py-3">
              <button
                type="button"
                onClick={() => setFilter(null)}
                className={cn(
                  "cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors",
                  filter === null ? "bg-[#222325] text-white" : "bg-black/[0.06] text-black/55 hover:text-primary",
                )}>
                All {cards.length}
              </button>
              {counts.map(({ reason, n }) => {
                const meta = CLOSED_META[reason];
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setFilter((v) => (v === reason ? null : reason))}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors",
                      filter === reason ? "bg-[#222325] text-white" : meta.pill,
                    )}>
                    <meta.icon className="h-3 w-3 flex-none" aria-hidden />
                    {meta.label} {n}
                  </button>
                );
              })}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto border-t border-black/10 scrollbar-neo">
            {shown.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-black/45">Nothing closed yet.</p>
            ) : (
              shown.map((card) => {
                const meta = card.closedReason ? CLOSED_META[card.closedReason] : null;
                return (
                  <div key={card.id} className="flex items-center gap-3 border-b border-black/8 px-6 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {card.rww && <LogoMini className="h-3.5 w-3.5 flex-none" />}
                        <span className="truncate text-xs font-semibold text-black/60">{card.company}</span>
                      </div>
                      <p className="truncate text-sm font-semibold text-primary">{card.title}</p>
                      <p className="mt-0.5 text-[11px] text-black/40">
                        {closedLabel(card.closedDaysAgo)}
                        {card.roundsReached ? ` · reached round ${card.roundsReached}` : ""}
                      </p>
                    </div>

                    {meta && (
                      <span className={cn("inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", meta.pill)}>
                        <meta.icon className="h-3 w-3 flex-none" aria-hidden />
                        {meta.label}
                      </span>
                    )}

                    {/* Closing is reversible — a company that goes quiet for six
                        weeks and then emails is common enough that a one-way
                        door here would cost people real opportunities. */}
                    <button
                      type="button"
                      onClick={() => onReopen(card.id)}
                      aria-label={`Reopen ${card.title} at ${card.company}`}
                      className="grid h-7 w-7 flex-none cursor-pointer place-content-center rounded-md text-black/35 transition-colors hover:bg-black/[0.06] hover:text-primary">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ClosedDrawer;
