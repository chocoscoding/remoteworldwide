// The resume file itself, for the browser extension — the original route.
//
// The work now lives in `app/lib/extension/vault-file.ts` (why the site reads
// the store for the extension, the 4MB ceiling), shared with
// `app/api/extension/document/route.ts`, which also sends cover letters and
// built resumes. This stays, unchanged in what it answers, until every
// extension in the wild calls the new route (plan step Web 2d deletes it).
//
// Its refusals keep their old envelope — `data: null`, no `code` — because the
// extensions that call it read `message` and nothing else.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fileResponse, streamVaultFile } from "@/app/lib/extension/vault-file";

/** The site's envelope, so the extension's client can read `message` and show it. */
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

  const file = await streamVaultFile(documentId, { kinds: ["resume"] });
  if (!file.ok) return fail(file.status, file.message);
  return fileResponse(file.bytes, file.fileName, file.mimeType);
}
