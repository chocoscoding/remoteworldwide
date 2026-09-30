"use client";

import { useEffect, useRef } from "react";

interface LevelMeterProps {
  /** Subscribes to the mic level, 0-1, every animation frame. */
  subscribe: (listener: (level: number) => void) => () => void;
}

/**
 * The mic level as a segmented bar. It is written straight to the element's
 * transform from the level callback, so a 60 fps meter never re-renders the
 * page.
 */
export default function LevelMeter({ subscribe }: LevelMeterProps) {
  const fill = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribe((level) => {
        if (fill.current) fill.current.style.transform = `scaleX(${Math.max(0, Math.min(1, level))})`;
      }),
    [subscribe],
  );

  return (
    <div aria-hidden className="relative h-2 w-full overflow-hidden rounded-full bg-primary2/10" title="Microphone level">
      <div
        ref={fill}
        className="h-full w-full origin-left scale-x-0 bg-[repeating-linear-gradient(90deg,#e1f073_0_5px,transparent_5px_7px)] transition-transform duration-75"
      />
    </div>
  );
}
