"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented tab bar whose selection *slides* between items rather than
 * blinking off one and on the next — the movement is what tells you the two
 * are the same control in different positions.
 *
 * Cells are laid out on an equal-width grid so the indicator's position is
 * pure arithmetic (`index / count`), with no DOM measurement and therefore no
 * layout-effect + setState dance. That keeps it clean under the React
 * Compiler's purity rules, which reject reading layout during render.
 */
export interface SlidingTabsProps<T extends string> {
  value: T;
  options: { id: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  className?: string;
}

export default function SlidingTabs<T extends string>({ value, options, onChange, className }: SlidingTabsProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));

  return (
    <div
      className={cn("relative grid w-fit max-w-full overflow-x-auto rounded-xl border-[1.5px] border-[#222325] bg-[#f0f0ea] p-1 shadow-[3px_3px_0_0_#222325]", className)}
      // `max-content` floor, not 0: equal-width columns are what makes the
      // indicator's position pure arithmetic, but they must never shrink
      // below their own label or the bar collapses on a narrow viewport.
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(max-content, 1fr))` }}>
      {/* The travelling block. Its width is exactly one cell, so shifting it by
          whole multiples of its own width lands it on each tab in turn. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-lg bg-[#222325] transition-transform duration-200 ease-out"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative z-10 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors duration-200",
              active ? "text-white" : "text-black/55 hover:text-[#222325]"
            )}>
            {o.label}
            {o.count ? <span className={cn("ml-1 tabular-nums", active ? "text-white/50" : "text-black/35")}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
