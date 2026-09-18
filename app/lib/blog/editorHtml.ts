// Quill 2's getSemanticHTML() saves every space as &nbsp; (and sanitize-html
// decodes those to U+00A0), which stops text wrapping anywhere but hyphens. A lone
// one becomes a normal space; runs stay non-breaking so double spaces (e.g. in
// inline code) still show and survive Quill collapsing plain-space runs on reload.
// No imports, so client components can use it without pulling in the sanitizer.
export function normalizeEditorHtml(html: string): string {
  return html.replace(/(?:&nbsp;|\u00a0)+/g, (run) => {
    const n = (run.match(/&nbsp;|\u00a0/g) ?? []).length;
    return n === 1 ? " " : "\u00a0".repeat(n);
  });
}
