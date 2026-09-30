"use client";

import { memo } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { ariaTime, formatClock } from "@/app/lib/voice/format";
import { usePlaybackTime, useSeek } from "./PlaybackProvider";

export interface TimestampChipProps {
  /** Where the moment starts on the session clock. */
  atMs: number;
  /** Where it ends; when given, the chip lights up while playback is inside it. */
  endMs?: number;
  /** Replaces the clock as the visible text ("Answer 3"); the clock stays in the accessible name. */
  label?: string;
  /** For chips on the dark ink surface (the coach note). */
  onDark?: boolean;
  /** Lead-in before the moment, in ms, so the listener doesn't land mid-word. Default 1500. */
  prerollMs?: number;
  className?: string;
}

/**
 * "▶ 3:42" — the way back into the recording from anything the report says.
 *
 * Renders nothing outside a PlaybackProvider: an in-memory demo session and a
 * typed session have no recording, and a chip that can't play is worse than
 * no chip.
 */
const TimestampChip = memo(function TimestampChip({ atMs, endMs, label, onDark = false, prerollMs, className }: TimestampChipProps) {
  const seekTo = useSeek();
  // A boolean selector: the chip re-renders twice per pass through its span,
  // not every frame.
  const inside = usePlaybackTime((ms) => endMs !== undefined && ms >= atMs && ms < endMs);
  if (!seekTo) return null;

  const clock = formatClock(atMs);
  const range = endMs !== undefined && endMs > atMs ? `${clock}–${formatClock(endMs)}` : clock;

  return (
    <button
      type="button"
      onClick={() => seekTo(atMs, prerollMs === undefined ? undefined : { preroll: prerollMs })}
      aria-label={`Play from ${ariaTime(atMs)}${label ? `, ${label}` : ""}`}
      title={`Play ${range}`}
      className={cn(
        "inline-flex flex-none items-center gap-1 rounded-full border px-2 py-[3px] text-[11px] font-bold leading-none whitespace-nowrap tabular-nums cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-1",
        onDark
          ? inside
            ? "border-[#e1f073] bg-[#e1f073] text-[#222325] focus-visible:ring-offset-[#222325]"
            : "border-white/20 bg-white/10 text-white/85 hover:border-[#e1f073] hover:text-[#e1f073] focus-visible:ring-offset-[#222325]"
          : inside
            ? "border-[#222325] bg-[#e1f073] text-[#222325]"
            : "border-black/15 bg-white text-[#222325] hover:border-[#222325] hover:bg-[#f6faea]",
        className
      )}>
      <Play aria-hidden className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
      {label ?? clock}
    </button>
  );
});

export default TimestampChip;
