// A built resume, alone on a page, for Chromium on the AI host to print.
//
// Not a page anyone visits. The AI service's renderer opens it with the
// `x-rww-print-token` header (app/lib/print/token.ts), and without a valid one
// for this exact resume it is a 404 — the same 404 as a resume that does not
// exist, so it confirms nothing. The token names the user; the resume is read
// from the AI service as them, with the service token, like any server call.
//
// What it draws is `ResumePaper` itself — the component the editor previews
// with, fed the same hydrated design — so the PDF is the template the user
// chose, in its fonts, as real text. Imported directly rather than through the
// paper barrel, which also carries the editor's client-side `PageGuides`.
//
// The page CSS is print-css.ts's, shared with the browser's own export; the
// editor-only placeholders are hidden rather than removed (removing them would
// fight hydration). `printReadyScript` measures the laid-out paper, applies the
// one-page or multi-page rules, and tells the renderer it can print.
//
// Top-level (outside the dashboard, whose layout requires a session), dynamic,
// never indexed, never cached, and it sends no Referer — see next.config.mjs
// for the headers and robots.ts for the crawl rule.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ResumePaper from "@/app/components/dashboard/resume/paper/ResumePaper";
import { cn } from "@/lib/utils";
import { ALL_FONT_VARS } from "@/app/lib/dashboard/resume/fonts";
import { hydrateDesign, hydrateSections } from "@/app/lib/dashboard/resume/hydrate-design";
import { RESUME_PLACEHOLDER_CSS, resumePrintSpec } from "@/app/lib/export/print-css";
import { loadBuiltResume } from "@/app/lib/print/documents";
import { reconcileGroups } from "@/app/lib/resume/skills";
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

export default async function PrintResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!OBJECT_ID.test(id)) notFound();

  const token = verifyPrintToken((await headers()).get(PRINT_TOKEN_HEADER), { kind: "resume", id });
  if (!token) notFound();

  const doc = await loadBuiltResume(token.u, id);
  if (!doc) notFound();

  const design = hydrateDesign(doc.template, doc.design);
  const sections = hydrateSections(doc.template, doc.sections);
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
        <ResumePaper design={design} sections={sections} content={reconcileGroups(doc.content)} chrome={design.chrome} />
      </div>
      <script dangerouslySetInnerHTML={{ __html: ready }} />
    </>
  );
}
