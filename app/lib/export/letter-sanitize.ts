// The server's copy of `sanitizeLetterHtml` (./cover.ts), for the print page.
//
// A saved letter's `html` is whatever the editor sent — the AI service stores it
// as given and leaves sanitising to whoever renders it. `/print/letter/[id]`
// renders it into a page Chromium prints, with no DOMParser to walk, so this is
// the same allowlist (./letter-allowlist.ts) run through sanitize-html:
//
//   - the listed formatting tags survive with every attribute dropped, bar a
//     link's `href`, and only an http/https/mailto one — any other `<a>` is
//     unwrapped to its text, as the browser's walker does;
//   - div/section/article become paragraphs rather than taking their text away;
//   - script, style and the rest of LETTER_DROPPED_WITH_CONTENT go with their
//     contents; any other tag is unwrapped to its (escaped) text.
//
// The one difference in output is cosmetic: sanitize-html writes `<br />`.
//
// Why a failed link is unwrapped with `exclusiveFilter: "excludeTag"` and not
// by renaming it to a disallowed tag in `transformTags`: sanitize-html 2.17
// leaves a renamed-then-discarded tag's name behind in its depth map, and the
// next void element at that depth (a `<br>`) closes it — a stray `</x>` in the
// output. Keeping the name `a` and dropping only the tag avoids that path.

import sanitizeHtml from "sanitize-html";
import { LETTER_BLOCKS_AS_PARAGRAPH, LETTER_DROPPED_WITH_CONTENT, LETTER_HREF, LETTER_TAGS } from "./letter-allowlist";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...LETTER_TAGS],
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  nonTextTags: [...LETTER_DROPPED_WITH_CONTENT],
  transformTags: {
    ...Object.fromEntries(LETTER_BLOCKS_AS_PARAGRAPH.map((tag) => [tag, () => ({ tagName: "p", attribs: {} })])),
    // Tested as written, untrimmed — the browser walker does the same, so " https://…" is unwrapped by both.
    a: (_tagName, attribs) => {
      const href = attribs.href ?? "";
      const kept: sanitizeHtml.Attributes = {};
      if (LETTER_HREF.test(href)) kept.href = href;
      return { tagName: "a", attribs: kept };
    },
  },
  exclusiveFilter: (frame) => (frame.tag === "a" && !frame.attribs.href ? "excludeTag" : false),
};

export function sanitizeLetterHtmlServer(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
