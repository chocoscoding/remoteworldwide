// The CSS a printed resume or letter is laid out with — shared by the two places
// a PDF comes from, so they cannot drift:
//
//   browser -> `printDocument` (./save.ts), a hidden frame and the print dialog
//   server  -> `/print/resume/[id]` and `/print/letter/[id]`, which Chromium on
//              the AI host prints (app/lib/print/render.ts)
//
// Pure strings, no DOM and no imports beyond types: the print pages inline them
// into a <style> and a <script>, and the browser path writes them into the
// frame. A resume whose second page breaks differently depending on which of
// the two made the PDF is the bug this file exists to prevent.

import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";

/**
 * Around every printed document: the page box, a white sheet with no body
 * margin, and colours kept — a browser drops backgrounds by default, which
 * would print a filled sidebar as white text on white.
 */
export const printFrameCss = (pageSize: string, pageMargin: string): string =>
  `@page{size:${pageSize};margin:${pageMargin};}html,body{margin:0;padding:0;background:#fff;min-height:0;}` +
  `*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}`;

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export interface ResumePrintSpec {
  /** Classes for the element wrapping the paper. The multi-page rules key off it. */
  className: string;
  /** CSS `@page` size. */
  pageSize: "A4" | "Letter";
  /** CSS `@page` margin. */
  pageMargin: string;
  /** Print-only rules for the paper, beyond `printFrameCss`. */
  css: string;
}

/**
 * How a resume prints.
 *
 * One page prints edge to edge, exactly as previewed. More than one takes the
 * design's vertical margin on every page instead, since the paper's own top
 * and bottom padding would otherwise land only on the first and last. A list
 * item never splits across pages, and the editor's page-break label is hidden
 * while the break itself stays.
 */
export function resumePrintSpec(design: Pick<ResumeDesign, "doc" | "spacing">, multi: boolean): ResumePrintSpec {
  return {
    className: `rww-print${multi ? " rww-print-multi" : ""}`,
    pageSize: design.doc.pageFormat === "a4" ? "A4" : "Letter",
    pageMargin: multi ? `${design.spacing.marginYmm}mm 0` : "0",
    css:
      ".rww-print li{break-inside:avoid;}.rww-print [data-resume-page-break]{visibility:hidden;height:0;overflow:hidden;}" +
      (multi ? ".rww-print-multi>*{min-height:0!important;padding-top:0!important;padding-bottom:0!important;}" : ""),
  };
}

/**
 * The editor's "No … added yet." prompts and the empty-name hint are for the
 * editor. The browser export deletes them from its copy of the paper (a section
 * holding only a prompt goes with it); a server-rendered page cannot touch the
 * DOM React is about to hydrate, so it hides the same nodes instead.
 */
export const RESUME_PLACEHOLDER_CSS =
  ".rww-print [data-resume-section]:has([data-resume-placeholder]),.rww-print [data-resume-placeholder]{display:none!important;}";

// ---------------------------------------------------------------------------
// Cover letter
// ---------------------------------------------------------------------------

/** A letter has no page-size control, so the printer's default stands. */
export const LETTER_PAGE_SIZE = "auto";
export const LETTER_PAGE_MARGIN = "22mm 20mm";
export const LETTER_PRINT_CSS = "main{color:#222325;}main p{margin:0 0 0.9em;}main ul,main ol{margin:0 0 0.9em 1.4em;}";
