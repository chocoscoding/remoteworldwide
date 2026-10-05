// How a post's byline joins its authors' names: "Ada", "Ada & Grace", "Ada, Grace & Linus".
// One string; the caller truncates with CSS. Pure and import-free, so tests/author-names.test.mjs
// loads it under Node's type stripping.

export function formatAuthorNames(names: readonly string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`;
}
