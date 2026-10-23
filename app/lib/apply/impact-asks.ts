// The Impact fix's estimates, asked instead of written (owner, 2026-10-22, fix plan 1e): a number
// nothing on the resume anchors comes back from the AI service marked `estimate` with a question
// ("How many web funnels did you build?"). "Fix them" applies only the rest; each estimate becomes
// an ask row where the person types their own number, or keeps the AI's line as an estimate.
//
// Pure and type-only in its imports, except the AI numbers reader it shares with the editor.

import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { QuantifySuggestion } from "@/app/lib/dashboard/resume/ai-tools";
import { addedFigures } from "@/app/lib/dashboard/resume/ai-figures";

/** One estimate waiting on the person: the proposal as the service sent it, at the stored index. */
export type EstimateAsk = QuantifySuggestion;

/** The proposals "Fix them" applies, and the estimates it asks about instead. */
export const splitEstimates = <T extends Pick<QuantifySuggestion, "estimate" | "question">>(proposals: readonly T[]): { ready: T[]; asks: T[] } => ({
  ready: proposals.filter((proposal) => proposal.estimate !== true),
  asks: proposals.filter((proposal) => proposal.estimate === true),
});

/** The asks whose line still reads as it did: one the person edited or that an undo moved is stale. */
export const openEstimates = <T extends Pick<QuantifySuggestion, "entryIndex" | "bulletIndex" | "before" | "customId">>(
  content: ResumeContent | null,
  asks: readonly T[],
): T[] =>
  content
    ? asks.filter((ask) =>
        ask.customId
          ? (content.customSections ?? []).find((section) => section.id === ask.customId)?.items[ask.bulletIndex] === ask.before
          : content.experience[ask.entryIndex]?.bullets[ask.bulletIndex] === ask.before,
      )
    : [];

const TYPED = /^([$€£₦])?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|bn|b|x|%)?\s*(\+)?$/i;
const FIGURE = /[$€£₦]?\d[\d,.]*(?:%|\+|x|k|K|M|B)?/g;

/**
 * The AI's line with the person's number in place of the AI's: "12" in "Coached 8 leaders" is
 * "Coached 12 leaders". The AI's unit carries over when the person leaves it off ("15" for "20%"
 * is "15%", "3" for "$2M" is "$3M"); a "+" only when they type one, since their number is exact.
 * A from-to takes both ("6 to 2"). Null when what they typed is not a number (or not two, for a
 * from-to), or the line has no AI number to replace.
 */
export const withYourNumber = (before: string, after: string, typed: string): string | null => {
  // A bare number cannot confirm a newly guessed reporting period.
  const period = /\b(?:per|each|a)\s+(?:day|week|month|year)\b/gi;
  if ((after.match(period) ?? []).some(value => !before.toLowerCase().includes(value.toLowerCase()))) return null;
  const added = addedFigures(before, after);
  const range = /^(?:about\s+|approximately\s+|~\s*)?(\d[\d,.]*)(?:\s*[-–]\s*)(\d[\d,.]*)(%|x)?$/i.exec(typed.trim());
  if (range && !isFromTo(before, after) && added.length === 1) {
    const low = yours(added[0], `${range[1]}${range[3] ?? ""}`);
    const high = yours(added[0], `${range[2]}${range[3] ?? ""}`);
    const at = placeOf(after, added[0], 0);
    if (!low || !high || at < 0 || Number(range[1].replace(/,/g, "")) > Number(range[2].replace(/,/g, ""))) return null;
    return `${after.slice(0, at)}${/^about|^approximately|^~/i.test(typed.trim()) ? "approximately " : ""}${low}–${high}${after.slice(at + added[0].length)}`;
  }
  // A from-to estimate guessed two numbers, and the person gives both (owner, 2026-10-22, fix plan
  // 1e: one typed number replaced the "from" and left the AI's "to" in the line, unmarked).
  const typedPair = isFromTo(before, after) ? BOTH.exec(typed.trim().replace(/[.,]$/, "")) : null;
  if (isFromTo(before, after) && !typedPair) return null;
  const answers = typedPair ? [typedPair[1], typedPair[2]] : [typed];
  // Each AI number where it stands, left to right, so the person's first never stands in for the AI's second.
  let line = "";
  let from = 0;
  for (const [index, answer] of answers.entries()) {
    const ai = added[index];
    if (!ai) return null;
    const mine = yours(ai, answer);
    const at = placeOf(after, ai, from);
    if (mine === null || at < 0) return null;
    line += `${after.slice(from, at)}${mine}`;
    from = at + ai.length;
  }
  return line + after.slice(from);
};

/** "from 6 weeks to 2": a from-to the AI wrote, both numbers its own. */
const FROM_TO = /\bfrom\s+\S*\d[^,;]{0,40}?\bto\s+\S*\d/i;
const isFromTo = (before: string, after: string): boolean => FROM_TO.test(after) && !FROM_TO.test(before) && addedFigures(before, after).length === 2;
/** "6 to 2", "6-2", "6, 2", "6 2". */
const BOTH = /^(\S+?)\s*(?:to|-|–|→|,|\s)\s*(\S+)$/i;

/** The input's placeholder: a from-to asks both numbers. */
export const answerPlaceholder = (ask: Pick<EstimateAsk, "before" | "after">): string => (isFromTo(ask.before, ask.after) ? "e.g. 6 to 2" : "e.g. 12");

/** What to say when the answer is not a number the line can take. */
export const answerHint = (ask: Pick<EstimateAsk, "before" | "after">): string => (isFromTo(ask.before, ask.after) ? "Type both numbers, like 6 to 2." : "Include the unit, currency or percentage when needed, or write a complete sentence with the actual outcome and period.");

/** The person's `typed` number written as the AI's `ai` was, or null when it is not a number. */
const yours = (ai: string, typed: string): string | null => {
  const read = TYPED.exec(typed.trim().replace(/[.,]$/, ""));
  if (!read) return null;
  const aiCurrency = /^[$€£₦]/.exec(ai)?.[0] ?? "";
  if (aiCurrency && !read[1]) return null;
  const currency = read[1] ?? "";
  const aiUnit = /(%|x|k|K|M|B)\+?$/.exec(ai)?.[1] ?? "";
  // "3m" is three million, as the AI writes it ("3M").
  let unit = read[3] === "m" ? "M" : read[3] === "b" ? "B" : (read[3] ?? "");
  // The AI's percent or multiple carries over; a scale (k, M, B) only onto a short number, so "3"
  // for "$2M" is "$3M" and "3,000,000" stays as typed.
  if (!unit && (aiUnit === "%" || aiUnit === "x")) return null;
  return `${currency}${read[2]}${unit}${read[4] ?? ""}`;
};

/** Where the AI's number `ai` stands in the line from `from` on, never a match inside another number; -1 when it is not there. */
const placeOf = (after: string, ai: string, from = 0): number => {
  for (const match of after.matchAll(FIGURE)) {
    if ((match.index ?? 0) >= from && match[0].replace(/[.,]$/, "") === ai) return match.index ?? 0;
  }
  return -1;
};
