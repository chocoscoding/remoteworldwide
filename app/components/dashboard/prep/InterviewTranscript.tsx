"use client";

// The live transcript of a spoken interview.
//
// Open by default: in a voice interview this panel is the only record of what
// was actually heard, and someone who has just been misheard needs to see it
// without going looking for it.
//
// It follows the conversation, but it stops following the moment the reader
// scrolls up. Auto-scrolling someone away from the answer they went back to
// re-read is worse than not following at all, so "stick to the bottom" is a
// state that the reader controls by scrolling and gets back with one click —
// the same contract every chat log has.
//
// The scroller is its own component so that "following" resets by MOUNTING
// rather than by an effect: the panel is unmounted while closed, so reopening
// gives a fresh `useState(true)` and a fresh jump to the newest turn, with no
// state synchronisation to get wrong.

import { useCallback, useLayoutEffect, useRef, useState, type FC } from "react";
import { ArrowDown, ChevronDown, Loader2, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TranscriptEntry {
  id: string;
  who: "ai" | "user";
  text: string;
  /** Marks the turn being spoken right now, so it can be flagged as live. */
  speaking?: boolean;
}

export interface InterviewTranscriptProps {
  entries: TranscriptEntry[];
  /**
   * The words being spoken right now, not yet a finished turn. Shown in place
   * so the panel reacts while someone talks rather than only after they stop.
   */
  interim?: string;
  /** A trailing "thinking of a follow-up" line, for the gap between turns. */
  pending?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The surface it sits on. The live interview screen is dark. */
  tone?: "light" | "dark";
  /**
   * Grow to the height available instead of capping at a fixed height. For the
   * interview's full-height column; off for a card in a stack.
   */
  fill?: boolean;
  className?: string;
}

/** How close to the bottom still counts as "following", in pixels. */
const STICK_THRESHOLD_PX = 48;

type ScrollerProps = Pick<InterviewTranscriptProps, "entries" | "interim" | "pending" | "fill"> & { dark: boolean };

const TranscriptScroller: FC<ScrollerProps> = ({ entries, interim, pending, fill, dark }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [following, setFollowing] = useState(true);

  const scrollToEnd = useCallback((behavior: ScrollBehavior) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Layout effect, not effect: the jump happens in the same frame the new turn
  // paints, so the panel never shows the old bottom first. On mount this also
  // lands on the newest turn, without animation — a smooth scroll through a
  // long interview is a distraction, not feedback.
  useLayoutEffect(() => {
    if (following) scrollToEnd(entries.length > 0 ? "smooth" : "auto");
    // `following` is deliberately not a dependency: this runs when the
    // conversation grows, not when the reader takes over or hands back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, interim, pending, scrollToEnd]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD_PX);
  };

  return (
    <div className={cn("relative", fill ? "flex min-h-0 flex-1 flex-col" : "border-t", !fill && (dark ? "border-white/10" : "border-black/10"))}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        // aria-live so a screen reader hears new turns without the focus
        // moving; polite because the interviewer is already speaking them.
        aria-live="polite"
        className={cn("flex flex-col gap-4 overflow-y-auto px-5 py-4", fill ? "min-h-0 flex-1" : "max-h-[280px]")}>
        {entries.length === 0 && !interim && (
          <p className={cn("text-xs", dark ? "text-white/35" : "text-black/40")}>Your conversation will appear here as it happens.</p>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className={cn("max-w-[82%]", entry.who === "user" ? "self-end" : "self-start")}>
            <p
              className={cn(
                "mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em]",
                dark ? "text-white/30" : "text-black/40"
              )}>
              {entry.who === "user" ? "You" : "Interviewer"}
              {entry.speaking && (
                <span className="inline-flex items-center gap-1 text-[#e1f073]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e1f073]" />
                  speaking
                </span>
              )}
            </p>
            <p
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                entry.who === "user"
                  ? "bg-[#e1f073] font-medium text-[#222325]"
                  : dark
                    ? "bg-white/8 text-white/80"
                    : "bg-[#f0f0ea] text-primary",
                entry.who === "user" && !entry.text && "font-normal italic"
              )}>
              {entry.text || "Answered out loud. Your report will show what you said."}
            </p>
          </div>
        ))}

        {interim && (
          <div className="max-w-[82%] self-end">
            <p className={cn("mb-1.5 text-[10px] font-bold uppercase tracking-[0.07em]", dark ? "text-white/30" : "text-black/40")}>You · live</p>
            <p
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-sm italic leading-relaxed",
                dark ? "bg-[#e1f073]/25 text-white/70" : "bg-[#e1f073]/35 text-black/60"
              )}>
              {interim}
            </p>
          </div>
        )}

        {pending && (
          <p className={cn("inline-flex items-center gap-1.5 self-start text-xs italic", dark ? "text-white/35" : "text-black/40")}>
            <Loader2 className="h-3 w-3 animate-spin" />
            {pending}
          </p>
        )}
      </div>

      {/* Only while the reader has scrolled away — the way back, not a permanent control. */}
      {!following && (
        <button
          type="button"
          onClick={() => {
            setFollowing(true);
            scrollToEnd("smooth");
          }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-[#222325] bg-[#e1f073] px-3 py-1.5 text-[11px] font-bold text-[#222325] shadow-[2px_2px_0_0_#222325]">
          <ArrowDown className="h-3 w-3" />
          Jump to latest
        </button>
      )}
    </div>
  );
};

const InterviewTranscript: FC<InterviewTranscriptProps> = ({
  entries,
  interim,
  pending,
  open,
  onOpenChange,
  tone = "light",
  fill,
  className,
}) => {
  const dark = tone === "dark";
  const count = entries.length;

  return (
    <section
      className={cn(
        "overflow-hidden",
        fill ? "flex min-h-0 flex-col" : "rounded-2xl",
        dark ? "" : "border-[1.5px] border-[#222325] bg-white shadow-[3px_3px_0_0_#222325]",
        className
      )}
      aria-label="Live transcript">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={cn("flex w-full flex-none cursor-pointer items-center gap-2.5 px-5 py-3.5 text-left", dark && "border-b border-white/10")}>
        <span
          className={cn(
            "grid h-7 w-7 flex-none place-content-center rounded-lg",
            dark ? "bg-white/8 text-[#e1f073]" : "bg-[#f0f0ea] text-primary"
          )}>
          <ScrollText className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[10.5px] font-bold uppercase tracking-[0.1em]",
              dark ? "text-white/45" : "text-primary"
            )}>
            Live transcript
          </span>
          <span className={cn("block text-[11px]", dark ? "text-white/30" : "text-black/45")}>
            {count === 0 ? "Nothing said yet" : `${count} ${count === 1 ? "turn" : "turns"}`}
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 flex-none transition-transform", open && "rotate-180", dark ? "text-white/35" : "text-black/40")}
        />
      </button>

      {open && <TranscriptScroller entries={entries} interim={interim} pending={pending} fill={fill} dark={dark} />}
    </section>
  );
};

export default InterviewTranscript;
