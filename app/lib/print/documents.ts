// A built resume or a saved letter as a file — PDF or Word — for whoever asked.
//
// Two callers, one answer: `POST /api/extension/document` (the extension
// attaching or downloading) and `GET /open/[kind]/[id]?to=pdf|docx` (a browser
// tab). Both run inside the signed-in user's request; the document is read from
// the AI service AS that user (`x-user-id` from the session, never from the
// request), so another user's id is a plain 404.
//
// Word is built here from the same code the editors save with
// (`resumeToDocxBuffer`, `coverToDocxBuffer`), so it works whether or not the PDF
// renderer is up. PDF is `renderPdf`, and when that is off or failing the
// answer says so in the one sentence the extension shows next to its "Download
// the Word file" fallback.
//
// File names are the editors' own: "Jane-Doe-Resume.pdf",
// "Jane-Doe-Cover-Letter.docx" — the name a recruiter sees, not the library label.

import { aiOrNull } from "@/app/lib/ai";
import { BackendError } from "@/app/lib/api/core";
import { backend } from "@/app/lib/backend";
import { DEFAULT_LETTER_DESIGN, letterheadFor, letterTextOf, wordFontFor } from "@/app/lib/cover/presentation";
import type { LetterView } from "@/app/lib/dashboard/types";
import { hydrateDesign, hydrateSections } from "@/app/lib/dashboard/resume/hydrate-design";
import { coverToDocxBuffer, type Letterhead } from "@/app/lib/export/cover";
import { resumeToDocxBuffer } from "@/app/lib/export/resume";
import { safeFileName } from "@/app/lib/export/save";
import type { StoredResumeDocument } from "@/app/lib/resume/api";
import type { Settings } from "@/app/lib/settings/types";
import { MAX_PDF_BYTES, RenderError, renderPdf } from "./render";

export type DocumentFormat = "pdf" | "docx";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME: Record<DocumentFormat, string> = { pdf: "application/pdf", docx: DOCX_MIME };

export type DocumentFileCode = "renderer_unavailable" | "renderer_busy" | "not_found" | "too_large" | "unreadable" | "unavailable";

export type DocumentFileResult =
  | { ok: true; bytes: ArrayBuffer | Uint8Array; fileName: string; mimeType: string; format: DocumentFormat }
  | { ok: false; status: number; code: DocumentFileCode; message: string; retryAfter?: number };

const refuse = (status: number, code: DocumentFileCode, message: string, retryAfter?: number): DocumentFileResult => ({
  ok: false,
  status,
  code,
  message,
  ...(retryAfter ? { retryAfter } : {}),
});

const NOT_FOUND = refuse(404, "not_found", "That document was not found.");

/** An AI-service read that failed for a reason other than "not yours / not there". */
const unavailable = (error: unknown): DocumentFileResult =>
  error instanceof BackendError && error.status === 404 ? NOT_FOUND : refuse(502, "unavailable", "That document could not be read right now.");

/** "Jane Doe" -> "Jane-Doe-<suffix>", as the editors name their downloads. */
const personFileBase = (name: string | null | undefined, suffix: string): string =>
  safeFileName(name?.trim() ? `${name.trim().replace(/\s+/g, "-")}-${suffix}` : suffix);

const tooLarge = (bytes: { byteLength: number }): boolean => bytes.byteLength > MAX_PDF_BYTES;

function fromRenderError(error: unknown): DocumentFileResult {
  if (error instanceof RenderError) {
    if (error.reason) console.warn("[print] a PDF render was refused", { code: error.code, reason: error.reason });
    return refuse(error.status, error.code, error.message, error.retryAfter);
  }
  console.error("[print] a PDF render failed", error);
  return refuse(503, "renderer_unavailable", "PDFs aren't available right now. Download the Word file instead.");
}

// ---------------------------------------------------------------------------
// Reads, as the user
// ---------------------------------------------------------------------------

export const loadBuiltResume = (userId: string, id: string): Promise<StoredResumeDocument | null> =>
  aiOrNull<StoredResumeDocument>(`/resume/documents/${encodeURIComponent(id)}`, { userId });

