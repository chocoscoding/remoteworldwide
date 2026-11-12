"use client";

import { useCallback, useState } from "react";

/**
 * The chart box's width in CSS pixels, so the SVG draws at 1:1 and its text never scales: measured
 * once when the box mounts, then kept current by a ResizeObserver. On the server (and before
 * hydration) it answers `fallback` and the SVG's viewBox fits that into the box.
 */
export function useChartWidth(fallback = 640) {
  const [width, setWidth] = useState(0);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const first = Math.round(node.getBoundingClientRect().width);
    if (first > 0) setWidth(first);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width || fallback] as const;
}
