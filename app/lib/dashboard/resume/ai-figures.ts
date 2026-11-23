// Suggested numbers apply immediately and remain highlighted until edited or cleared.
// Highlight metadata saves with the resume and is never printed.

import type { ResumeAiFigure, ResumeContent } from "@/app/lib/dashboard/types";

/** A number as a reader sees it: "30%", "$1.2M", "3,000", "2x", "40+". */
const FIGURE = /[$€£₦]?\d[\d,.]*(?:%|\+|x|k|K|M|B)?/g;

const figuresOf = (line: string): string[] => (line.match(FIGURE) ?? []).map((figure) => figure.replace(/[.,]$/, ""));

/** The numbers `after` has that `before` didn't: what Quantify added to the line. */
export const addedFigures = (before: string, after: string): string[] => {
  const had = new Set(figuresOf(before));
  return [...new Set(figuresOf(after).filter((figure) => !had.has(figure)))];
};

/** Every line the AI's numbers can be in: the summary, bullets and custom sections' points. */
const linesOf = (content: ResumeContent): string[] => [
  content.summary,
  ...content.experience.flatMap((entry) => entry.bullets),
  ...(content.customSections ?? []).flatMap((section) => section.items),
];

/**
 * The lines one AI edit changed, each with what it was: the summary, a role's bullets by their
 * place, a custom section's points by theirs. For recording the numbers an edit like Ask added.
 */
export const changedLines = (before: ResumeContent, after: ResumeContent): Array<{ before: string; after: string }> => {
  const pairs: Array<{ before: string; after: string }> = [];
  if (after.summary !== before.summary) pairs.push({ before: before.summary, after: after.summary });
  after.experience.forEach((entry) => {
    const was = before.experience.find((old) => old.id === entry.id)?.bullets ?? [];
    entry.bullets.forEach((bullet, index) => {
      if (bullet !== was[index]) pairs.push({ before: was[index] ?? "", after: bullet });
    });
  });
  (after.customSections ?? []).forEach((section) => {
    const was = (before.customSections ?? []).find((old) => old.id === section.id)?.items ?? [];
    section.items.forEach((item, index) => {
      if (item !== was[index]) pairs.push({ before: was[index] ?? "", after: item });
    });
  });
  return pairs;
};

/**
 * Ask's much longer lines put in place (owner, 2026-10-18: warn, and if they choose to continue, do
 * it). `at` is the service's address: "summary", "<role>.<bullet>" or "c<section>.<point>", by
 * position in the content the service returned.
 */
export const withLonger = (content: ResumeContent, longer: ReadonlyArray<{ at: string; after: string }>): ResumeContent => {
  let next = content;
  for (const { at, after } of longer) {
    if (at === "summary") {
      next = { ...next, summary: after };
      continue;
    }
    const custom = /^c(\d+)\.(\d+)$/.exec(at);
    if (custom) {
      const [s, p] = [Number(custom[1]), Number(custom[2])];
      next = {
        ...next,
        customSections: (next.customSections ?? []).map((section, i) =>
          i === s ? { ...section, items: section.items.map((item, j) => (j === p ? after : item)) } : section,
        ),
      };
      continue;
    }
    const bullet = /^(\d+)\.(\d+)$/.exec(at);
    if (!bullet) continue;
    const [e, b] = [Number(bullet[1]), Number(bullet[2])];
    next = {
      ...next,
      experience: next.experience.map((entry, i) => (i === e ? { ...entry, bullets: entry.bullets.map((line, j) => (j === b ? after : line)) } : entry)),
    };
  }
  return next;
};

const wordsOf = (value: string): string[] => value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2);

/** Splitting a paragraph keeps its exact sentence, even when that sentence
 * contains less than half the paragraph's words. */
export const sameAiFigureLine = (text:string, original:string):boolean => {
  const was=wordsOf(original),now=new Set(wordsOf(text));
  return was.length===0 || was.filter(word=>now.has(word)).length*2>=was.length ||
    (now.size>=4 && original.includes(text.trim()));
};

/** Keep a percentage highlighted when the writer puts a space before its unit. */
export const findAiFigure = (line:string,figure:string) => {
  if (!figure) return null;
  const pattern=figure.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s*%$/,"\\s*%");
  return new RegExp("(?<![\\d.])"+pattern+"(?!\\d)").exec(line);
};

/**
 * Whether a recorded number is still on the resume: some line still has that exact figure and keeps
 * at least half the words of the line Quantify wrote. Editing the number, or rewriting or deleting
 * the line, takes it off the list by itself.
 */
const stillThere = (figure: ResumeAiFigure, lines: readonly string[]): boolean => {
  return lines.some(line=>Boolean(findAiFigure(line,figure.figure)) && sameAiFigureLine(line,figure.line));
};

/** The AI's numbers still highlighted: none once cleared, and only those still on the resume. The person's own are not the AI's. */
export const pendingAiFigures = (content: ResumeContent): ResumeAiFigure[] => {
  if (content.aiFiguresCleared) return [];
  const lines = linesOf(content);
  return (content.aiFigures ?? []).filter((figure) => !figure.own && stillThere(figure, lines));
};

/** The person's own numbers still on the resume (`own`), kept through the AI list's changes. */
const ownFigures = (content: ResumeContent): ResumeAiFigure[] => {
  const lines = linesOf(content);
  return (content.aiFigures ?? []).filter((figure) => figure.own && stillThere(figure, lines));
};

/**
 * The content with the numbers just-accepted Quantify suggestions added recorded. A new number after
 * "I've checked them" brings the pill back with only the new ones.
 */
export const withAiFigures = (content: ResumeContent, accepted: ReadonlyArray<{ before: string; after: string }>): ResumeContent => {
  const addedAt = new Date().toISOString();
  const fresh: ResumeAiFigure[] = accepted.flatMap(({ before, after }) => addedFigures(before, after).map((figure) => ({ figure, before, line: after, addedAt })));
  if (fresh.length === 0) return content;
  const kept = content.aiFiguresCleared ? [] : pendingAiFigures(content);
  return { ...content, aiFigures: [...ownFigures(content), ...kept, ...fresh], aiFiguresCleared: false };
};

/**
 * The content with the person's own numbers for a line recorded (`own`), the ones they typed in
 * answer to an Impact estimate (owner, 2026-10-22, fix plan 1d). The AI service remembers them for
 * the line, so the next application uses the person's number, never the AI's guess again. Never
 * shown in the AI numbers pill.
 */
export const withOwnFigures = (content: ResumeContent, before: string, after: string, binding?:{skill:string;entryId:string}): ResumeContent => {
  const addedAt = new Date().toISOString();
  const fresh: ResumeAiFigure[] = addedFigures(before, after).map((figure) => ({ figure, line: after, addedAt, own: true, ...binding }));
  if (fresh.length === 0) return content;
  return { ...content, aiFigures: [...(content.aiFigures ?? []), ...fresh] };
};

/** "Clear highlights": the AI's list is emptied and marked cleared; the person's own numbers stay. */
export const clearAiFigures = (content: ResumeContent): ResumeContent => ({ ...content, aiFigures: ownFigures(content), aiFiguresCleared: true });
