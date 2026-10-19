"use client";

// Undo, redo and the change history of this application's draft (owner's design, 2026-10-19): one
// draft, one history. Undo and redo step one change at a time, the list jumps straight to any step,
// and the score jumps with it, without a re-score. Ctrl+Z / Ctrl+Shift+Z are wired by the step.

import { useState, type FC } from "react";
import { ChevronDown, History, Redo2, Undo2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { stepTime, type ApplyHistoryStep } from "@/app/lib/apply/history";

export interface DraftHistoryProps {
  history: ApplyHistoryStep[];
  at: number;
  /** Goes to that step: writes its words to the draft again. */
  onJump: (index: number) => void;
  disabled: boolean;
}

const scoreText = (score: number | null) => (score === null ? "–" : String(score));

const DraftHistory: FC<DraftHistoryProps> = ({ history, at, onJump, disabled }) => {
  const [open, setOpen] = useState(false);
  const canUndo = !disabled && at > 0;
  const canRedo = !disabled && at < history.length - 1;
  const current = history[at];
  const previous = history[at - 1];
  const next = history[at + 1];
  const back = history.length - 1 - at;
  const undoTip = current && previous ? `Undo “${current.label}” · ${scoreText(current.score)} → ${scoreText(previous.score)}` : "Nothing to undo";
  const redoTip = next ? `Redo “${next.label}” · ${scoreText(current?.score ?? null)} → ${scoreText(next.score)}` : "Nothing to redo";

  return (
    // Inside the wizard header's pill, beside "Saved" (owner's design, 2026-10-19): the pill draws the edge.
    <span className="relative flex items-center gap-0.5">
      <span className="group relative">
        <button
          type="button"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={() => onJump(at - 1)}
          className="grid h-[34px] w-[34px] cursor-pointer place-content-center rounded-full text-primary transition-colors hover:bg-[#f6f6f6] disabled:cursor-default disabled:text-[#b9bab4] disabled:hover:bg-transparent">
          <Undo2 className="h-[15px] w-[15px]" strokeWidth={2.2} />
        </button>
        {canUndo && (
          <span className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden whitespace-nowrap rounded-lg bg-[#222325] px-2.5 py-[7px] text-xs font-semibold text-white group-hover:block">
            {undoTip}
          </span>
        )}
      </span>
      <span className="group relative">
        <button
          type="button"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={() => onJump(at + 1)}
          className="grid h-[34px] w-[34px] cursor-pointer place-content-center rounded-full text-primary transition-colors hover:bg-[#f6f6f6] disabled:cursor-default disabled:text-[#b9bab4] disabled:hover:bg-transparent">
          <Redo2 className="h-[15px] w-[15px]" strokeWidth={2.2} />
        </button>
        {canRedo && (
          <span className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden whitespace-nowrap rounded-lg bg-[#222325] px-2.5 py-[7px] text-xs font-semibold text-white group-hover:block">
            {redoTip}
          </span>
        )}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Change history"
            title="Change history"
            disabled={history.length === 0}
            className="flex h-[34px] cursor-pointer items-center gap-1 rounded-full bg-[#f6f6f6] px-2 text-primary disabled:cursor-default disabled:opacity-50">
            <History className="h-3.5 w-3.5" strokeWidth={2} />
            <ChevronDown className="h-3 w-3" strokeWidth={2.4} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          role="dialog"
          aria-label="Change history"
          className="flex w-[400px] max-w-[calc(100vw-32px)] flex-col gap-1 rounded-[14px] border-[1.5px] border-[#222325] bg-white p-2 shadow-[3px_3px_0_0_#222325]">
          <div className="flex items-center gap-2 px-2 pb-2 pt-1.5">
            <span className="flex-1 text-[13px] font-extrabold text-primary">This draft&apos;s changes</span>
            <span className="text-[11px] font-bold text-[#8a8b85]">score</span>
          </div>
          {history.map((step, index) => {
            const now = index === at;
            const later = index > at;
            return (
              <button
                key={step.id}
                type="button"
                disabled={disabled || now}
                onClick={() => {
                  onJump(index);
                  setOpen(false);
                }}
                className={cn(
                  "relative flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-[9px] pl-4 pr-2.5 text-left transition-colors hover:bg-[#f6f6f6] disabled:cursor-default",
                  now && "bg-[#fbfbf7] outline outline-1 outline-[#222325]/15 hover:bg-[#fbfbf7]",
                  later && "opacity-45",
                )}>
                <span className="flex w-3 flex-none justify-center">
                  {now ? (
                    <span className="h-3 w-3 rounded-full bg-[#222325] shadow-[0_0_0_3px_#e1f073]" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-[#8a8b85]" />
                  )}
                </span>
                {index < history.length - 1 && <span aria-hidden className="absolute bottom-[-14px] left-[22px] top-[26px] w-[1.5px] bg-[#b9bab4]" />}
                <span className={cn("min-w-0 flex-1 truncate text-[13px] text-primary", now ? "font-extrabold" : "font-semibold")}>{step.label}</span>
                {now && <span className="rounded-full bg-[#e1f073] px-[7px] text-[11px] font-extrabold text-primary">Now</span>}
                {later && <span className="rounded-full border border-black/15 px-[7px] text-[11px] font-bold text-black/55">redo</span>}
                <span className="min-w-[26px] flex-none text-right text-xs font-extrabold text-primary">{scoreText(step.score)}</span>
                <span className="flex-none text-[11px] text-[#9a9b95]">{stepTime(step.at)}</span>
              </button>
            );
          })}
          <div className="mt-1 border-t border-black/10 px-2 pb-1 pt-2">
            <span className="text-xs text-[#5f6062]">
              {back > 0
                ? `You're ${back} ${back === 1 ? "step" : "steps"} back. Making a new change here clears the ${back} faded ${back === 1 ? "step" : "steps"}.`
                : "Click any step to go back to it. Nothing is lost: you can come forward again."}
            </span>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
};

export default DraftHistory;
