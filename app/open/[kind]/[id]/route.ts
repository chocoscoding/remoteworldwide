// One address per document, for links from outside the dashboard — the
// extension's View / Edit / Download links, above all.
//
//   GET /open/{resume|letter|file}/{id}?to={edit|view|pdf|docx|copy}
//
//   resume  edit (default) -> /dashboard/resume?doc=<id>
//           view           -> the PDF, inline in the tab (the editor when PDFs are off)
//           pdf | docx     -> the file, as a download
//   letter  edit (default) -> /dashboard/cover?letter=<id>
//           view | pdf | docx as for a resume
//   file    view (default) -> the vault's signed link for the original file
//           copy | edit    -> /dashboard/resume?from=<id> ("Edit a copy")
//           pdf | docx     -> the original file, as a download
//
// Signed out, every one of them goes to the login page with `next` set back to
// this exact address (`loginWithNext`, the pattern `/go/[key]` uses), so the
// link still works after signing in. An unknown kind is a 404 before that; a
// malformed id is one after it.
//
// The id is the only thing the link names; whose document it is comes from the
// session, and the backend and the AI service each answer 404 for anyone
// else's. Responses are private, uncached and send no Referer (set here and,
// because next.config.mjs's site-wide headers would otherwise win, there too).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { backend } from "@/app/lib/backend";
import { fileResponse, streamVaultFile } from "@/app/lib/extension/vault-file";
import { loginWithNext } from "@/app/lib/next-url";
import { builtResumeFile, letterFile, type DocumentFileResult, type DocumentFormat } from "@/app/lib/print/documents";

export const runtime = "nodejs";
// `view`/`pdf` wait on the PDF renderer, like /api/extension/document.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Kind = "resume" | "letter" | "file";
type To = "edit" | "view" | "pdf" | "docx" | "copy";

const KINDS: ReadonlySet<string> = new Set<Kind>(["resume", "letter", "file"]);
const TOS: ReadonlySet<string> = new Set<To>(["edit", "view", "pdf", "docx", "copy"]);
const OBJECT_ID = /^[a-f\d]{24}$/i;
const VAULT_ID = /^[A-Za-z0-9_-]{1,64}$/;

const PRIVATE_HEADERS: Record<string, string> = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
};

const withPrivateHeaders = (response: Response): Response => {
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(name, value);
  return response;
};

const redirect = (to: string, origin: string): Response => withPrivateHeaders(NextResponse.redirect(new URL(to, origin), 302));

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A browser tab asked for a file it cannot have: one sentence and the ways on,
 * rather than a JSON envelope nobody reads. Every href is a same-origin path
 * built from the validated kind and id.
 */
function messagePage(status: number, message: string, links: { href: string; label: string }[]): Response {
  const actions = links.map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join(" · ");
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Remote Worldwide</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#222325;background:#f6f6f6;margin:0;display:grid;place-items:center;min-height:100vh}` +
    `main{max-width:440px;margin:24px;padding:24px;background:#fff;border:1.5px solid #222325;border-radius:12px}a{color:#222325;font-weight:700}</style></head>` +
    `<body><main><p>${escapeHtml(message)}</p>${actions ? `<p>${actions}</p>` : ""}</main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", ...PRIVATE_HEADERS } });
}

const notFound = (): Response =>
  new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", ...PRIVATE_HEADERS } });

export async function GET(request: Request, props: { params: Promise<{ kind: string; id: string }> }): Promise<Response> {
  const { kind, id } = await props.params;
  const url = new URL(request.url);
  if (!KINDS.has(kind)) return notFound();

  // Before the id is looked at: a signed-out click on any document link lands on
  // the login page and comes straight back here, whatever it names.
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return redirect(loginWithNext(url.pathname + url.search), url.origin);

  if (kind === "file" ? !VAULT_ID.test(id) : !OBJECT_ID.test(id)) return notFound();
  const asked = url.searchParams.get("to") ?? "";
  const to: To = TOS.has(asked) ? (asked as To) : kind === "file" ? "view" : "edit";

  const self = (next: To) => `/open/${kind}/${encodeURIComponent(id)}?to=${next}`;

  // ---- Uploaded files -------------------------------------------------------
  if (kind === "file") {
    if (to === "copy" || to === "edit") return redirect(`/dashboard/resume?from=${encodeURIComponent(id)}`, url.origin);
    if (to === "pdf" || to === "docx") {
      const file = await streamVaultFile(id, { kinds: ["resume", "cover-letter"] });
      if (!file.ok) return messagePage(file.status, file.message, [{ href: "/dashboard/vault", label: "Open My documents" }]);
      return withPrivateHeaders(fileResponse(file.bytes, file.fileName, file.mimeType));
    }
    // view: the store's own signed link, minted for this request. The backend
    // checks ownership and answers 404 for anyone else's file.
    try {
      const link = await backend<{ url: string; expiresAt: number }>(`/documents/${encodeURIComponent(id)}/link`, { session: true });
      const target = new URL(link.url);
      if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("Not a web link");
      return withPrivateHeaders(NextResponse.redirect(target, 302));
    } catch {
      return messagePage(404, "That document could not be opened. It may have been deleted.", [{ href: "/dashboard/vault", label: "Open My documents" }]);
    }
  }

  // ---- Built resumes and letters ------------------------------------------
  const editor = kind === "resume" ? `/dashboard/resume?doc=${encodeURIComponent(id)}` : `/dashboard/cover?letter=${encodeURIComponent(id)}`;
  // The editors show the account-locked state themselves; nothing is rendered for a locked account here.
  if (to === "edit" || to === "copy" || session?.user?.deletionDueAt) return redirect(editor, url.origin);

  const format: DocumentFormat = to === "docx" ? "docx" : "pdf";
  const result: DocumentFileResult = kind === "resume" ? await builtResumeFile(userId, id, format) : await letterFile(userId, id, format);

  if (result.ok) {
    const disposition = to === "view" ? "inline" : "attachment";
    return withPrivateHeaders(fileResponse(result.bytes, result.fileName, result.mimeType, { disposition, format: result.format }));
  }
  // Viewing falls back to the editor, which shows the same document; a
  // download says why it could not be had, and offers the Word file when it
  // was the PDF that failed.
  if (to === "view") return redirect(editor, url.origin);
  const links = [{ href: editor, label: "Open it in the editor" }];
  if (format === "pdf" && result.code !== "not_found") links.unshift({ href: self("docx"), label: "Download the Word file" });
  return messagePage(result.status, result.message, links);
}
