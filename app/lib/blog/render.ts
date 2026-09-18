import sanitizeHtml from "sanitize-html";
import { normalizeEditorHtml } from "./editorHtml";

export const MARKERS = {
  cta: "[[cta]]",
  leadMagnet: "[[magnet]]",
} as const;

export type MarkerKind = keyof typeof MARKERS;

export function markerFor(kind: MarkerKind, ref?: string): string {
  const word = kind === "cta" ? "cta" : "magnet";
  return ref ? `[[${word}:${ref}]]` : `[[${word}]]`;
}

const MARKER_WORDS = "cta|magnet|lead-magnet|leadmagnet";
const MARKER_RE = new RegExp(
  String.raw`<p(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*(?:<(?:strong|em|u|span|b|i)(?:\s[^>]*)?>)*\s*\[\[\s*(${MARKER_WORDS})\s*(?::\s*([a-z0-9][a-z0-9-]*))?\s*\]\]\s*(?:<\/(?:strong|em|u|span|b|i)>)*(?:\s|&nbsp;|<br\s*\/?>)*<\/p>`,
  "gi",
);
const HAS_MARKER_RE: Record<MarkerKind, RegExp> = {
  cta: /\[\[\s*cta(?:\s*:[^\]]*)?\s*\]\]/i,
  leadMagnet: /\[\[\s*(?:magnet|lead-magnet|leadmagnet)(?:\s*:[^\]]*)?\s*\]\]/i,
};
// Only a marker alone in its own <p> becomes a segment; anything else is left
// over text, so placement must be judged by the same pattern that splits.
const PLACED_MARKER_RE = new RegExp(MARKER_RE.source, "i");
const STRAY_MARKER_RE = new RegExp(String.raw`\[\[\s*(?:${MARKER_WORDS})\s*(?::\s*[a-z0-9][a-z0-9-]*)?\s*\]\]`, "gi");

// A blank line in the editor: <p></p> from Quill 2, <p><br></p> in older posts, or an
// empty heading. Each becomes one uniform blank paragraph (one line tall on the page).
const BLANK_BLOCK_RE = new RegExp(String.raw`<(p|h[1-6])(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*/?>)*</\1>`, "gi");
const BLANK_LINE = "<p><br /></p>";
const EDGE_BLANKS_RE = /^(?:\s*<p><br \/><\/p>)+\s*|\s*(?:<p><br \/><\/p>\s*)+$/g;

// Justify is left out on purpose: posts render left-aligned, like the editor now shows.
const ALLOWED_QL_CLASS = /^ql-(align-(center|right)|indent-[1-8]|syntax|video)$/;
const VIDEO_HOSTS = /^https:\/\/(www\.)?(youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/;

// Off-site links open in a new tab and pass no ranking.
function externalLinkAttribs(href: string): Record<string, string> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const external = /^https?:\/\//i.test(href) && !(site && href.startsWith(site));
  return external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {};
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr",
    "strong", "b", "em", "i", "u", "s", "sub", "sup", "code",
    "blockquote", "pre", "ul", "ol", "li", "a", "img", "iframe",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height", "loading", "decoding"],
    iframe: ["src", "allowfullscreen", "frameborder", "class", "loading"],
    li: ["class", "data-list"],
    "*": ["class"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  allowedSchemesByTag: { img: ["https"], iframe: ["https"] },
  allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
  allowedStyles: {},
  allowedClasses: { "*": [ALLOWED_QL_CLASS] },
  transformTags: {
    h1: "h2",
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, ...externalLinkAttribs(attribs.href ?? "") } }),
    iframe: (tagName, attribs) => (VIDEO_HOSTS.test(attribs.src ?? "") ? { tagName, attribs: { ...attribs, loading: "lazy" } } : { tagName, attribs: {} }),
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy", decoding: "async" } }),
  },
  exclusiveFilter: (frame) => (frame.tag === "iframe" || frame.tag === "img") && !frame.attribs.src,
};

