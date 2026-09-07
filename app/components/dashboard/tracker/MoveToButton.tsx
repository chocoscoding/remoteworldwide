"use client";

// "Move to Applied ▾" — the suggested move, with every other one behind the
// arrow.
//
// A plain button offered exactly one destination, which is right most of the
// time and useless the rest: an application that was never sent gets withdrawn,
// a saved job turns out to be filled. The arrow keeps the common move one tap
// away while putting the whole board — stages and outcomes — one more.

import { useEffect, useRef, useState, type FC } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackerStatus } from "@/app/lib/dashboard/types";
import { BOARD_ORDER, CLOSED_ORDER, STATUS_ORDER, isClosedStatus, statusMeta } from "./tracker-meta";

export interface MoveToButtonProps {
  /** Where the card is now — never offered as a destination. */
  current: TrackerStatus;
  /** The one-tap suggestion. Must not equal `current`. */
  suggested: TrackerStatus;
  onMove: (to: TrackerStatus) => void;
}

const MoveToButton: FC<MoveToButtonProps> = ({ current, suggested, onMove }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const destinations = BOARD_ORDER.filter((id) => id !== current);

  return (
    <div ref={wrapRef} className="relative inline-flex flex-none">
      {/* One control, two targets: the label commits the suggestion, the arrow
          opens the rest. Split with a divider rather than two buttons so it
          still reads as a single action. */}
      <div className="inline-flex items-stretch overflow-hidden rounded-lg bg-[#222325] text-white transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#e1f073]">
        <button
          type="button"
          onClick={() => onMove(suggested)}
          className="inline-flex h-8 cursor-pointer items-center gap-2 pl-3 pr-2.5 text-xs font-semibold whitespace-nowrap">
          <ArrowRight className="h-3.5 w-3.5" />
          Move to {statusMeta(suggested).label}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Move to another status"
          className="inline-flex h-8 w-7 cursor-pointer items-center justify-center border-l border-white/20">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+6px)] right-0 z-40 min-w-[190px] overflow-hidden rounded-xl border-[1.5px] border-[#222325] bg-white shadow-[4px_4px_0_0_#222325]">
          {destinations.map((id, i) => {
            const meta = statusMeta(id);
            const firstClosed = isClosedStatus(id) && destinations[i - 1] !== undefined && !isClosedStatus(destinations[i - 1]);
            return (
              <div key={id}>
                {firstClosed && (
                  <p className="border-t-[1.5px] border-black/10 bg-[#fbfbf7] px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-black/40">
                    Close this one
                  </p>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onMove(id);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 border-b border-black/8 px-3 py-2 text-left text-xs font-semibold text-primary transition-colors last:border-b-0 hover:bg-[#fbfbf7]">
                  <span className={cn("h-2 w-2 flex-none rounded-full", meta.dot)} aria-hidden />
                  <span className="flex-1">{meta.label}</span>
                  {id === suggested && <Check className="h-3.5 w-3.5 flex-none text-[#6c7a1e]" strokeWidth={3} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MoveToButton;

/** The move a stage suggests: the next one along, or Applied once at the end. */
export function suggestedMove(current: TrackerStatus): TrackerStatus {
  if (isClosedStatus(current)) return "applied";
  const i = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[i + 1] ?? CLOSED_ORDER[0];
}
