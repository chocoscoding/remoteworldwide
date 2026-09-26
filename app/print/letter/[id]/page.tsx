// A saved cover letter, alone on a page, for Chromium on the AI host to print.
//
// The same arrangement as `/print/resume/[id]` (read that header first): a 404
// without a valid `x-rww-print-token` for this letter, read from the AI service
// as the user the token names, top-level, dynamic, never indexed or cached.
//
// Laid out as the cover editor prints it (`printLetter` in
// dashboard/cover/Client.tsx): the letter's font and spacing classes from
// app/lib/cover/presentation.ts, the letterhead above the body, and print-css.ts's
// page margin and rules.
//
// Two things come from somewhere other than the letter:
//  - The LETTERHEAD is in the token. It is the user's name and contacts from
//    their profile, which lives in the backend behind their session cookie —
//    which Chromium does not have. So app/lib/print/documents.ts resolves it
//    while it still has the user's request, and `renderPdf` signs it into the
//    token alongside the letter id.
//  - The BODY is the editor's saved HTML, stored as sent, so it is sanitised
//    here (`sanitizeLetterHtmlServer`, the browser's allowlist through
//    sanitize-html) before it goes anywhere near the page.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { DEFAULT_LETTER_DESIGN, FONT_CLASS, SPACING_CLASS, lettersToHtml } from "@/app/lib/cover/presentation";
import { letterheadHtml, textToLetterHtml } from "@/app/lib/export/cover";
import { sanitizeLetterHtmlServer } from "@/app/lib/export/letter-sanitize";
import { LETTER_PAGE_MARGIN, LETTER_PAGE_SIZE, LETTER_PRINT_CSS } from "@/app/lib/export/print-css";
import { loadLetter } from "@/app/lib/print/documents";
import { PRINT_BOOT_SCRIPT, PRINT_ROOT_ATTRIBUTE, PRINT_SHELL_CSS, printReadyScript, printVariant } from "@/app/lib/print/print-page";
import { PRINT_TOKEN_HEADER, verifyPrintToken } from "@/app/lib/print/token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cover letter",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const OBJECT_ID = /^[a-f\d]{24}$/i;

const READY = printReadyScript({ measure: false, single: printVariant(LETTER_PAGE_SIZE, LETTER_PAGE_MARGIN, LETTER_PRINT_CSS) });

export default async function PrintLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!OBJECT_ID.test(id)) notFound();

  const token = verifyPrintToken((await headers()).get(PRINT_TOKEN_HEADER), { kind: "letter", id });
  if (!token) notFound();

  const letter = await loadLetter(token.u, id);
  if (!letter) notFound();

  const design = letter.design ?? DEFAULT_LETTER_DESIGN;
  const { content } = letter;
  // The editor's HTML when it has reported some; its text when only that was
  // saved; the letter as written when the editor never touched it (or a
  // revision replaced what it had).
  const body = content.html?.trim()
    ? sanitizeLetterHtmlServer(content.html)
    : content.text?.trim()
      ? textToLetterHtml(content.text)
      : lettersToHtml(content.greeting, content.paragraphs, content.signOff);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_SHELL_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: PRINT_BOOT_SCRIPT }} />
      <div {...{ [PRINT_ROOT_ATTRIBUTE]: "" }}>
        {/* Both halves are safe markup: letterheadHtml escapes the profile's text, and the body is sanitised or built escaped. */}
        <main className={cn(FONT_CLASS[design.font], SPACING_CLASS[design.spacing].text)} dangerouslySetInnerHTML={{ __html: letterheadHtml(token.lh ?? null) + body }} />
      </div>
      <script dangerouslySetInnerHTML={{ __html: READY }} />
    </>
  );
}
