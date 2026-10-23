// "Download as PDF" through the server renderer, with the print dialog only as the fallback.
//
// Why (owner, 2026-10-22, PHASE6-OPEN-ITEMS-PLAN.md item I): the browser's print dialog loses the
// text layer when the person picks "Microsoft Print to PDF" (always the case in the Claude desktop
// app), and an ATS cannot read the outlined file that comes out (tess.pdf, refused by the AI's
// extractCore). The renderer on the AI host prints the site's own /print pages with real text, so a
// download asks it first, through `/open/{kind}/{id}?to=pdf`, and only falls back to `printDocument`
// when the renderer is off, busy or failing, or the document on screen is not the one saved.
//
// Pure apart from the `fetch` and `save` it is handed, so tests/pdf-download.test.mjs can drive it.

/** What the server can print: a built resume, a library letter, or an apply-step draft (`ai_resumes`). */
export type ServerPdfKind = "resume" | "letter" | "draft";

export interface ServerPdfSource {
  kind: ServerPdfKind;
  id: string;
  /**
   * A draft's version as the page shows it. The server answers 409 when it holds another, so a
   * download never prints words the person no longer sees; an undo still being saved carries a
   * provisional (negative) version and goes to the dialog.
   */
  version?: number | null;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Past the site route's own 45s wait on the renderer, so its answer (a PDF or a refusal) normally arrives first. */
export const SERVER_PDF_TIMEOUT_MS = 50_000;

/** The `/open` address for a source, or null when it cannot be printed there. */
export function serverPdfPath(source: ServerPdfSource | null | undefined): string | null {
  if (!source || !OBJECT_ID.test(source.id)) return null;
  const base = `/open/${source.kind}/${encodeURIComponent(source.id)}?to=pdf`;
  if (source.kind !== "draft") return base;
  const version = source.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return null;
  return `${base}&v=${version}`;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The PDF at `path`, or null for any answer that is not one (a refusal page, a 409, a network failure, a timeout). */
export async function fetchServerPdf(path: string, fetchImpl: FetchLike = fetch, timeoutMs = SERVER_PDF_TIMEOUT_MS): Promise<Blob | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(path, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!res.ok || type !== "application/pdf") return null;
    const blob = await res.blob();
    // A body that is not a PDF is never saved as one.
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...head) === "%PDF-" ? blob : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface DownloadPdfOptions {
  source: ServerPdfSource | null | undefined;
  /** Without the extension. */
  fileName: string;
  /** The print dialog, for when the server cannot make this PDF. */
  fallback: () => Promise<void> | void;
  save: (blob: Blob, fileName: string) => void;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/** Saves the server's PDF when it can be had; otherwise runs the fallback. Says which happened. */
export async function downloadPdf({ source, fileName, fallback, save, fetchImpl, timeoutMs }: DownloadPdfOptions): Promise<"server" | "dialog"> {
  const path = serverPdfPath(source);
  const blob = path ? await fetchServerPdf(path, fetchImpl, timeoutMs) : null;
  if (blob) {
    save(blob, `${fileName}.pdf`);
    return "server";
  }
  await fallback();
  return "dialog";
}
