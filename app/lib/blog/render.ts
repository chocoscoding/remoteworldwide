import sanitizeHtml from "sanitize-html";

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

const EMPTY_BLOCK_RE = new RegExp(String.raw`<(p|h[1-6])(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*/?>)*</\1>\s*`, "gi");

const ALLOWED_QL_CLASS = /^ql-(align-(center|right|justify)|indent-[1-8]|syntax|video)$/;
const VIDEO_HOSTS = /^https:\/\/(www\.)?(youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/;

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
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const site = process.env.NEXT_PUBLIC_SITE_URL;
      const external = /^https?:\/\//i.test(href) && !(site && href.startsWith(site));
      return {
        tagName,
        attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } : attribs,
      };
    },
    iframe: (tagName, attribs) => (VIDEO_HOSTS.test(attribs.src ?? "") ? { tagName, attribs: { ...attribs, loading: "lazy" } } : { tagName, attribs: {} }),
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy", decoding: "async" } }),
  },
  exclusiveFilter: (frame) => (frame.tag === "iframe" || frame.tag === "img") && !frame.attribs.src,
};

export function sanitizePostHtml(html: string): string {
  return (
    sanitizeHtml(html, SANITIZE_OPTIONS)
      .replace(/&nbsp;(?=\S)/g, " ")
      .replace(/(\S)&nbsp;/g, "$1 ")
      .replace(EMPTY_BLOCK_RE, "")
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
    const text = inner.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!text) return whole;
    const base = slugifyHeading(text);
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
}

export interface RenderOptions {
  offers?: string[];
}

export function placeOffers(html: string, markers: string[]): string {
  if (markers.length === 0) return html;
  if (hasPlacedMarker(html)) return html;
  const closes: number[] = [];
  for (const m of html.matchAll(/<\/p>/gi)) closes.push((m.index ?? 0) + m[0].length);
  if (closes.length < markers.length + 2) return html + markers.map((m) => `<p>${m}</p>`).join("");
  const slots = markers.map((_, i) => {
    const raw = Math.round((closes.length * (i + 1)) / (markers.length + 1)) - 1;
    return Math.min(closes.length - 2, Math.max(1, raw));
  });
  let out = html;
  for (let i = markers.length - 1; i >= 0; i -= 1) {
    const at = closes[slots[i]];
    out = `${out.slice(0, at)}<p>${markers[i]}</p>${out.slice(at)}`;
  }
  return out;
}

export function renderPost(rawHtml: string, opts: RenderOptions = {}): RenderedPost {
  let html = sanitizePostHtml(rawHtml);
  html = placeOffers(html, opts.offers ?? []);
  const withIds = addHeadingIds(html);
  const words = wordCount(withIds.html);
  return {
    segments: splitAtMarkers(withIds.html).map((s) => (s.type === "html" ? { ...s, html: s.html.replace(STRAY_MARKER_RE, "") } : s)),
    toc: withIds.toc,
    readingMinutes: Math.max(1, Math.round(words / 220)),
    words,
    excerpt: stripTags(withIds.html).slice(0, 200),
  };
}
