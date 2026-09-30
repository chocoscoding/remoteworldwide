// A file from My documents, read server-side, for the browser extension.
//
// A careers form wants a FILE on a file input, so the extension needs the
// bytes — a link will not do. It cannot fetch them itself: the vault's storage
// link is a signed, time-limited bearer credential and the object store grants
// CORS to nobody, so reading it from the extension's own contexts would both
// hand that credential to code running next to a page we do not control and,
// in a content script, be blocked outright. So the site reads the store
// server-side and answers with the bytes. The signed URL is minted here, used
// here, and never leaves this function.
//
// Factored out of `app/api/extension/resume/route.ts` (which now wraps it for
// resumes only) so `app/api/extension/document/route.ts` can send cover letters
// too, and `/open/file/[id]` can offer the same download. Answers a result, not
// a Response: the two extension routes shape their refusals differently (the
// old one's envelope has no `code`), and the file headers are `fileResponse`.
//
// The 4MB cap is not `MAX_RESUME_BYTES` (7MB). A Vercel serverless function's
// response body may not exceed 4.5MB, so a larger CV would die as a platform
// error with no sentence anyone could act on. Refusing it here at least says
// what to do instead.

import { BackendError } from "@/app/lib/api/core";
import { backend } from "@/app/lib/backend";
import { RESUME_TYPES_HINT, isReadableMime, mimeForFileName } from "@/app/lib/resume/mime";
import type { DocKind, VaultDoc } from "@/app/lib/dashboard/types";

/** Vercel's serverless response ceiling is 4.5MB; this leaves room for headers. */
export const MAX_STREAM_BYTES = 4 * 1024 * 1024;

/** Bounds the read of the object store, which is not this app's to wait on. */
const FETCH_TIMEOUT_MS = 20_000;

export const TOO_LARGE_MESSAGE = "That file is larger than 4MB, so it can't be sent through here — attach it to the form yourself.";

export type VaultFileCode = "not_found" | "wrong_kind" | "too_large" | "unreadable" | "unavailable";

export type VaultFileResult =
  | { ok: true; bytes: ArrayBuffer; fileName: string; mimeType: string; kind: DocKind }
  | { ok: false; status: number; code: VaultFileCode; message: string };

const refuse = (status: number, code: VaultFileCode, message: string): VaultFileResult => ({ ok: false, status, code, message });

const KIND_NAMES: Partial<Record<DocKind, string>> = { resume: "a resume", "cover-letter": "a cover letter" };

/** "Only a resume can be attached…" / "Only a resume or a cover letter can be attached…" */
function wrongKindMessage(kinds: readonly DocKind[]): string {
  const names = kinds.map((kind) => KIND_NAMES[kind] ?? kind);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0];
  const type = kinds.length === 1 ? kinds[0] : "one of those";
  return `Only ${list} can be attached. Change this document's type to ${type} first.`;
}

/**
 * The bytes of one of the signed-in user's documents, when it is one of `kinds`
 * and small enough to send. Must run inside a request: it forwards the caller's
 * session cookie to the backend, which is the only place ownership is checked.
 */
export async function streamVaultFile(documentId: string, { kinds }: { kinds: readonly DocKind[] }): Promise<VaultFileResult> {
  // The document row, for its real filename and kind. Read from the backend
  // rather than taken from the request: the client may name a document, but it
  // does not get to say what that document is called or what type it is.
  let doc: VaultDoc | undefined;
  try {
    const docs = await backend<VaultDoc[]>("/documents", { session: true });
    doc = docs.find((candidate) => candidate.id === documentId);
  } catch (error) {
    return refuse(error instanceof BackendError ? error.status : 502, "unavailable", "That document could not be read right now.");
  }
  if (!doc) return refuse(404, "not_found", "That document was not found.");
  if (!kinds.includes(doc.kind)) return refuse(422, "wrong_kind", wrongKindMessage(kinds));

  const fileName = doc.ext ? `${doc.name}.${doc.ext}` : doc.name;
  const mimeType = mimeForFileName(fileName);
  if (!mimeType) return refuse(422, "unreadable", `${RESUME_TYPES_HINT} — this one can't be read.`);

  // A signed URL, minted per call and never stored. The backend is the only
  // place ownership is checked, and it answers 404 for someone else's row.
  let url: string;
  try {
    const link = await backend<{ url: string; expiresAt: number }>(`/documents/${encodeURIComponent(documentId)}/link`, { session: true });
    url = link.url;
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return refuse(404, "not_found", "That document was not found.");
    return refuse(502, "unavailable", "That document could not be opened right now.");
  }

  let bytes: ArrayBuffer;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return refuse(502, "unavailable", "That document could not be downloaded.");

    // Checked before reading the body: a content-length past the ceiling means
    // there is no point streaming the whole file into memory to refuse it after.
    const declaredLength = Number(res.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_STREAM_BYTES) return refuse(413, "too_large", TOO_LARGE_MESSAGE);

    const declaredType = res.headers.get("content-type") ?? "";
    // The type was already decided from the name; this only catches a store
    // serving something else entirely under a .pdf name.
    if (declaredType && !isReadableMime(declaredType) && !declaredType.startsWith("application/octet-stream")) {
      return refuse(422, "unreadable", `${RESUME_TYPES_HINT} — this one can't be read.`);
    }

    bytes = await res.arrayBuffer();
  } catch {
    return refuse(502, "unavailable", "That document could not be downloaded.");
  }

  if (bytes.byteLength === 0) return refuse(422, "unreadable", "That file is empty.");
  // The real check, for a store that sent no content-length.
  if (bytes.byteLength > MAX_STREAM_BYTES) return refuse(413, "too_large", TOO_LARGE_MESSAGE);

  return { ok: true, bytes, fileName, mimeType, kind: doc.kind };
}

/**
 * A header value may only carry printable ASCII, and a quote or backslash would
 * end the `filename="…"` parameter early. The exact name still travels intact
 * in `filename*`, which is what a browser prefers anyway.
 */
export const headerSafe = (name: string): string => name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

export interface FileResponseOptions {
  /** `attachment` (the default) saves; `inline` lets a browser tab show a PDF. */
  disposition?: "attachment" | "inline";
  /** `x-rww-format` — what the extension reads to name and route the file. Omitted by the legacy route. */
  format?: string;
}

/** The bytes, named. Shared by every route that hands a document over, so they all name a file the same way. */
export function fileResponse(bytes: ArrayBuffer | Uint8Array, fileName: string, mimeType: string, { disposition = "attachment", format }: FileResponseOptions = {}): Response {
  const headers: Record<string, string> = {
    "content-type": mimeType,
    // `filename*` carries the name exactly; `filename` is the ASCII fallback.
    "content-disposition": `${disposition}; filename="${headerSafe(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    // What the extension reads to name the `File` it builds. ASCII-folded for
    // the same reason as above — the exact name is in `filename*`.
    "x-rww-filename": headerSafe(fileName),
    "cache-control": "no-store",
  };
  if (format) headers["x-rww-format"] = format;
  // A Buffer can be a view into a shared pool; copying it sends exactly its bytes and nothing around them.
  const body = bytes instanceof Uint8Array ? new Uint8Array(bytes) : bytes;
  return new Response(body, { headers });
}
