const MAX_LENGTH = 72;

const LEADING_STOPWORDS = new Set(["a", "an", "the", "your", "my", "our", "how", "to", "of", "for", "and", "or", "in", "on", "is", "are", "you"]);

export function slugifyTitle(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return "post";

  const words = base.split("-");
  let start = 0;
  while (start < words.length - 3 && LEADING_STOPWORDS.has(words[start])) start += 1;
  const kept: string[] = [];
  for (const word of words.slice(start)) {
    const next = kept.length === 0 ? word : `${kept.join("-")}-${word}`;
    if (next.length > MAX_LENGTH) break;
    kept.push(word);
  }
  return (kept.length ? kept.join("-") : words.slice(start).join("-").slice(0, MAX_LENGTH)).replace(/^-+|-+$/g, "") || "post";
}
