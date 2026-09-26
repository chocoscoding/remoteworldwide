// What a cover letter's HTML may keep, in one place for its two sanitisers.
//
// The browser's (`sanitizeLetterHtml` in ./cover.ts) walks a DOMParser tree for
// the print frame and the autosave; the server's (`sanitizeLetterHtmlServer` in
// ./letter-sanitize.ts) runs sanitize-html for `/print/letter/[id]`, where there
// is no DOM. Two lists would be two definitions of "safe" that drift apart, and
// the server one is what a PDF is rendered from, so both read these.
//
// Pure data, no imports: the server half and `node --test` load it directly.

/** Text formatting the editor produces or a paste may bring. Every attribute is dropped, bar a link's `href`. */
export const LETTER_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "a"] as const;

/** Block wrappers the editor or a paste may produce: kept as paragraphs, not dropped with their text. */
export const LETTER_BLOCKS_AS_PARAGRAPH = ["div", "section", "article"] as const;

/** Removed WITH their contents — they carry no letter text worth keeping. Anything else unlisted is unwrapped to its text. */
export const LETTER_DROPPED_WITH_CONTENT = ["script", "style", "template", "noscript", "iframe", "object"] as const;

/** The only links a letter keeps; any other `<a>` is unwrapped to its text. */
export const LETTER_HREF = /^(https?:|mailto:)/i;
