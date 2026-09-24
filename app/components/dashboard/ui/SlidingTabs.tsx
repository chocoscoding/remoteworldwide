"use client";

import type { KeyboardEvent } from "react";
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
  /**
   * Opt in to the ARIA tabs pattern, for a bar that swaps panels in place:
   * `tablist` / `tab` roles, `aria-selected` and `aria-controls` on each tab,
   * one tab stop, and the arrow keys (plus Home and End) moving between tabs.
   * The consumer marks each panel up to match, with the ids from
   * `slidingTabId` and `slidingTabPanelId`:
   * `<div role="tabpanel" id={slidingTabPanelId(id, tab)} aria-labelledby={slidingTabId(id, tab)}>`.
   *
   * Left off, the bar stays a row of plain buttons with `aria-current`, which
   * is what its filter and tone-picker consumers are: they change what one
   * list shows rather than swapping panels.
   */
  tablist?: {
    /** Unique on the page (React's `useId`); the tab and panel ids are built from it. */
    id: string;
    /** Names the bar for assistive tech, e.g. "Report sections". */
    label: string;
  };
}

/** The id of a tab's button when the bar is a `tablist`; its panel names itself with this (`aria-labelledby`). */
export const slidingTabId = (tablistId: string, value: string) => `${tablistId}-tab-${value}`;
/** The id a tab's panel carries when the bar is a `tablist`; the tab points at it (`aria-controls`). */
export const slidingTabPanelId = (tablistId: string, value: string) => `${tablistId}-panel-${value}`;

export default function SlidingTabs<T extends string>({ value, options, onChange, className, tablist }: SlidingTabsProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));

  // Selection follows focus: the panels are already in memory, so showing one
  // as its tab is reached costs nothing, and saves a keypress per tab.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, from: number) => {
    const last = options.length - 1;
    const moves: Partial<Record<string, number>> = {
      // The ends wrap, so neither arrow ever stops dead.
      ArrowRight: from === last ? 0 : from + 1,
      ArrowLeft: from === 0 ? last : from - 1,
      Home: 0,
      End: last,
    };
    const to = moves[e.key];
    if (to === undefined || to === from) return;
    e.preventDefault();
    onChange(options[to].id);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[to]?.focus();
  };

  return (
    <div
      role={tablist ? "tablist" : undefined}
      aria-label={tablist?.label}
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
      {options.map((o, i) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-current={!tablist && active ? "page" : undefined}
            role={tablist ? "tab" : undefined}
            id={tablist ? slidingTabId(tablist.id, o.id) : undefined}
            aria-selected={tablist ? active : undefined}
            aria-controls={tablist ? slidingTabPanelId(tablist.id, o.id) : undefined}
            // One tab stop for the whole bar; the arrow keys move inside it.
            tabIndex={tablist ? (active ? 0 : -1) : undefined}
            onKeyDown={tablist ? (e) => onKeyDown(e, i) : undefined}
            className={cn(
              "relative z-10 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors duration-200",
              active ? "text-white" : "text-black/55 hover:text-[#222325]"
            )}>
            {o.label}
            {/* Subordinate by weight, not by lightness: against the #f0f0ea
                track nothing below ~black/54 clears 4.5:1 for small text, so
                the old black/35 (2.4:1) had no legible tone to fall back to.
                font-normal under the tab's font-bold label carries it instead. */}
            {o.count ? (
              <span className={cn("ml-1 font-normal tabular-nums", active ? "text-white/60" : "text-black/55")}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