export const loadLetter = (userId: string, id: string): Promise<LetterView | null> =>
  aiOrNull<LetterView>(`/cover/letters/${encodeURIComponent(id)}`, { userId });

/**
 * The profile, for a letter's letterhead and its file name. Through the backend
 * with the caller's session cookie — the only way this app reads a profile.
 * Null when it cannot be read: the letter still downloads, without a letterhead.
 */
async function readProfile(): Promise<Settings["profile"] | null> {
  try {
    const settings = await backend<Settings>("/settings/me", { session: true });
    return settings.profile ?? null;
  } catch (error) {
    console.warn("[print] the profile could not be read for a letterhead", error instanceof Error ? error.message : error);
    return null;
  }
}

/** A letter's letterhead as the editor would print it, and the name its file is saved under. */
export async function letterPresentation(letter: LetterView): Promise<{ letterhead: Letterhead | null; fileBase: string }> {
  const design = letter.design ?? DEFAULT_LETTER_DESIGN;
  const profile = await readProfile();
  return { letterhead: letterheadFor(design.letterhead, profile), fileBase: personFileBase(profile?.fullName, "Cover-Letter") };
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** A built resume (an `ai_documents` resume) as a PDF or a Word file. */
export async function builtResumeFile(userId: string, id: string, format: DocumentFormat): Promise<DocumentFileResult> {
  let doc: StoredResumeDocument | null;
  try {
    doc = await loadBuiltResume(userId, id);
  } catch (error) {
    return unavailable(error);
  }
  if (!doc) return NOT_FOUND;

  const fileName = `${personFileBase(doc.content?.name, "Resume")}.${format}`;
  let bytes: ArrayBuffer | Uint8Array;
  if (format === "docx") {
    try {
      bytes = await resumeToDocxBuffer(doc.content, hydrateDesign(doc.template, doc.design), hydrateSections(doc.template, doc.sections));
    } catch (error) {
      console.error("[print] a resume could not be built as Word", error);
      return refuse(422, "unreadable", "That resume couldn't be turned into a Word file.");
    }
  } else {
    try {
      bytes = await renderPdf({ userId, kind: "resume", id, updatedAt: doc.updatedAt });
    } catch (error) {
      return fromRenderError(error);
    }
  }
  if (tooLarge(bytes)) return refuse(413, "too_large", "That file is larger than 4MB, so it can't be sent through here.");
  return { ok: true, bytes, fileName, mimeType: MIME[format], format };
}

/** A saved letter as a PDF or a Word file, with the letterhead its design asks for. */
export async function letterFile(userId: string, id: string, format: DocumentFormat): Promise<DocumentFileResult> {
  let letter: LetterView | null;
  try {
    letter = await loadLetter(userId, id);
  } catch (error) {
    return unavailable(error);
  }
  if (!letter) return NOT_FOUND;

  const { letterhead, fileBase } = await letterPresentation(letter);
  const fileName = `${fileBase}.${format}`;
  let bytes: ArrayBuffer | Uint8Array;
  if (format === "docx") {
    // What the editor's own Word export reads: the text as edited, else the letter as written.
    const text = letter.content.text?.trim() ? letter.content.text : letterTextOf(letter.content);
    if (!text.trim()) return refuse(422, "unreadable", "That letter is empty.");
    try {
      bytes = await coverToDocxBuffer(text, letterhead, wordFontFor((letter.design ?? DEFAULT_LETTER_DESIGN).font));
    } catch (error) {
      console.error("[print] a letter could not be built as Word", error);
      return refuse(422, "unreadable", "That letter couldn't be turned into a Word file.");
    }
  } else {
    try {
      bytes = await renderPdf({ userId, kind: "letter", id, updatedAt: letter.updatedAt, letterhead });
    } catch (error) {
      return fromRenderError(error);
    }
  }
  if (tooLarge(bytes)) return refuse(413, "too_large", "That file is larger than 4MB, so it can't be sent through here.");
  return { ok: true, bytes, fileName, mimeType: MIME[format], format };
}
