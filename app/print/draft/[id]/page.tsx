// An apply-step resume, alone on a page, for Chromium on the AI host to print.
//
// Owner, 2026-10-22 (PHASE6-OPEN-ITEMS-PLAN.md item I): the apply step's "Download as PDF" went
// through the browser's print dialog, and "Microsoft Print to PDF" (always the printer in the
// Claude desktop app) turns the text into outlines no ATS can read. This page lets the renderer
// make that PDF instead, with real text.
//
// The same contract as /print/resume/[id]: not a page anyone visits; without a valid
// `x-rww-print-token` for this kind and id it is a 404, the same 404 as a resume that does not
// exist. The token names the user; the resume is read from the AI service as them.
//
// What it draws differs: an apply draft (or the original it was made from) is an ingested resume
// (`ai_resumes`), with no design of its own. The step shows it as `ResumePaper` in the creator's
// default look with the parts hidden for this application left off, and `draftPaper` is exactly
// that, shared with the Word file and the dialog fallback.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ResumePaper from "@/app/components/dashboard/resume/paper/ClientResumePaper";
import { cn } from "@/lib/utils";
import { ALL_FONT_VARS } from "@/app/lib/dashboard/resume/fonts";
import { RESUME_PLACEHOLDER_CSS, resumePrintSpec } from "@/app/lib/export/print-css";
import { draftPaper } from "@/app/lib/print/draft-paper";
import { loadDraftResume } from "@/app/lib/print/documents";
import { PRINT_BOOT_SCRIPT, PRINT_ROOT_ATTRIBUTE, PRINT_SHELL_CSS, printReadyScript, printVariant } from "@/app/lib/print/print-page";
import { PRINT_TOKEN_HEADER, verifyPrintToken } from "@/app/lib/print/token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Absolute: the print title becomes the PDF's own title, so the site name stays off it.
  title: { absolute: "Resume" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const OBJECT_ID = /^[a-f\d]{24}$/i;

export default async function PrintDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!OBJECT_ID.test(id)) notFound();

  const token = verifyPrintToken((await headers()).get(PRINT_TOKEN_HEADER), { kind: "draft", id });
  if (!token) notFound();

  const row = await loadDraftResume(token.u, id);
  if (!row || row.status !== "ready" || !row.content) notFound();

  const { design, sections, content } = draftPaper(row.content);
  const single = resumePrintSpec(design, false);
  const multi = resumePrintSpec(design, true);
  const extraForMulti = multi.className
    .split(" ")
    .filter((name) => !single.className.split(" ").includes(name))
    .join(" ");

  const ready = printReadyScript({
    measure: true,
    single: printVariant(single.pageSize, single.pageMargin, single.css),
    multi: printVariant(multi.pageSize, multi.pageMargin, multi.css, extraForMulti),
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_SHELL_CSS + RESUME_PLACEHOLDER_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: PRINT_BOOT_SCRIPT }} />
      <div {...{ [PRINT_ROOT_ATTRIBUTE]: "" }} className={cn(single.className, ALL_FONT_VARS)}>
        <ResumePaper design={design} sections={sections} content={content} chrome={design.chrome} />
      </div>
      <script dangerouslySetInnerHTML={{ __html: ready }} />
    </>
  );
}
