// A built resume or a saved letter as a real PDF — rendered by Chromium on the
// AI host from this site's own print page.
//
// The split (plan D1): only this app has the Tailwind build and the next/font
// faces a resume is drawn with, so the page is rendered HERE, at
// `/print/{kind}/{id}`; and only the AI host can keep a warm headless browser,
// so the printing happens THERE (`POST /internal/render/pdf`, behind the
// service token and outside `/api/ai`, so no browser session reaches it). This
// module is the website's half of that handshake:
//
//   1. mint a print token for this user and document (./token.ts),
//   2. ask the renderer for `{ kind, id, token, cacheKey }` — it builds the URL
//      itself from its own configured origin and sends the token as a header on
//      that one navigation,
//   3. hand back the bytes, or a `RenderError` whose `code` the routes answer
//      with.
//
// Off unless `PDF_RENDERER=ai` AND `PRINT_TOKEN_SECRET` are set — then every
// call throws `RendererUnavailable`, and the callers offer the Word file. So a
// deploy can ship DOCX-only by leaving the flag unset.
//
// The cache key is the renderer's (Redis, 24h): the same user, document, saved
// version, deploy and letterhead is the same PDF. The deploy sha is in it
// because a new build can change the templates or the CSS under an unchanged
// document; the letterhead because it comes from the profile, not the document.

import { createHash } from "node:crypto";
import { aiRaw } from "@/app/lib/ai";
import { mintPrintToken, printTokensConfigured, type PrintKind, type PrintLetterhead } from "./token";

/** The renderer's own ceiling. Anything over it is refused there, and would not fit a Vercel response here. */
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

/**
 * The renderer bounds a render at 20s and a queue wait at 15s; this waits a
 * little past both, and stays inside the 60s the calling routes are given.
 */
const RENDER_TIMEOUT_MS = 45_000;

export type RenderErrorCode = "renderer_unavailable" | "renderer_busy" | "too_large";

export class RenderError extends Error {
  constructor(
    public code: RenderErrorCode,
    public status: number,
    message: string,
    /** Seconds, from the renderer's Retry-After on a busy answer. */
    public retryAfter?: number,
    /** The renderer's own code when it differs from `code` (render_timeout, render_failed), for the log. */
    public reason?: string,
  ) {
    super(message);
    this.name = "RenderError";
  }
}

export const RENDERER_UNAVAILABLE_MESSAGE = "PDFs aren't available right now. Download the Word file instead.";

/** PDFs are off here, or the renderer could not make this one. Either way the Word file is the answer. */
export class RendererUnavailable extends RenderError {
  constructor(reason?: string) {
    super("renderer_unavailable", 503, RENDERER_UNAVAILABLE_MESSAGE, undefined, reason);
    this.name = "RendererUnavailable";
  }
}

/** Whether a PDF could be asked for at all. Cheap: reads env only. */
export const pdfRendererEnabled = (): boolean => process.env.PDF_RENDERER === "ai" && printTokensConfigured();

export interface RenderInput {
  userId: string;
  kind: PrintKind;
  id: string;
  /** The document's saved version — part of the cache key, so an edit is a new PDF. */
  updatedAt: Date | string | number;
  letterhead?: PrintLetterhead | null;
}

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

/** `sha256(uid|kind|id|updatedAtMs|deploySha|letterheadHash)` — 64 hex characters, inside the renderer's `[A-Za-z0-9_-]{16,128}`. */
export function printCacheKey({ userId, kind, id, updatedAt, letterhead }: RenderInput): string {
  const updatedAtMs = new Date(updatedAt).getTime();
  // Unset outside Vercel; "dev" keeps local renders cacheable within one run of the code.
  const deploy = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  const lh = kind === "letter" && letterhead && letterhead.name.trim() ? sha256(JSON.stringify({ n: letterhead.name, c: letterhead.contact })) : "-";
  return sha256([userId, kind, id.toLowerCase(), Number.isFinite(updatedAtMs) ? updatedAtMs : 0, deploy, lh].join("|"));
}

interface RendererRefusal {
  message?: string;
  data?: { code?: string } | null;
}

/** The renderer's JSON refusal -> this app's error. Codes outside the closed set collapse to "unavailable". */
function refusal(status: number, body: RendererRefusal | null, retryAfter: string | null): RenderError {
  const code = body?.data?.code;
  switch (code) {
    case "renderer_busy": {
      const seconds = Number(retryAfter);
      return new RenderError("renderer_busy", 429, "PDFs are busy right now. Try again in a moment.", Number.isFinite(seconds) && seconds > 0 ? seconds : undefined);
    }
    case "not_found":
      // The print page answered 404. Every caller has just read the document as
      // this user, so it exists: the page refused the token — a
      // PRINT_TOKEN_SECRET that differs between this deploy and the one at
      // PDF_RENDER_ORIGIN, say. That is PDFs being unavailable, not a missing
      // document, and saying "not found" would send the person looking for it.
      return new RendererUnavailable("print_page_404");
    case "too_large":
      return new RenderError("too_large", 413, "That PDF is larger than 4MB, so it can't be sent through here. Download the Word file instead.");
    default:
      // renderer_unavailable, and the two that mean "this render failed" —
      // render_timeout and render_failed — all leave the person the same way
      // forward, the Word file. A 400/401 here is a misconfiguration (a bad
      // token or body): logged by the caller through `reason`, not shown.
      return new RendererUnavailable(code ?? `http_${status}`);
  }
}

/**
 * The PDF for one document, as bytes. Throws `RenderError` (never anything
 * else) so a route can answer every failure with one envelope.
 */
export async function renderPdf(input: RenderInput): Promise<ArrayBuffer> {
  if (!pdfRendererEnabled()) throw new RendererUnavailable("disabled");

  let token: string;
  try {
    token = mintPrintToken({ userId: input.userId, kind: input.kind, id: input.id, letterhead: input.letterhead });
  } catch {
    throw new RendererUnavailable("token");
  }

  let res: Response;
  try {
    res = await aiRaw("/internal/render/pdf", {
      method: "POST",
      body: { kind: input.kind, id: input.id, token, cacheKey: printCacheKey(input) },
      userId: input.userId,
      accept: "application/pdf, application/json",
      timeoutMs: RENDER_TIMEOUT_MS,
    });
  } catch {
    throw new RendererUnavailable("unreachable");
  }

  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!res.ok || type !== "application/pdf") {
    const body = (await res.json().catch(() => null)) as RendererRefusal | null;
    throw refusal(res.status, body, res.headers.get("retry-after"));
  }

  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_PDF_BYTES) throw refusal(413, { data: { code: "too_large" } }, null);

  let bytes: ArrayBuffer;
  try {
    bytes = await res.arrayBuffer();
  } catch {
    throw new RendererUnavailable("read");
  }
  if (bytes.byteLength > MAX_PDF_BYTES) throw refusal(413, { data: { code: "too_large" } }, null);
  // The renderer checks this too; a body that is not a PDF must never be sent on as one.
  const head = new Uint8Array(bytes, 0, Math.min(5, bytes.byteLength));
  if (String.fromCharCode(...head) !== "%PDF-") throw new RendererUnavailable("not_pdf");
  return bytes;
}
