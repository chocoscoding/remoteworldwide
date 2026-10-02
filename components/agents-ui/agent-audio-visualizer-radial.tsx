"use client";

// Ported from LiveKit Agents UI (@agents-ui/agent-audio-visualizer-radial).
//
// Two departures from the registry version:
// - No LiveKit. The original only used livekit-client for its own `audioTrack`
//   metering, and our voice runs on ElevenLabs, so levels come in through
//   `volumeBands` and nothing else.
// - Tailwind v3. The registry styles are v4-only selectors
//   (`**:data-lk-index:`, `bg-current/10`, `has-data-[…]`), so the dim/lit bar,
//   the per-state transition and the thinking spin are applied inline instead.
//
// One addition: `volumeBands` also sizes the bars while `listening`, not only
// `speaking`. The interview orb tracks the candidate's mic when it has one.

import { useMemo, type ComponentProps, type CSSProperties } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useAgentAudioVisualizerRadialAnimator, type RadialVisualizerState } from "@/hooks/agents-ui/use-agent-audio-visualizer-radial";

/**
 * Resizes an array of per-band volume values to exactly `count` entries.
 * Excess values are trimmed from the end. If there are too few, the last value
 * is duplicated to fill the remainder. An empty array is padded with 0s.
 */
export function normalizeVolumeBands(bands: number[], count: number): number[] {
  if (bands.length === count) return bands;
  if (bands.length > count) return bands.slice(0, count);
  const lastValue = bands[bands.length - 1] ?? 0;
  return [...bands, ...new Array<number>(count - bands.length).fill(lastValue)];
}

export const AgentAudioVisualizerRadialVariants = cva("relative flex aspect-square items-center justify-center", {
  variants: {
    size: {
      icon: "h-[24px]",
      sm: "h-[56px]",
      md: "h-[112px]",
      lg: "h-[224px]",
      xl: "h-[448px]",
    },
  },
  defaultVariants: { size: "md" },
});

const RADIUS_BY_SIZE = { icon: 6, sm: 16, md: 32, lg: 64, xl: 128 } as const;

export interface AgentAudioVisualizerRadialProps {
  /** @defaultValue 'md' */
  size?: "icon" | "sm" | "md" | "lg" | "xl";
  /** Determines the animation pattern. @defaultValue 'connecting' */
  state?: RadialVisualizerState;
  /** The colour of the bars. */
  color?: `#${string}`;
  /** Distance from the centre to the bars. Defaults by size. */
  radius?: number;
  /** Bars around the circle; keep it divisible by 4. Defaults to 12 for icon/sm, 24 otherwise. */
  barCount?: number;
  /** Per-bar levels, 0-1. Resized to `barCount`. */
  volumeBands?: number[];
  className?: string;
}

export function AgentAudioVisualizerRadial({
  size = "md",
  state = "connecting",
  color,
  radius,
  barCount,
  volumeBands,
  className,
  style,
  ...props
}: AgentAudioVisualizerRadialProps & Omit<ComponentProps<"div">, "color"> & VariantProps<typeof AgentAudioVisualizerRadialVariants>) {
  const resolvedSize = size ?? "md";
  const count = barCount ?? (resolvedSize === "icon" || resolvedSize === "sm" ? 12 : 24);
  const bands = useMemo(() => normalizeVolumeBands(volumeBands ?? [], count), [volumeBands, count]);

  const sequencerInterval = state === "connecting" || state === "listening" ? 500 : state === "initializing" ? 250 : state === "thinking" ? Infinity : 1000;
  const distanceFromCenter = radius ?? RADIUS_BY_SIZE[resolvedSize];
  const dotSize = (distanceFromCenter * Math.PI) / count;
  const highlighted = useAgentAudioVisualizerRadialAnimator(state, count, sequencerInterval);
  const slowFade = state === "connecting" || state === "initializing" || state === "listening";
  const levelsShown = state === "speaking" || state === "listening";

  if (process.env.NODE_ENV !== "production" && count % 4 !== 0) {
    console.warn("barCount should be divisible by 4 for optimal visual results");
  }

  return (
    <div
      data-lk-state={state}
      className={cn(AgentAudioVisualizerRadialVariants({ size: resolvedSize }), state === "thinking" && "animate-spin motion-reduce:animate-none", className)}
      style={{ ...style, color, ...(state === "thinking" ? { animationDuration: "5s" } : null) } as CSSProperties}
      {...props}>
      {bands.map((band, idx) => {
        const angle = (idx / count) * Math.PI * 2;
        const lit = state === "thinking" || highlighted.includes(idx);
        return (
          <div
            key={`${count}-${idx}`}
            className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2"
            style={{ transformOrigin: "center", transform: `rotate(${angle}rad) translateY(${distanceFromCenter}px)` }}>
            <div
              data-lk-index={idx}
              data-lk-highlighted={lit}
              className={cn("absolute left-1/2 top-1/2 origin-bottom -translate-x-1/2 rounded-full bg-current transition-opacity ease-linear", slowFade ? "duration-300" : "duration-150")}
              style={{
                opacity: lit ? 1 : 0.1,
                width: dotSize,
                minHeight: dotSize,
                height: levelsShown ? dotSize * 10 * band : 0,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
