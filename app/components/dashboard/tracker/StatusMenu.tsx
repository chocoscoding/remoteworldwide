"use client";

import { FC, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackerStatus } from "@/app/lib/dashboard/types";
import { BOARD_ORDER, isClosedStatus, statusMeta } from "./tracker-meta";

/**
 * The status pill that IS the status control. One tinted pill (the user's
 * "just one pill, not icon and that") — click it and every stage is one
 * selection away, from the table, the calendar panel, or the timeline dialog.
 * Outside-click/Escape handling follows SplitButton's pattern; no new deps.
 *
 * Below the stages sits the exit. It's in the same menu because closing an
 * application IS a status change — putting it behind a separate control would
 * make the most common outcome in any job search the hardest one to record.
 */
export interface StatusMenuProps {
  value: TrackerStatus;
  /** Every destination goes through here — a stage or an outcome. */
  onChange: (to: TrackerStatus) => void;
  /** Just the pill, no menu — for places where changing makes no sense. */
  readOnly?: boolean;
  className?: string;
}

const StatusMenu: FC<StatusMenuProps> = ({ value, onChange, readOnly, className }) => {
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

  const current = statusMeta(value);
  const pill = cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap", current.pill);

  if (readOnly) {
    return <span className={cn(pill, className)}>{current.label}</span>;
  }

  return (
    // Rows that open the timeline sit around this control — the menu is its
    // own click surface, never a click-through.
    <div ref={wrapRef} className={cn("relative inline-flex", className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Status: ${current.label}. Change status`}
        className={cn(pill, "cursor-pointer transition-[filter] hover:brightness-95")}>
        {current.label}
        <ChevronDown className={cn("h-3 w-3 flex-none transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+5px)] z-40 min-w-[168px] overflow-hidden rounded-xl border-[1.5px] border-[#222325] bg-white shadow-[4px_4px_0_0_#222325]">
          {BOARD_ORDER.map((id, i) => {
            const meta = statusMeta(id);
            const opensClosed = isClosedStatus(id) && !isClosedStatus(BOARD_ORDER[i - 1]);
            return (
              <div key={id}>
                {opensClosed && (
                  <p className="border-t-[1.5px] border-black/10 bg-[#fbfbf7] px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-black/40">
                    Close this one
                  </p>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    if (id !== value) onChange(id);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 border-b border-black/8 px-3 py-2 text-left text-xs font-semibold text-primary transition-colors last:border-b-0 hover:bg-[#fbfbf7]">
                  <span className={cn("h-2 w-2 flex-none rounded-full", meta.dot)} aria-hidden />
                  <span className="flex-1">{meta.label}</span>
                  {id === value && <Check className="h-3.5 w-3.5 flex-none text-[#6c7a1e]" strokeWidth={3} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatusMenu;
