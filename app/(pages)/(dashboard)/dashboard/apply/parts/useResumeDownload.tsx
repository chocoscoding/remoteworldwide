"use client";

// Downloading a resume from the apply wizard as PDF or Word (owner,
// 2026-10-03), the way the resume creator does it: Word is built from the
// content; PDF prints the resume creator's own paper through the browser's
// print dialog. The paper is drawn off screen for the print, in the default
// look the wizard shows it in. The change highlights never print: they are
// painted over the page, never part of it.
//
// Owner, 2026-10-22 (PHASE6-OPEN-ITEMS-PLAN.md item I): a PDF now comes from the server renderer
// (/open/draft/{id}), because the print dialog's "Microsoft Print to PDF" leaves no text an ATS can
// read. The dialog is only the fallback: no saved resume to name, the renderer off or failing, or
// the page showing something the server does not hold yet.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ResumePaper } from "@/app/components/dashboard/resume/paper";
import { apiMessage } from "@/app/lib/api/core";
import { DEFAULT_DESIGN } from "@/app/lib/dashboard/resume/design-defaults";
import { ALL_FONT_VARS } from "@/app/lib/dashboard/resume/fonts";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { downloadPdf, type ServerPdfSource } from "@/app/lib/export/pdf-download";
import { resumePrintSpec } from "@/app/lib/export/print-css";
import { resumeToDocx } from "@/app/lib/export/resume";
import { printDocument, safeFileName, saveBlob } from "@/app/lib/export/save";
import { draftPaper, type DraftPaper } from "@/app/lib/print/draft-paper";
import { cn } from "@/lib/utils";

export type ResumeDownloadFormat = "pdf" | "docx";

/** A page's height at 96dpi, to tell a one-page resume from a longer one: Letter is 11in, A4 297mm. */
const PAGE_HEIGHT_PX = { letter: 1056, a4: 1123 } as const;

/** A resume's name as a file name: no extension of its own ("cv.pdf for Acme" saves as "cv for Acme.pdf"). */
const fileBase = (name: string) => safeFileName(name.replace(/\.(pdf|docx?|txt|md)\b/gi, ""));

export function useResumeDownload(): {
  /** `from`: the saved resume the content is (id and the version shown), for the server's PDF. */
  download: (content: ResumeContent, name: string, format: ResumeDownloadFormat, from?: { id: string; version: number | null | undefined } | null) => void;
  /** The off-screen paper a PDF is printed from: render it anywhere in the step. */
  printer: ReactNode;
} {
  const [printing, setPrinting] = useState<{ paper: DraftPaper; title: string } | null>(null);
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

  function download(whole: ResumeContent, name: string, format: ResumeDownloadFormat, from?: { id: string; version: number | null | undefined } | null) {
    // What is hidden for this application (the step's eyes) never goes into the file: the same
    // paper the server's print page draws (draft-paper.ts).
    const paper = draftPaper(whole);
    const title = fileBase(name);
    if (format === "pdf") {
      const source: ServerPdfSource | null = from ? { kind: "draft", id: from.id, version: from.version } : null;
      const waiting = source ? toast.loading("Making your PDF") : null;
      void downloadPdf({ source, fileName: title, save: saveBlob, fallback: () => {
        if (!source) { setPrinting({ paper, title }); return; }
        toast.error("PDF download could not finish. Your draft is saved.", {
          description: "Retry the download, or choose Word from the download menu.",
          action: { label: "Retry PDF", onClick: () => download(whole, name, "pdf", from) },
          duration: 15000,
        });
      } })
        .catch((error: unknown) => toast.error(apiMessage(error)))
        .finally(() => waiting !== null && toast.dismiss(waiting));
      return;
    }
    void resumeToDocx(paper.content, paper.design, paper.sections)
      .then((blob) => saveBlob(blob, `${title}.docx`))
      .catch((error: unknown) => toast.error(apiMessage(error)));
  }

  const printer = printing ? (
    <div ref={holder} aria-hidden className={cn("pointer-events-none fixed left-[-10000px] top-0", ALL_FONT_VARS)}>
      <ResumePaper design={printing.paper.design} sections={printing.paper.sections} content={printing.paper.content} chrome={printing.paper.design.chrome} />
    </div>
  ) : null;

  return { download, printer };
}
