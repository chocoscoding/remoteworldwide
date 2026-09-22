// Saving a generated file, and printing a document to PDF.
//
// Both run in the browser, on what the user can see. DOCX and Markdown are
// built here and saved as a real download. PDF goes through the browser's own
// print engine, on purpose: the resume's look — six templates, twelve web
// fonts, CSS variables for every colour — exists only as CSS, and the print
// engine is the one renderer that reproduces it exactly, with real, selectable
// text an ATS can read. The price is that the user picks "Save as PDF" in the
// print dialog rather than getting the file straight away.

/** Characters no filesystem accepts in a name, and the ones that would read as a path. */
export const safeFileName = (name: string): string => name.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "document";

/** Saves a Blob as a download. The object URL is revoked once the click has had time to start the download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export const saveText = (text: string, fileName: string, type = "text/markdown;charset=utf-8"): void =>
  saveBlob(new Blob([text], { type }), fileName);

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface PrintOptions {
  /** The document's title — Chrome and Edge offer it as the PDF's file name. */
  title: string;
  /** Markup to print. Must already be safe: it is written into a same-origin frame. */
  html: string;
  /** CSS `@page` size, e.g. "A4" or "Letter". */
  pageSize: string;
  /** CSS `@page` margin, e.g. "0" or "18mm 0". */
  pageMargin: string;
  /** Classes for `<body>` — the font variables live on an ancestor in the app, so they are carried here. */
  bodyClass?: string;
  /** Extra print-only CSS. */
  css?: string;
}

const waitFor = (target: EventTarget, events: string[], ms: number) =>
  new Promise<void>((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      events.forEach((e) => target.removeEventListener(e, done));
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    events.forEach((e) => target.addEventListener(e, done, { once: true }));
  });

/**
 * Prints `html` on its own — not the dashboard around it — at the page size
 * given, through a hidden frame that carries the app's stylesheets.
 *
 * The frame is sandboxed without `allow-scripts`: whatever the markup holds
 * (a pasted letter, say) can be laid out and printed but never run.
 * `allow-modals` is what lets the print dialog open from inside it.
 */
export async function printDocument({ title, html, pageSize, pageMargin, bodyClass = "", css = "" }: PrintOptions): Promise<void> {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-modals allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(frame);

  try {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) throw new Error("The print frame could not be created");

    // Every stylesheet the page has — Tailwind's output and next/font's
    // @font-face rules among them — so the copy renders as it does on screen.
    const styles = Array.from(document.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join("\n");

    // The app's own <html>/<body> classes come along too: that is where the
    // site font and its CSS variables are attached.
    const htmlClass = document.documentElement.className;
    const pageClass = `${document.body.className} ${bodyClass}`.trim();

    doc.open();
    doc.write(
      `<!doctype html><html class="${escapeHtml(htmlClass)}"><head><meta charset="utf-8"><base href="${escapeHtml(location.origin)}/"><title>${escapeHtml(title)}</title>${styles}` +
        `<style>@page{size:${pageSize};margin:${pageMargin};}html,body{margin:0;padding:0;background:#fff;min-height:0;}` +
        `*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}${css}</style></head>` +
        `<body class="${escapeHtml(pageClass)}">${html}</body></html>`,
    );
    doc.close();

    // Stylesheets first, then the fonts they declare — printing before either
    // lands prints the fallback face, which is the one thing a PDF cannot fix.
    const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    await Promise.all(links.map((link) => (link.sheet ? Promise.resolve() : waitFor(link, ["load", "error"], 4_000))));
    await Promise.race([doc.fonts.ready.then(() => undefined), new Promise((resolve) => window.setTimeout(resolve, 4_000))]);

    win.focus();
    win.print();
  } finally {
    // print() blocks until the dialog closes in Chrome, Edge and Firefox; the
    // delay covers Safari, which returns early and prints from the frame after.
    window.setTimeout(() => frame.remove(), 1_000);
  }
}
