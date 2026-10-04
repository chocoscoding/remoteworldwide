"use client";

// A resume as separate pages, the way Word shows a document (owner,
// 2026-10-04): every page its own A4 sheet, a small gap between them, page 1,
// 2, 3 down the screen.
//
// The pages are found by the browser's own fragmentation, the way a print
// finds them. The paper flows through page-tall columns laid out the way
// `resumePrintSpec` prints a multi-page resume: each page keeps the design's
// top and bottom margin (the paper's own vertical padding is dropped), a
// bullet never splits across pages, and a Page Break section starts a new page
// (its on-screen marker is hidden, as it is in print). Each sheet then shows
// one of those columns, so what page 2 shows here is what page 2 of the PDF
// says, and a line is never cut in half at a page edge.
//
// Every sheet renders the whole resume and shows its own column of it: a page
// is a window, not a slice of the data, so nothing about the paper itself (its
// templates, chrome or sections) has to know it is paged. The first sheet's
// column layout is measured for the page count.
//
// The second place in the paper feature that owns an inline `style={}` (after
// `ResumePaper`): the sheets are sized by the design's own `--r-*` variables,
// and each column is shifted by its page number, a runtime value.

import { useEffect, useRef, useState, type CSSProperties, type FC } from "react";
import { designToCssVars } from "@/app/lib/dashboard/resume/design-to-css";
import { cn } from "@/lib/utils";
import ResumePaper, { type ResumePaperProps } from "./ResumePaper";

/**
 * Space between one page's column and the next. Any width keeps a neighbour
 * out of a sheet (the sheet clips at its own edge); this much also keeps a
 * template's full-bleed band from peeking into the page before it.
 */
const COLUMN_GAP_PX = 48;

/**
 * The flow: page-tall columns, one page wide, starting at the top margin. Its
 * width is one page, so every column after the first overflows to the right at
 * a fixed pitch, which is what each sheet shifts by. The rules after the
 * column settings are `resumePrintSpec`'s for a multi-page print.
 */
const FLOW_CLASS = cn(
  "absolute top-[var(--r-my)] h-[calc(var(--r-page-h)-2*var(--r-my))] w-[var(--r-page-w)]",
  "[column-fill:auto] [column-gap:48px] [column-width:var(--r-page-w)]",
  "[&_li]:break-inside-avoid",
  "[&_[data-resume-page-break]]:invisible [&_[data-resume-page-break]]:h-0 [&_[data-resume-page-break]]:overflow-hidden [&_[data-resume-page-break]]:[break-after:column]",
);

export interface PagedResumeProps extends ResumePaperProps {
  /** Classes for every page sheet: the editor's shadow and corners. */
  sheetClassName?: string;
  /** Pixels between one sheet and the next. */
  gap?: number;
  /** Fires whenever the number of pages changes. */
  onPageCountChange?: (count: number) => void;
}

const PagedResume: FC<PagedResumeProps> = ({ design, sections, content, chrome, className, sheetClassName, gap = 25, onPageCountChange }) => {
  const [pages, setPages] = useState(1);
  const firstFlow = useRef<HTMLDivElement | null>(null);
  const report = useRef(onPageCountChange);
  useEffect(() => {
    report.current = onPageCountChange;
  });

  // How many columns the paper fills: the first flow's overflow, in page widths. Measured on any
  // change to it (an edit, a design change, a resize, fonts arriving), never during render.
  useEffect(() => {
    const flow = firstFlow.current;
    if (!flow) return;
    const measure = () => {
      const width = flow.clientWidth;
      if (width <= 0) return;
      const count = Math.max(1, Math.round((flow.scrollWidth + COLUMN_GAP_PX) / (width + COLUMN_GAP_PX)));
      setPages((prev) => (prev === count ? prev : count));
    };
    const resize = new ResizeObserver(measure);
    resize.observe(flow);
    const mutations = new MutationObserver(measure);
    mutations.observe(flow, { subtree: true, childList: true, characterData: true, attributes: true });
    const frame = requestAnimationFrame(measure);
    void document.fonts?.ready.then(measure);
    return () => {
      resize.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    report.current?.(pages);
  }, [pages]);

  // The design's page size, margins and background for the sheets, which sit outside the paper.
  const vars = { ...designToCssVars(design), rowGap: gap } as CSSProperties;

  return (
    <div style={vars} className={cn("flex w-fit flex-col", className)}>
      {Array.from({ length: pages }, (_, page) => (
        <div
          key={page}
          // Every sheet holds the whole resume; only the first is read out, the rest show the same words further on.
          aria-hidden={page > 0 ? true : undefined}
          className={cn("relative h-[var(--r-page-h)] w-[var(--r-page-w)] flex-none overflow-hidden bg-[color:var(--r-page-bg)]", sheetClassName)}>
          <div
            ref={page === 0 ? firstFlow : undefined}
            className={FLOW_CLASS}
            style={{ left: `calc(${-page} * (var(--r-page-w) + ${COLUMN_GAP_PX}px))` }}>
            <ResumePaper design={design} sections={sections} content={content} chrome={chrome} className="min-h-0 py-0" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default PagedResume;
