"use client";

import { FC, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A voice level meter, drawn from real mic amplitude.
 *
 * Bar heights are written straight to the DOM from the level subscription
 * rather than held in React state: this updates every animation frame, and
 * re-rendering the surrounding screen 60 times a second to move a few bars
 * would be indefensible. React owns the bars' existence; the rAF loop owns
 * only their height.
 *
 * Sizing and colour are props because the two places this appears want very
 * different things from it — a wide banner under the interviewer orb, and a
 * small inline meter inside a chat composer.
 */
export interface MicWaveformProps {
  /** Subscribe to amplitude 0-1. Returns an unsubscribe. */
  onLevel: (cb: (level: number) => void) => () => void;
  active: boolean;
  bars?: number;
  /** Bar thickness in px. */
  barWidth?: number;
  /** Gap between bars in px. */
  gap?: number;
  /** Overall height, as a Tailwind height class. */
  height?: string;
  /** Bar colour while listening. */
  activeClassName?: string;
  /** Bar colour at rest. */
  idleClassName?: string;
  /** Smallest bar height, as a percentage of the track. */
  floorPct?: number;
  className?: string;
}

const MicWaveform: FC<MicWaveformProps> = ({
  onLevel,
  active,
  bars = 28,
  barWidth = 3,
  gap = 3,
  height = "h-10",
  activeClassName = "bg-[#e1f073]",
  idleClassName = "bg-white/20",
  floorPct = 8,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Each bar trails the one before it, so a peak travels outward from the
  // centre instead of every bar jumping in unison.
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    const unsubscribe = onLevel((level) => {
      const el = containerRef.current;
      if (!el) return;

      const hist = historyRef.current;
      hist.unshift(level);
      if (hist.length > bars) hist.length = bars;

      const children = el.children;
      const mid = (bars - 1) / 2;
      for (let i = 0; i < children.length; i++) {
        // Distance from centre picks how far back in history this bar reads,
        // and tapers the edges so the shape reads as a waveform.
        const dist = Math.abs(i - mid);
        const sampled = hist[Math.round(dist)] ?? 0;
        const taper = 1 - (dist / mid) * 0.55;
        const pct = Math.max(floorPct, Math.min(100, sampled * taper * 130));
        (children[i] as HTMLElement).style.height = `${pct}%`;
      }
    });
    return unsubscribe;
  }, [onLevel, bars, floorPct]);

  return (
    <div
      ref={containerRef}
      className={cn("flex items-center justify-center", height, className)}
      style={{ gap: `${gap}px` }}
      aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={cn("rounded-full transition-[background-color] duration-200", active ? activeClassName : idleClassName)}
          style={{ width: `${barWidth}px`, height: `${floorPct}%` }}
        />
      ))}
    </div>
  );
};

export default MicWaveform;
