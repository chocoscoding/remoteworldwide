"use client";

// Pause the search.
//
// Job seekers take breaks — illness, a holiday, a stretch of interviews, or
// simply running out of road for a fortnight. A system that punishes that with
// a broken streak and a stream of notifications is a system people leave and
// don't come back to. So pausing holds the count exactly where it is and
// silences every prompt until they choose to come back.

import { useState, type FC } from "react";
import { PauseCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";

const DURATIONS = [3, 7, 14, 30];

export interface PauseSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PauseSearchDialog: FC<PauseSearchDialogProps> = ({ open, onOpenChange }) => {
  const { current, pauseSearch } = useActivity();
  const [days, setDays] = useState(7);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 max-w-md overflow-hidden gap-0">
        <div className="px-7 pt-7 pb-6">
          <div className="mb-3 flex items-center gap-2.5">
            <PauseCircle className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold text-primary">Pause your search</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed text-black/55">
            Your {current}-day streak is held exactly where it is. No prompts, no goals, nothing to keep up with — it&apos;s all
            here when you come back.
          </DialogDescription>

          <p className="mt-5 mb-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40">For how long</p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer",
                  days === d ? "bg-primary text-white" : "bg-[#f0f0ea] text-black/55 hover:bg-[#e7e7df]"
                )}>
                {d} days
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2.5">
            <StickerButton
              variant="primary"
              size="md"
              onClick={() => {
                pauseSearch(days);
                onOpenChange(false);
              }}>
              Pause for {days} days
            </StickerButton>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold text-black/45 hover:text-primary cursor-pointer">
              Not now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PauseSearchDialog;
