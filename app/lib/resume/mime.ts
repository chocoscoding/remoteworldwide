// What the resume parser can read, by file extension.
//
// Pure and dependency-free so both halves can import it: the browser's picker
// (`app/lib/resume/api.ts`, which reads a `File`) and the server-side ingest
// bridge (`app/api/ats/resume-for-doc/route.ts`, which only ever has a
// filename). Two copies of this table is how a file type gets accepted by one
// and refused by the other.

/**
 * `.doc` is deliberately absent: the extractor uses mammoth, which reads the
 * XML format only, so a legacy `.doc` would be accepted here and then refused
 * by the AI service.
 */
export const TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
};

export const RESUME_ACCEPT = ".pdf,.docx,.txt,.md";

/** The copy every refusal shares, so the picker and the toast agree. */
export const RESUME_TYPES_HINT = "Upload a PDF, DOCX, TXT or MD file";

/**
 * The AI service accepts a 10MB JSON body and base64 costs four bytes for
 * every three, so 7MB of file is 9.4MB of body.
 */
export const MAX_RESUME_BYTES = 7 * 1024 * 1024;

/** The declared type for a filename, or null when the parser cannot read it. */
export function mimeForFileName(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return TYPES_BY_EXTENSION[extension] ?? null;
}

/** True when `declared` is a type the parser reads. */
export const isReadableMime = (declared: string): boolean =>
  Object.values(TYPES_BY_EXTENSION).includes(declared.split(";")[0].toLowerCase().trim());
