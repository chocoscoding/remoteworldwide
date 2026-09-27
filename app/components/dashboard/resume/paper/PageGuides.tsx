"use client";

import { useEffect, useRef, useState, type FC, type RefObject } from "react";
import type { ResumeCssVars } from "@/app/lib/dashboard/resume/design-types";
import { cn } from "@/lib/utils";

export interface PageGuidesProps {
  /**
   * Ref to a `relative`-positioned wrapper whose FIRST element child is
   * `<ResumePaper/>` (this component renders itself as an absolute overlay,
   * so it needs a positioned ancestor; it does not assume `<ResumePaper/>`'s
   * own root is that ancestor, since the two are meant to compose as siblings
   * rather than one importing the other). The paper is read as the first
   * child for the same reason the browser PDF export and the server print
   * page (app/lib/print/print-page.ts) read it that way. Compose them like:
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
//
// `--r-page-h` is only DEFINED on `<ResumePaper/>`'s root, and custom
// properties inherit downward only — this overlay is the paper's sibling, so
// it never sees the var on its own. The component forwards the paper's value
// onto the overlay itself (see `pageHeight` below).
const PAGE_GUIDE_BG_CLASS =
  "bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(var(--r-page-h)_-_1px),rgba(0,0,0,0.06)_calc(var(--r-page-h)_-_1px),rgba(0,0,0,0.06)_var(--r-page-h))]";

/**
 * Two jobs: (1) a visual overlay showing where page breaks fall, and (2) a
 * basic page-count measurement via ResizeObserver.
 *
 * The count comes from a real DOM measurement rather than any mm/pt-to-px
 * arithmetic in JS (the hard rule against unit conversion in JS is about the
 * STYLING model, but the same spirit applies here). The paper's root is
 * `min-height: var(--r-page-h)`, so its computed `min-height` is exactly one
 * page in whatever pixels the browser resolved that page-format/mm value to,
 * and its `offsetHeight` is how tall the content actually runs. This is the
 * same measurement the server print page makes (app/lib/print/print-page.ts),
 * so the editor's browser PDF export picks the same one-/multi-page print
 * rules the server would. The `- 1` is its tolerance too: `offsetHeight` is
 * rounded to whole pixels while A4's 297mm is 1122.52px, so a one-page A4
 * paper reads 1123 and would otherwise count as two.
 *
 * Both reads are transform-invariant (computed style and `offsetHeight`, not
 * `getBoundingClientRect()`), so the count stays correct under an ancestor
 * `transform: scale()` — the fit-to-width zoom the caller applies at narrow
 * viewports — where `getBoundingClientRect()` would shrink with it.
 *
 * Kept deliberately basic per the brief: no fractional pages, no print-aware
 * offset, no `@media print`. A pixel-accurate version is chunk A4's job,
 * which depends on this component existing first.
 */
const PageGuides: FC<PageGuidesProps> = ({ containerRef, onPageCountChange, className }) => {
  const lastCountRef = useRef(1);
  const [pageCount, setPageCount] = useState(1);
  // The paper's own `--r-page-h` token as specified (e.g. "297mm", never a px
  // conversion), re-declared on the overlay so its gradient resolves.
  const [pageHeight, setPageHeight] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
    //
    // Only the container is observed: it wraps the paper, so it resizes
    // whenever the paper does (content, or a page-format switch, which always
    // changes the width), and the paper is looked up fresh on every callback
    // so a remounted paper root is still the one measured.
    const observer = new ResizeObserver(() => {
      const paper = container.firstElementChild;
      if (!(paper instanceof HTMLElement)) return;
      const computed = getComputedStyle(paper);
      setPageHeight(computed.getPropertyValue("--r-page-h").trim() || null);
      const pageHeightPx = parseFloat(computed.minHeight) || 0;
      if (pageHeightPx <= 0) return;
      const next = Math.max(1, Math.ceil((paper.offsetHeight - 1) / pageHeightPx));
      if (next === lastCountRef.current) return;
      lastCountRef.current = next;
      setPageCount(next);
      onPageCountChange?.(next);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [containerRef, onPageCountChange]);

  // This component's one inline style, for the same reason `<ResumePaper/>`
  // has its own: a runtime value (here, the page height read back off the
  // paper) has no static-Tailwind equivalent. It carries the paper's own
  // token rather than a new value, so the guide and the paper can't disagree
  // about the page format.
  const overlayVars: ResumeCssVars | undefined = pageHeight ? { "--r-page-h": pageHeight } : undefined;

  return (
    <div
      aria-hidden
      data-page-count={pageCount}
      style={overlayVars}
      className={cn("pointer-events-none absolute inset-0", PAGE_GUIDE_BG_CLASS, className)}
    />
  );
};

export default PageGuides;
