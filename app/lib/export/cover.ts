// Cover letter -> DOCX, Markdown and printable markup.
//
// The letter is whatever is in the editor now — the user's own edits
// included — so it is read from there: plain text for Word and Markdown, the
// editor's HTML (sanitised) for print, which keeps bold, italics and lists.

import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";

export interface Letterhead {
  name: string;
  /** Email, portfolio, location… already chosen by the letterhead setting. */
  contact: string[];
}

export type LetterFont = "sans" | "serif" | "mono";

const WORD_FONT: Record<LetterFont, string> = { sans: "Calibri", serif: "Georgia", mono: "Consolas" };

/** Editor text -> paragraphs: one per line, blank lines dropped (spacing does their job). */
const paragraphsOf = (text: string): string[] =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export async function coverToDocx(body: string, letterhead: Letterhead | null, font: LetterFont): Promise<Blob> {
  const children: Paragraph[] = [];
  if (letterhead && letterhead.name.trim()) {
    children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: letterhead.name.trim(), bold: true, size: 32 })] }));
    const contact = letterhead.contact.filter((c) => c.trim());
    if (contact.length > 0) children.push(new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: contact.join("  ·  "), color: "5A5A5A" })] }));
  }
  for (const line of paragraphsOf(body)) children.push(new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.LEFT, children: [new TextRun(line)] }));

  const doc = new Document({
    creator: letterhead?.name.trim() || "Remote Worldwide",
    title: "Cover letter",
    styles: { default: { document: { run: { font: WORD_FONT[font], size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1_440, bottom: 1_440, left: 1_440, right: 1_440 } } }, children }],
  });
  return Packer.toBlob(doc);
}

export function coverToMarkdown(body: string, letterhead: Letterhead | null): string {
  const lines: string[] = [];
  if (letterhead && letterhead.name.trim()) {
    lines.push(`**${letterhead.name.trim()}**`);
    const contact = letterhead.contact.filter((c) => c.trim());
    if (contact.length > 0) lines.push(contact.join(" · "));
    lines.push("");
  }
  lines.push(paragraphsOf(body).join("\n\n"));
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------

const ALLOWED = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "H1", "H2", "H3", "BLOCKQUOTE", "A"]);
/** Block wrappers the editor or a paste may produce: kept as paragraphs, not dropped with their text. */
const AS_PARAGRAPH = new Set(["DIV", "SECTION", "ARTICLE"]);

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The editor's HTML, reduced to an allowlist of text formatting with every
 * attribute dropped (bar a link's http/https/mailto `href`). Anything pasted
 * into the letter — styles, scripts, handlers, images — is text or nothing by
 * the time it reaches the print frame.
 */
export function sanitizeLetterHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const inner = Array.from(el.childNodes).map(walk).join("");
    const tag = el.tagName;
    if (tag === "A") {
      const href = el.getAttribute("href") ?? "";
      return /^(https?:|mailto:)/i.test(href) ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
    }
    if (tag === "BR") return "<br>";
    if (ALLOWED.has(tag)) return `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
    if (AS_PARAGRAPH.has(tag)) return `<p>${inner}</p>`;
    // SCRIPT, STYLE and the like carry no letter text worth keeping.
    if (["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "IFRAME", "OBJECT"].includes(tag)) return "";
    return inner;
  };
  return Array.from(doc.body.childNodes).map(walk).join("");
}

/** Plain text as paragraphs, for a letter the editor has not reported HTML for yet. */
export const textToLetterHtml = (text: string): string => paragraphsOf(text).map((line) => `<p>${escapeHtml(line)}</p>`).join("");

export function letterheadHtml(letterhead: Letterhead | null): string {
  if (!letterhead || !letterhead.name.trim()) return "";
  const contact = letterhead.contact.filter((c) => c.trim());
  return (
    `<div style="margin-bottom:28px"><div style="font-size:20px;font-weight:700">${escapeHtml(letterhead.name.trim())}</div>` +
    (contact.length ? `<div style="font-size:12px;color:#5a5a5a;margin-top:4px">${contact.map(escapeHtml).join(" · ")}</div>` : "") +
    `</div>`
  );
}
