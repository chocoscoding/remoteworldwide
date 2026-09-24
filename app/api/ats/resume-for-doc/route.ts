// The bridge between My documents and the ATS scorer.
//
// A scan names an `ai_resumes` id — a CV that has been parsed, chunked and
// embedded. A vault document is a file in object storage. They are different
// things in different services, and the ATS screen's picker shows the second
// while the scorer needs the first. This route turns one into the other:
//
//   1. Mint a signed link for the document (the backend checks ownership).
//   2. Read the bytes.
//   3. Hand them to the AI service's importer, which answers with a resume id.
//
// Every step is server-side on purpose. The signed URL is a bearer credential
// with an expiry and the object store has no CORS grant for this origin, so a
// browser `fetch` of it would be both a leak of the credential into page
// context and, most likely, blocked. Doing it here also keeps the service
// token where it belongs.
//
// Step 3 is idempotent: the AI service dedupes on a sha256 of the EXTRACTED
// TEXT, not of the bytes, so importing the same CV twice returns the resume
// that already exists (`duplicate: true`) without re-parsing or re-embedding
// it.
//
// Idempotent is not free, though: steps 1-3 still download the file and
// extract its text every time. So the answer is written back onto the document
// (`aiResumeId`, backend `PUT /api/documents/:id/ai-resume`), and a document
// that already carries one is answered from it — one small read, no download —
// as long as the AI service still has that resume ready. A stored file never
// changes, so the link can only go stale by the parsed resume being deleted,
// and then this falls through to importing again, which relinks it.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ai } from "@/app/lib/ai";
import { BackendError } from "@/app/lib/api/core";
import { backend } from "@/app/lib/backend";
import { MAX_RESUME_BYTES, RESUME_TYPES_HINT, isReadableMime, mimeForFileName } from "@/app/lib/resume/mime";
import type { VaultDoc } from "@/app/lib/dashboard/types";

/** Importing parses, chunks and embeds a CV — slower than an ordinary read. */
const IMPORT_TIMEOUT_MS = 60_000;

/** Bounds the read of the object store, which is not this app's to wait on. */
const FETCH_TIMEOUT_MS = 20_000;

interface ImportedResume {
  resumeId: string;
  version: number;
  status: string;
  fileName: string;
  /** Absent when the answer came from the document's link rather than an import. */
  chunkCount?: number;
  duplicate: boolean;
}

/** `GET /api/ai/resume/:id` — the parts the bridge reads. */
interface StoredResume {
  resumeId: string;
  version: number;
  status: string;
  fileName: string;
}

const fail = (status: number, message: string) => NextResponse.json({ success: false, message, data: null }, { status });

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
  if (doc.kind !== "resume") return fail(422, "Only a resume can be scored. Change this document's type to resume first.");

  // Already parsed: the link written the first time, if the AI service still
  // has that resume ready. Anything else — gone, failed, the service briefly
  // unreachable — falls through to importing, which is always correct.
  if (doc.aiResumeId) {
    try {
      const known = await ai<StoredResume>(`/resume/${encodeURIComponent(doc.aiResumeId)}`, { userId: session.user.id });
      if (known.status === "ready") {
        const data: ImportedResume = { resumeId: known.resumeId, version: known.version, status: known.status, fileName: known.fileName, duplicate: true };
        return NextResponse.json({ success: true, message: "Resume ready", data });
      }
    } catch {
      // Import below.
    }
  }

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
    // there is no point streaming 40MB into memory to refuse it afterwards.
    const declaredLength = Number(res.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_RESUME_BYTES) return fail(413, "That file is larger than 7MB.");

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
  if (bytes.byteLength > MAX_RESUME_BYTES) return fail(413, "That file is larger than 7MB.");

  try {
    const imported = await ai<ImportedResume>("/resume/imports", {
      method: "POST",
      body: { fileName, mimeType, data: Buffer.from(bytes).toString("base64") },
      userId: session.user.id,
      timeoutMs: IMPORT_TIMEOUT_MS,
    });
    // Remember it on the document, so the next ask skips all of the above.
    // Best-effort: a link that failed to save costs one more download later,
    // never this answer.
    if (imported.status === "ready" && imported.resumeId !== doc.aiResumeId) {
      await backend(`/documents/${encodeURIComponent(documentId)}/ai-resume`, {
        method: "PUT",
        body: { aiResumeId: imported.resumeId },
        session: true,
      }).catch(() => undefined);
    }
    return NextResponse.json({ success: true, message: "Resume ready", data: imported });
  } catch (error) {
    // The AI service's own wording for a file a person can fix themselves — an
    // unreadable PDF, a scan with no text — is better than anything invented here.
    if (error instanceof BackendError) return fail(error.status, error.message);
    return fail(502, "That resume could not be prepared for scoring.");
  }
}
