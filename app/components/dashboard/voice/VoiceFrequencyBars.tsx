"use client";

// The live voice spectrum: 36 mirrored bars, the low bands meeting in the middle.
//
// One visualizer for every screen that shows a voice — the coach and Ask about
// a job (through InlineTalkBar) and the interview's answer bar. It owns its
// animation frames and writes each bar's transform directly, never through
// state, so mounting it re-renders nothing at 60 fps: PrepOrb's reason for
// owning its level subscription, taken one step further (the orb still
// re-renders itself per frame; this does not re-render at all).
//
// Still when the room is: barsFrom rests quiet bands at zero (a hairline), and
// a torn-down mic hands over null, which is all zeros.

import { useEffect, useRef, type FC } from "react";
import { useReducedMotion } from "motion/react";
import { barsFrom, easeBars, mirrorBars, restingBars } from "@/app/lib/voice/frequencyBars";
import { cn } from "@/lib/utils";

const BAR_COUNT = 36;
const HALF = BAR_COUNT / 2;
/** A silent bar keeps this much height, so the line never vanishes. */
const MIN_SCALE = 0.1;
const QUIET: readonly number[] = new Array<number>(BAR_COUNT).fill(0);
const RESTING: readonly number[] = restingBars(BAR_COUNT);

const scaleOf = (level: number) => `scaleY(${(MIN_SCALE + (1 - MIN_SCALE) * level).toFixed(3)})`;

const paint = (el: HTMLElement, levels: readonly number[]) => {
  const bars = el.children;
  for (let i = 0; i < bars.length; i++) (bars[i] as HTMLElement).style.transform = scaleOf(levels[i] ?? 0);
};

export interface VoiceFrequencyBarsProps {
  /**
   * The byte spectrum to draw, 0-8000 Hz (see voiceSpectrumBins), read once a
   * frame; null draws silence. Must be referentially stable: the frame loop
   * restarts whenever it changes.
   */
  getFrequencyData: () => Uint8Array | null;
  /** Animate. Off, the bars rest flat (or in a still silhouette under reduced motion). */
  active: boolean;
  /** The strip: height, width, padding, background. */
  className?: string;
  /** Each bar: colour, opacity. */
  barClassName?: string;
}

const VoiceFrequencyBars: FC<VoiceFrequencyBarsProps> = ({ getFrequencyData, active, className, barClassName }) => {
  const reduceMotion = useReducedMotion() ?? false;
  const barsRef = useRef<HTMLDivElement>(null);
  const animate = active && !reduceMotion;

  // Frames only while active; the bars are written directly, never through state.
  useEffect(() => {
    const el = barsRef.current;
    if (!el) return;
    if (!animate || typeof requestAnimationFrame !== "function") {
      paint(el, reduceMotion ? RESTING : QUIET);
      return;
    }
    let levels = new Array<number>(HALF).fill(0);
    let frame = requestAnimationFrame(function tick() {
      levels = easeBars(levels, barsFrom(getFrequencyData(), HALF));
      paint(el, mirrorBars(levels));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [animate, reduceMotion, getFrequencyData]);

  return (
    <div ref={barsRef} aria-hidden className={cn("flex min-w-0 items-center justify-between gap-px overflow-hidden", className)}>
      {(reduceMotion ? RESTING : QUIET).map((level, i) => (
        <span key={i} className={cn("h-full w-[3px] min-w-px rounded-full", barClassName)} style={{ transform: scaleOf(level) }} />
      ))}
    </div>
  );
};

export default VoiceFrequencyBars;
