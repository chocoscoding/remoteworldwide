// The apply wizard's score card, as pure functions (owner, 2026-10-03): the
// donut's colour, the counts in a scoring note set apart, text with its em
// dashes taken out, and the quantities in a line picked out. Pure, for
// tests/apply.test.mjs.

/**
 * A score's colour on one continuous scale: red at 0, yellow at 50, a vivid
 * green at 100. Hue does the walking (0 → 60 → 120); the green end is a touch
 * darker so it stays vivid rather than washing out on white.
 */
export function scoreColor(score: number): string {
  const value = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const hue = Math.round(value * 1.2);
  const lightness = hue <= 60 ? 50 : Math.round(50 - ((hue - 60) / 60) * 10);
  return `hsl(${hue} 85% ${lightness}%)`;
}

export type NotePart = { text: string; kind: "plain" | "count" | "total" };

/**
 * A scoring note with its first "N of M" set apart, so the screen can weight the two numbers
 * ("9 of 14 requirements were scored…"). A note without one is a single plain part.
 */
export function noteParts(text: string): NotePart[] {
  const match = /(\d+)(\s+of\s+)(\d+)/.exec(text);
  if (!match) return [{ text, kind: "plain" }];
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  return [
    ...(before ? [{ text: before, kind: "plain" as const }] : []),
    { text: match[1], kind: "count" },
    { text: match[2], kind: "plain" },
    { text: match[3], kind: "total" },
    ...(after ? [{ text: after, kind: "plain" as const }] : []),
  ];
}

/**
 * Text with no em dashes (owner: "no em dashes at all"). A dash used as a pause becomes a comma;
 * one at either end goes. En dashes in date ranges are left alone: they aren't em dashes.
 */
export const withoutEmDashes = (text: string): string =>
  text
    .replace(/^\s*—\s*|\s*—\s*$/g, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/,\s*([,.;:!?])/g, "$1");

export type TextPart = { text: string; quantity: boolean };

/**
 * A number that carries a claim, with its unit: "5+ years", "40%", "2M", "3 weeks". Not one glued
 * to a word or a sign ("IC3", "UTC-8"), so a role code or a time zone isn't picked out.
 */
const QUANTITY = /(?<![-+\w.])\d+(?:[.,]\d+)*\+?(?:%|\s?(?:years?|yrs?|months?|weeks?|days?|hours?|percent)\b|[kmbx]\b)?/gi;

/**
 * Text with its quantities set apart, so the screen can put them in pills (owner, 2026-10-03:
 * "highlighting numbers ... quantifying things ... putting in pills"). A bare year is not one.
 */
export function quantityParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(QUANTITY)) {
    const value = match[0];
    const at = match.index ?? 0;
    if (/^(?:19|20)\d{2}$/.test(value)) continue;
    if (at > last) parts.push({ text: text.slice(last, at), quantity: false });
    parts.push({ text: value, quantity: true });
    last = at + value.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), quantity: false });
  return parts.length > 0 ? parts : [{ text, quantity: false }];
}
