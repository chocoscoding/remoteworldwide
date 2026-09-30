// Any document the extension can put on a form, as a file.
//
//   POST { source: "vault" | "built" | "letter", id, format?: "pdf" | "docx" }
//
//   vault  — a file from My documents (a resume or a cover letter), sent as it
//            was uploaded; `format` is ignored. `app/lib/extension/vault-file.ts`.
//   built  — a resume from the builder/editor library (`ai_documents`), as a PDF
//            (the default: Chromium prints the site's own template, so it looks
//            exactly like the editor and is real, selectable text) or as Word.
//   letter — a saved cover letter, likewise.
//
// Success: the bytes, with
//   content-type         application/pdf | …wordprocessingml.document | the file's own
//   content-disposition  attachment; filename="<ascii>"; filename*=UTF-8''<exact>
//   x-rww-filename       the ASCII-folded name, for the File the extension builds
//   x-rww-format         pdf | docx | the vault file's extension
//   cache-control        no-store
//
// Refusal: `{ success: false, message, data: { code } }`, `code` one of
//   renderer_unavailable 503  "PDFs aren't available right now. Download the Word file instead."
//   renderer_busy        429  (Retry-After when the renderer gave one)
//   not_found            404
//   wrong_kind           422  a vault file that is neither a resume nor a cover letter
//   too_large            413  over 4MB — a Vercel response cannot carry more
//   unreadable           422  a file type or a document that cannot be sent
//   unavailable          502  the backend or the AI service could not be read
// and the plain envelope (`data: null`) for 400 / 401 / 423.
//
// Identity is the session alone, as in `app/api/ai/[...path]/route.ts`: the
// body names a document, never a user, and the AI service is asked as
// `session.user.id`. Nothing from this request's headers is forwarded upstream
// — every outgoing call builds its headers field by field.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fileResponse, streamVaultFile } from "@/app/lib/extension/vault-file";
import { builtResumeFile, letterFile, type DocumentFileResult, type DocumentFormat } from "@/app/lib/print/documents";

export const runtime = "nodejs";
// A PDF waits on the renderer's queue and one render (bounded at ~45s in
// render.ts). Vercel's default ceiling could cut that off; see OWNER-TASKS.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Source = "vault" | "built" | "letter";
const SOURCES: ReadonlySet<string> = new Set<Source>(["vault", "built", "letter"]);

/** A library (ai_documents) id. */
const OBJECT_ID = /^[a-f\d]{24}$/i;
/** A vault id: checked against the user's own list before it is used, so only its shape is bounded here. */
const VAULT_ID = /^[A-Za-z0-9_-]{1,64}$/;

const fail = (status: number, message: string) => NextResponse.json({ success: false, message, data: null }, { status });

const refuse = (status: number, code: string, message: string, retryAfter?: number) =>
  NextResponse.json({ success: false, message, data: { code } }, { status, headers: retryAfter ? { "retry-after": String(retryAfter) } : undefined });

const answer = (result: DocumentFileResult): Response =>
  result.ok
    ? fileResponse(result.bytes, result.fileName, result.mimeType, { format: result.format })
    : refuse(result.status, result.code, result.message, result.retryAfter);

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail(401, "Sign in to continue.");

  let source: string;
  let id: string;
  let format: string;
  try {
    const body = (await req.json()) as { source?: unknown; id?: unknown; format?: unknown };
    source = typeof body.source === "string" ? body.source : "";
    id = typeof body.id === "string" ? body.id.trim() : "";
    format = body.format === undefined ? "pdf" : typeof body.format === "string" ? body.format : "";
  } catch {
    return fail(400, "That request wasn't valid JSON.");
  }
  if (!SOURCES.has(source)) return fail(400, "Say which kind of document to send.");
  if (format !== "pdf" && format !== "docx") return fail(400, "A document can be sent as a PDF or a Word file.");

  if (source === "vault") {
    if (!VAULT_ID.test(id)) return fail(400, "A document is required.");
    const file = await streamVaultFile(id, { kinds: ["resume", "cover-letter"] });
    if (!file.ok) return refuse(file.status, file.code, file.message);
    const ext = file.fileName.split(".").pop()?.toLowerCase() ?? "";
    return fileResponse(file.bytes, file.fileName, file.mimeType, { format: ext });
  }

  // The library lives in the AI service, which this route calls directly rather
  // than through /api/ai — so the proxy's deletion lock is repeated here.
  if (session?.user?.deletionDueAt) return fail(423, "Your account is scheduled for deletion. Cancel the deletion to use it again.");
  if (!OBJECT_ID.test(id)) return fail(400, "A document is required.");

  const wanted = format as DocumentFormat;
  return answer(source === "built" ? await builtResumeFile(userId, id, wanted) : await letterFile(userId, id, wanted));
}