const QUOTE_LINE_RE = /<blockquote(?:\s[^>]*)?>([\s\S]*?)<\/blockquote>/gi;
const QUOTE_RUN_RE = /<blockquote(?:\s[^>]*)?>[\s\S]*?<\/blockquote>(?:\s*<blockquote(?:\s[^>]*)?>[\s\S]*?<\/blockquote>)*/gi;
const SOURCE_DASH_RE = /^((?:<[^>]+>)*)\s*(?:—|–|--?)\s*/;
// "Jane Doe[https://…]": the address goes straight into an href, so only http(s) or site
// paths, with no spaces, quotes or brackets.
const SOURCE_LINK_RE = /^(.*?\S)\s*\[\s*((?:https?:\/\/|\/(?!\/))[^\s"'<>[\]]*)\s*\]$/i;

// A source line's name, linked when the writer put an address in brackets after it.
function sourceHtml(line: string): string {
  const name = line.replace(SOURCE_DASH_RE, "$1");
  const m = SOURCE_LINK_RE.exec(stripTags(name));
  if (!m) return name;
  const attrs = Object.entries({ href: m[2], ...externalLinkAttribs(m[2]) }).map(([k, v]) => `${k}="${v}"`);
  return `<a ${attrs.join(" ")}>${m[1]}</a>`;
}

// Quill saves each line of a quote as its own <blockquote>. Join a run into one quote with a
// <p> per line; a last line starting with a dash ("— Jane Doe") becomes its source line.
function joinQuotes(html: string): string {
  return html.replace(QUOTE_RUN_RE, (run) => {
    const lines = Array.from(run.matchAll(QUOTE_LINE_RE), (m) => m[1].trim()).filter((l) => stripTags(l) !== "" || /<img\s/i.test(l));
    if (lines.length === 0) return "";
    const last = lines[lines.length - 1];
    const hasSource = lines.length > 1 && SOURCE_DASH_RE.test(last);
    const body = (hasSource ? lines.slice(0, -1) : lines).map((l) => `<p>${l}</p>`).join("");
    const source = hasSource ? `<p class="quote-source">${sourceHtml(last)}</p>` : "";
    return `<blockquote>${body}${source}</blockquote>`;
  });
}

export function sanitizePostHtml(html: string): string {
  return joinQuotes(
    normalizeEditorHtml(sanitizeHtml(html, SANITIZE_OPTIONS))
      .replace(BLANK_BLOCK_RE, BLANK_LINE)
      // Quill wraps an indented list in a bare <li> (<ul><li><ul>…); tag it so it draws no bullet.
      // An empty item with a sub-list saves identically, so it is hidden (and uncounted) too.
      .replace(/<li>(?=<(?:ul|ol)>)/g, '<li class="list-wrap">'),
  );
}

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 64) || "section"
  );
}

export function addHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const seen = new Map<string, number>();
  const out = html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (whole, lvl: string, attrs: string | undefined, inner: string) => {
    const raw = inner.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!raw) return whole;
    // Slug from the escaped text so existing #anchors keep working; the TOC shows it decoded.
    const text = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const base = slugifyHeading(raw);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const id = n === 1 ? base : `${base}-${n}`;
    toc.push({ id, text, level: Number(lvl) as 2 | 3 });
    return `<h${lvl} id="${id}"${attrs ?? ""}>${inner}</h${lvl}>`;
  });
  return { html: out, toc };
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function wordCount(html: string): number {
  const text = stripTags(html);
  return text ? text.split(" ").length : 0;
}

export function readingMinutes(html: string): number {
  return Math.max(1, Math.round(wordCount(html) / 220));
}

export type PostSegment =
  | { type: "html"; html: string }
  | { type: "marker"; kind: MarkerKind; /** Specific CTA key / magnet slug, when the writer named one. */ ref?: string };

export function splitAtMarkers(html: string): PostSegment[] {
  const segments: PostSegment[] = [];
  let last = 0;
  for (const m of html.matchAll(MARKER_RE)) {
    const before = html.slice(last, m.index);
    if (before.trim()) segments.push({ type: "html", html: before });
    const kind: MarkerKind = m[1].toLowerCase() === "cta" ? "cta" : "leadMagnet";
    segments.push(m[2] ? { type: "marker", kind, ref: m[2].toLowerCase() } : { type: "marker", kind });
    last = (m.index ?? 0) + m[0].length;
  }
  const tail = html.slice(last);
  if (tail.trim()) segments.push({ type: "html", html: tail });
  return segments;
}

export function autoPlaceMarker(html: string, kind: MarkerKind, ratio: number, minParagraphs = 4): string {
  if (HAS_MARKER_RE[kind].test(html)) return html;
  const closes: number[] = [];
  for (const m of html.matchAll(/<\/p>/gi)) closes.push((m.index ?? 0) + m[0].length);
  if (closes.length < minParagraphs) return html;
  const at = closes[Math.min(closes.length - 1, Math.max(1, Math.round(closes.length * ratio) - 1))];
  return `${html.slice(0, at)}<p>${MARKERS[kind]}</p>${html.slice(at)}`;
}

