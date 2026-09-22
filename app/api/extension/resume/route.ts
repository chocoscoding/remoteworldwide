// The resume file itself, for the browser extension.
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
// Shaped after `app/api/ats/resume-for-doc/route.ts`, which does the same first
// three steps for a different destination (the AI service's importer rather
// than a download), and refuses in the same words where the refusals are the
// same. Kept as its own route rather than a flag on that one: that route
// answers with a resume id and this one with a file, and a route whose response
// type depends on its body is a worse thing to call.
//
// The 4MB cap is not `MAX_RESUME_BYTES` (7MB). A Vercel serverless function's
// response body may not exceed 4.5MB, so a larger CV would die as a platform
// error with no sentence anyone could act on. Refusing it here at least says
// what to do instead.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { BackendError } from "@/app/lib/api/core";
import { backend } from "@/app/lib/backend";
import { RESUME_TYPES_HINT, isReadableMime, mimeForFileName } from "@/app/lib/resume/mime";
import type { VaultDoc } from "@/app/lib/dashboard/types";

/** Vercel's serverless response ceiling is 4.5MB; this leaves room for headers. */
const MAX_STREAM_BYTES = 4 * 1024 * 1024;

/** Bounds the read of the object store, which is not this app's to wait on. */
const FETCH_TIMEOUT_MS = 20_000;

const TOO_LARGE = "That file is larger than 4MB, so it can't be sent through here — attach it to the form yourself.";

/** The site's envelope, so the extension's client can read `message` and show it. */
const fail = (status: number, message: string) => NextResponse.json({ success: false, message, data: null }, { status });

/**
 * A header value may only carry printable ASCII, and a quote or backslash would
 * end the `filename="…"` parameter early. The exact name still travels intact
 * in `filename*`, which is what a browser prefers anyway.
 */
const headerSafe = (name: string) => name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return fail(401, "Sign in to continue.");

  let documentId: string;
  try {
    const body = (await req.json()) as { documentId?: unknown };
    documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  } catch {
    return fail(400, "That request wasn't valid JSON.");
  }
  if (!documentId) return fail(400, "A document is required.");

  // The document row, for its real filename and kind. Read from the backend
  // rather than taken from the request: the client may name a document, but it
  // does not get to say what that document is called or what type it is.
  let doc: VaultDoc | undefined;
  try {
    const docs = await backend<VaultDoc[]>("/documents", { session: true });
    doc = docs.find((candidate) => candidate.id === documentId);
  } catch (error) {
    return fail(error instanceof BackendError ? error.status : 502, "That document could not be read right now.");
  }
  if (!doc) return fail(404, "That document was not found.");
  if (doc.kind !== "resume") return fail(422, "Only a resume can be attached. Change this document's type to resume first.");

  const fileName = doc.ext ? `${doc.name}.${doc.ext}` : doc.name;
  const mimeType = mimeForFileName(fileName);
  if (!mimeType) return fail(422, `${RESUME_TYPES_HINT} — this one can't be read.`);

  // A signed URL, minted per call and never stored. The backend is the only
  // place ownership is checked, and it answers 404 for someone else's row.
  let url: string;
  try {
    const link = await backend<{ url: string; expiresAt: number }>(`/documents/${encodeURIComponent(documentId)}/link`, { session: true });
    url = link.url;
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return fail(404, "That document was not found.");
    return fail(502, "That document could not be opened right now.");
  }

  let bytes: ArrayBuffer;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return fail(502, "That document could not be downloaded.");

    // Checked before reading the body: a content-length past the ceiling means
    // there is no point streaming the whole file into memory to refuse it after.
    const declaredLength = Number(res.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_STREAM_BYTES) return fail(413, TOO_LARGE);

    const declaredType = res.headers.get("content-type") ?? "";
    // The extension already decided the type above; this only catches a store
    // serving something else entirely under a .pdf name.
    if (declaredType && !isReadableMime(declaredType) && !declaredType.startsWith("application/octet-stream")) {
      return fail(422, `${RESUME_TYPES_HINT} — this one can't be read.`);
    }

    bytes = await res.arrayBuffer();
  } catch {
    return fail(502, "That document could not be downloaded.");
  }

  if (bytes.byteLength === 0) return fail(422, "That file is empty.");
  // The real check, for a store that sent no content-length.
  if (bytes.byteLength > MAX_STREAM_BYTES) return fail(413, TOO_LARGE);

  return new NextResponse(bytes, {
    headers: {
      "content-type": mimeType,
      // `filename*` carries the name exactly; `filename` is the ASCII fallback.
      "content-disposition": `attachment; filename="${headerSafe(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      // What the extension reads to name the `File` it builds. ASCII-folded for
      // the same reason as above — the exact name is in `filename*`.
      "x-rww-filename": headerSafe(fileName),
      "cache-control": "no-store",
    },
  });
}
