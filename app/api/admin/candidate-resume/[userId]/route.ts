// A candidate's master resume for the reviewer, when that master is a resume made here.
//
// An uploaded master has a file in storage, and the backend hands the reviewer a short-lived
// signed link to it (`candidateResumeLink`). A master made here has no file: it is the editor's
// document in the AI service, so it is rendered to a PDF the way the owner's own download is
// (`builtResumeFile`), as that candidate, and streamed straight back. Nothing is stored.
//
// The gate is the same as the signed link's: the admin session here, then the backend's
// isAdmin guard and "Let recruiters find me" check, asked fresh on every open. The document
// id is the one the backend names as their master, never one from the URL, so this can only
// ever open the resume a reviewer is already allowed to read.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/require-admin";
import { BackendError, backendOrNull, idSegment } from "@/app/lib/backend";
import { builtResumeFile } from "@/app/lib/print/documents";
import { fileResponse } from "@/app/lib/extension/vault-file";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type CandidateResume = { name: string; url: string; expiresAt: number } | { name: string; builtId: string };

const text = (status: number, message: string) =>
  new NextResponse(message, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await params;
  if (!/^[a-f\d]{24}$/i.test(userId)) return text(404, "That account was not found.");

  let master: CandidateResume | null;
  try {
    master = await backendOrNull<CandidateResume>(`/recommendations/admin/candidates/${idSegment(userId)}/resume`, { session: true });
  } catch (error) {
    if (error instanceof BackendError && error.status === 409) return text(409, error.message);
    throw error;
  }
  if (!master) return text(404, "They have no master resume yet.");
  // An upload: its own signed link, as the reviewer's button already opens it.
  if ("url" in master) return NextResponse.redirect(master.url, { status: 303 });

  const file = await builtResumeFile(userId, master.builtId, "pdf");
  if (!file.ok) return text(file.status, file.message);
  const response = fileResponse(file.bytes, file.fileName, file.mimeType, { disposition: "inline", format: file.format });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
