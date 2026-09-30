// A resume built in the editor, saved into My documents as a file — the third
// way through onboarding's resume step (pick one / upload one / this).
//
//   POST { id }   an `ai_documents` resume id (24 hex)
//
// Success: `{ success: true, message, data: VaultDoc }` — the new vault row,
// exactly as an upload answers, so the page treats it like one. The backend
// makes someone's first resume their master, which is what the extension
// attaches by default.
//
// The file is a PDF when the renderer is up (Chromium prints the site's own
// template: it looks like the editor and is real, selectable text) and a Word
// file when it is off or busy — the same `builtResumeFile` the extension's
// `/api/extension/document` and `/open/resume/:id` use, so the three agree.
//
// Server-side end to end, not "download it in the browser and upload it back":
// one request, no bytes through the page, and nothing here depends on a route
// that belongs to the extension. Identity is the session alone — the body
// names a document, never a user; the AI service is asked as
// `session.user.id` and the backend with the caller's own cookie, and nothing
// from this request's headers is forwarded wholesale (`backend()` builds its
// headers field by field).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { BackendError, backend } from "@/app/lib/backend";
import type { VaultDoc } from "@/app/lib/dashboard/types";
import { builtResumeFile } from "@/app/lib/print/documents";

export const runtime = "nodejs";
// A PDF waits on the renderer's queue and one render (bounded at ~45s in
// render.ts); the fallback Word file and the upload are quick after it.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[a-f\d]{24}$/i;

const fail = (status: number, message: string) => NextResponse.json({ success: false, message, data: null }, { status });

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail(401, "Sign in to continue.");
  // The library lives in the AI service, called directly rather than through
  // /api/ai — so the proxy's deletion lock is repeated here, as in
  // /api/extension/document.
  if (session?.user?.deletionDueAt) return fail(423, "Your account is scheduled for deletion. Cancel the deletion to use it again.");

  let id: string;
  try {
    const body = (await req.json()) as { id?: unknown };
    id = typeof body.id === "string" ? body.id.trim() : "";
  } catch {
    return fail(400, "That request wasn't valid JSON.");
  }
  if (!OBJECT_ID.test(id)) return fail(400, "Pick a resume to save.");

  let file = await builtResumeFile(userId, id, "pdf");
  // PDFs off, or the renderer's queue full: the Word file is the same resume,
  // and a document in the vault now beats a better one later.
  if (!file.ok && (file.code === "renderer_unavailable" || file.code === "renderer_busy")) {
    file = await builtResumeFile(userId, id, "docx");
  }
  if (!file.ok) return fail(file.status, file.message);

  const form = new FormData();
  // A Buffer can be a view into a shared pool; copying sends exactly its bytes.
  const bytes = file.bytes instanceof Uint8Array ? new Uint8Array(file.bytes) : file.bytes;
  form.append("file", new Blob([bytes], { type: file.mimeType }), file.fileName);
  form.append("kind", "resume");

  try {
    const doc = await backend<VaultDoc>("/documents", { method: "POST", body: form, session: true });
    return NextResponse.json({ success: true, message: `${doc.name} added to My documents`, data: doc });
  } catch (error) {
    // The backend's own wording (a 415, a 413, a 423) is the one to show.
    if (error instanceof BackendError) return fail(error.status, error.message);
    return fail(502, "That resume couldn't be saved to My documents right now.");
  }
}
