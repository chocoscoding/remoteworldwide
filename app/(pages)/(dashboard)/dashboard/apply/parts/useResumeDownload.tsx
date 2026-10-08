"use client";

// Downloading a resume from the apply wizard as PDF or Word (owner,
// 2026-10-03), the way the resume creator does it: Word is built from the
// content; PDF prints the resume creator's own paper through the browser's
// print dialog. The paper is drawn off screen for the print, in the default
// look the wizard shows it in. The change highlights never print: they are
// painted over the page, never part of it.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ResumePaper } from "@/app/components/dashboard/resume/paper";
import { apiMessage } from "@/app/lib/api/core";
import { DEFAULT_DESIGN, DEFAULT_SECTIONS, withContentSections } from "@/app/lib/dashboard/resume/design-defaults";
import { ALL_FONT_VARS } from "@/app/lib/dashboard/resume/fonts";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { resumePrintSpec } from "@/app/lib/export/print-css";
import { resumeToDocx } from "@/app/lib/export/resume";
import { printDocument, safeFileName, saveBlob } from "@/app/lib/export/save";
import { cn } from "@/lib/utils";

export type ResumeDownloadFormat = "pdf" | "docx";

/** A page's height at 96dpi, to tell a one-page resume from a longer one: Letter is 11in, A4 297mm. */
const PAGE_HEIGHT_PX = { letter: 1056, a4: 1123 } as const;

/** A resume's name as a file name: no extension of its own ("cv.pdf for Acme" saves as "cv for Acme.pdf"). */
const fileBase = (name: string) => safeFileName(name.replace(/\.(pdf|docx?|txt|md)\b/gi, ""));

export function useResumeDownload(): {
  download: (content: ResumeContent, name: string, format: ResumeDownloadFormat) => void;
  /** The off-screen paper a PDF is printed from: render it anywhere in the step. */
  printer: ReactNode;
} {
  const [printing, setPrinting] = useState<{ content: ResumeContent; title: string } | null>(null);
  const holder = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!printing) return;
    // A frame for the paper to lay out before it is copied.
    const frame = requestAnimationFrame(() => {
      const paper = holder.current?.firstElementChild;
      if (!(paper instanceof HTMLElement)) {
        setPrinting(null);
        return;
      }
      // As the creator prints: an empty section's "No … added yet." prompt is for the editor, not the page.
      const copy = paper.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("[data-resume-placeholder]").forEach((node) => (node.closest("[data-resume-section]") ?? node).remove());
      const print = resumePrintSpec(DEFAULT_DESIGN, paper.offsetHeight > PAGE_HEIGHT_PX[DEFAULT_DESIGN.doc.pageFormat] + 4);
      void printDocument({
        title: printing.title,
        html: `<div class="${print.className}">${copy.outerHTML}</div>`,
        pageSize: print.pageSize,
        pageMargin: print.pageMargin,
        bodyClass: ALL_FONT_VARS,
        css: print.css,
      })
        .catch((error: unknown) => toast.error(apiMessage(error)))
        .finally(() => setPrinting(null));
    });
    return () => cancelAnimationFrame(frame);
  }, [printing]);

  function download(content: ResumeContent, name: string, format: ResumeDownloadFormat) {
    const title = fileBase(name);
    if (format === "pdf") {
      setPrinting({ content, title });
      return;
    }
    void resumeToDocx(content, DEFAULT_DESIGN, withContentSections(DEFAULT_SECTIONS, content))
      .then((blob) => saveBlob(blob, `${title}.docx`))
      .catch((error: unknown) => toast.error(apiMessage(error)));
  }

  const printer = printing ? (
    <div ref={holder} aria-hidden className={cn("pointer-events-none fixed left-[-10000px] top-0", ALL_FONT_VARS)}>
      <ResumePaper design={DEFAULT_DESIGN} sections={withContentSections(DEFAULT_SECTIONS, printing.content)} content={printing.content} chrome={DEFAULT_DESIGN.chrome} />
    </div>
  ) : null;

  return { download, printer };
}
