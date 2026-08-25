"use client";

import { useEffect, useRef, useState, type FC, type RefObject } from "react";
import { cn } from "@/lib/utils";

export interface PageGuidesProps {
  /**
   * Ref to the element whose rendered height is measured against one page's
   * height — typically a `relative`-positioned wrapper around `<ResumePaper/>`
   * (this component renders itself as an absolute overlay, so it needs a
   * positioned ancestor; it does not assume `<ResumePaper/>`'s own root is
   * that ancestor, since the two are meant to compose as siblings rather than
   * one importing the other). Compose them like:
   * ```
   * const ref = useRef<HTMLDivElement>(null);
   * <div ref={ref} className="relative">
   *   <ResumePaper .../>
   *   <PageGuides containerRef={ref} />
   * </div>
   * ```
   */
  containerRef: RefObject<HTMLElement | null>;
  /** Fires whenever the measured page count changes. Optional — purely a notification. */
  onPageCountChange?: (count: number) => void;
  className?: string;
}

// Editor-only aid, not part of the exported document, so this intentionally
// does NOT read a `--r-guide` var — there isn't one (design-to-css.ts is A0's
// closed file and doesn't emit it; see the chunk A2 report). The repeat SIZE
// still reads the real `--r-page-h` var, so the guide always lines up with
// whatever page format is selected — only the tint is a hardcoded static
// value. Written as one static arbitrary-value class (not `style={}`): the
// bracket's content is a fixed literal, not runtime-assembled.
const PAGE_GUIDE_BG_CLASS =
  "bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(var(--r-page-h)_-_1px),rgba(0,0,0,0.06)_calc(var(--r-page-h)_-_1px),rgba(0,0,0,0.06)_var(--r-page-h))]";

/**
 * Two jobs: (1) a zero-JS-computed visual overlay showing where page breaks
 * fall, and (2) a basic page-count measurement via ResizeObserver.
 *
 * The count comes from a real DOM measurement rather than any mm/pt-to-px
 * arithmetic in JS (the hard rule against unit conversion in JS is about the
 * STYLING model, but the same spirit applies here) — an invisible 1px-wide
 * "ruler" element is sized `height: var(--r-page-h)` via a static class, and
 * `offsetHeight` reads back whatever pixel height the browser actually
 * resolved that page-format/mm value to. `offsetHeight` (not
 * `getBoundingClientRect()`) is deliberate: it's transform-invariant, same as
 * `scrollHeight` — so this ratio stays correct even under an ancestor
 * `transform: scale()` (the fit-to-width zoom the caller applies at narrow
 * viewports), where `getBoundingClientRect()` would shrink with it and skew
 * the count.
 *
 * Kept deliberately basic per the brief: no fractional pages, no print-aware
 * offset, no `@media print`. A pixel-accurate version is chunk A4's job,
 * which depends on this component existing first.
 */
const PageGuides: FC<PageGuidesProps> = ({ containerRef, onPageCountChange, className }) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(1);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const ruler = rulerRef.current;
    if (!container || !ruler) return;

    // Effect body only constructs/observes/disconnects — `setPageCount` (and
    // the `onPageCountChange` notification) happen exclusively inside the
    // observer callback below, never synchronously here. That split is what
    // `react-hooks/set-state-in-effect` requires (ESLint error for new
    // files). ResizeObserver fires its callback once on `observe()` even
    // without a real size change yet, so no separate initial measurement call
    // is needed in the effect body. `lastCountRef` (a plain mutable ref, not
    // a functional setState updater) is what dedupes repeat notifications —
    // setState updaters must stay pure, so `onPageCountChange` is called
    // directly in the callback instead of from inside one.
    const observer = new ResizeObserver(() => {
      const pageHeightPx = ruler.offsetHeight;
      if (pageHeightPx <= 0) return;
      const next = Math.max(1, Math.ceil(container.scrollHeight / pageHeightPx));
      if (next === lastCountRef.current) return;
      lastCountRef.current = next;
      setPageCount(next);
      onPageCountChange?.(next);
    });
    observer.observe(container);
    observer.observe(ruler);

    return () => observer.disconnect();
  }, [containerRef, onPageCountChange]);

  return (
    <>
      <div ref={rulerRef} aria-hidden className="pointer-events-none invisible absolute h-[var(--r-page-h)] w-px" />
      <div
        aria-hidden
        data-page-count={pageCount}
        className={cn("pointer-events-none absolute inset-0", PAGE_GUIDE_BG_CLASS, className)}
      />
    </>
  );
};

export default PageGuides;