export function hasMarker(html: string, kind: MarkerKind): boolean {
  return HAS_MARKER_RE[kind].test(html);
}

export function hasPlacedMarker(html: string): boolean {
  return PLACED_MARKER_RE.test(html);
}

export interface RenderedPost {
  segments: PostSegment[];
  toc: TocEntry[];
  readingMinutes: number;
  words: number;
  excerpt: string;
  /** "as-written": the writer's blank lines are the only gaps, as in the editor. "auto": a post with no blank lines, spaced for them. */
  spacing: "as-written" | "auto";
}

export interface RenderOptions {
  offers?: string[];
}

// Where the post's content starts and ends, ignoring blank lines at either edge.
function contentBounds(html: string): [number, number] {
  const start = html.length - html.replace(/^(?:\s*<p><br \/><\/p>)*\s*/, "").length;
  const end = html.replace(/(?:\s*<p><br \/><\/p>)*\s*$/, "").length;
  return [start, end];
}

// Positions of the section headings an offer may sit before: h2s (h3s when no h2
// qualifies) with content above them, so an offer never opens the article.
function sectionStarts(html: string): number[] {
  const [start] = contentBounds(html);
  for (const level of [2, 3]) {
    const starts = [...html.matchAll(new RegExp(`<h${level}[\\s>]`, "gi"))].map((m) => m.index ?? 0).filter((i) => i > start);
    if (starts.length > 0) return starts;
  }
  return [];
}

// For posts without headings: ends of text paragraphs with more content after them,
// preferring those followed by a blank line (a visible break, not mid-passage).
function paragraphBreaks(html: string, count: number): number[] {
  const [, contentEnd] = contentBounds(html);
  const breaks: number[] = [];
  const ends: number[] = [];
  for (const m of html.matchAll(/<\/p>/gi)) {
    const end = (m.index ?? 0) + m[0].length;
    if (end >= contentEnd || html.startsWith(BLANK_LINE, end - BLANK_LINE.length)) continue;
    ends.push(end);
    if (html.startsWith(BLANK_LINE, end)) breaks.push(end);
  }
  return breaks.length >= count ? breaks : ends;
}

// `count` of the positions, spread evenly; unique and in order whenever count <= positions.length.
const spread = (positions: number[], count: number) => Array.from({ length: count }, (_, i) => positions[Math.floor((positions.length * (i + 1)) / (count + 1))]);

export function placeOffers(html: string, markers: string[]): string {
  if (markers.length === 0) return html;
  if (hasPlacedMarker(html)) return html;
  const wrap = (m: string) => `<p>${m}</p>`;
  const starts = sectionStarts(html);
  const pool = starts.length > 0 ? starts : paragraphBreaks(html, markers.length);
  const placed = Math.min(markers.length, pool.length);
  const at = spread(pool, placed);
  // Offers beyond the available slots go at the end, after the last section.
  let out = html + markers.slice(placed).map(wrap).join("");
  for (let i = placed - 1; i >= 0; i -= 1) out = `${out.slice(0, at[i])}${wrap(markers[i])}${out.slice(at[i])}`;
  return out;
}

export function renderPost(rawHtml: string, opts: RenderOptions = {}): RenderedPost {
  let html = sanitizePostHtml(rawHtml);
  html = placeOffers(html, opts.offers ?? []);
  const withIds = addHeadingIds(html);
  const words = wordCount(withIds.html);
  // Blank lines at a segment's edges would double the gap a card or the article edge already
  // gives; trim them (after stray markers go, which can leave a blank line behind).
  const segments = splitAtMarkers(withIds.html).flatMap((s): PostSegment[] => {
    if (s.type !== "html") return [s];
    const body = s.html.replace(STRAY_MARKER_RE, "").replace(BLANK_BLOCK_RE, BLANK_LINE).replace(EDGE_BLANKS_RE, "");
    return body.trim() ? [{ ...s, html: body }] : [];
  });
  return {
    segments,
    toc: withIds.toc,
    readingMinutes: Math.max(1, Math.round(words / 220)),
    words,
    excerpt: stripTags(withIds.html).slice(0, 200),
    spacing: segments.some((s) => s.type === "html" && s.html.includes(BLANK_LINE)) ? "as-written" : "auto",
  };
}
