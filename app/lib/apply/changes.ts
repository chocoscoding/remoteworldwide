// What tailoring changed in a resume, as the text to highlight in the preview
// (owner, 2026-10-03: "underline, highlight everything" that changed).
//
// Compared line by line against the resume it was built from: summary
// sentences that are new, skills added, bullets new or reworded, and a changed
// title. Whitespace and case don't count as a change. Pure and type-only in its
// imports, for tests/apply.test.mjs.

import type { ResumeContent } from "@/app/lib/dashboard/types";

export interface ResumeChanges {
  /** Sentences of the new summary that the old one did not have. */
  summary: string[];
  skills: string[];
  /** Every bullet that is new or reworded: what the preview highlights. */
  bullets: string[];
  /** Of `bullets`, the ones added past a role's own (a new bullet), and the ones that reworded an existing line. */
  newBullets: string[];
  rewordedBullets: string[];
  title: string | null;
}

const norm = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/** A summary's sentences. A full stop inside "e.g." splits too — harmless, as both sides split the same way. */
const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

export function resumeChanges(before: ResumeContent | null, after: ResumeContent): ResumeChanges {
  const oldSentences = new Set(sentences(before?.summary ?? "").map(norm));
  const oldSkills = new Set((before?.skills ?? []).map(norm));
  const oldBullets = new Set((before?.experience ?? []).flatMap((entry) => entry.bullets).map(norm));

  const title = after.title.trim() && norm(after.title) !== norm(before?.title ?? "") ? after.title.trim() : null;
  const changed = (bullet: string) => bullet.trim() !== "" && !oldBullets.has(norm(bullet));
  // A role's bullets past the count it had are new; a changed one within its count reworded a line
  // (owner, 2026-10-18: "4 bullets reworded" was four NEW bullets).
  const newBullets: string[] = [];
  const rewordedBullets: string[] = [];
  after.experience.forEach((entry, index) => {
    const had = before?.experience[index]?.bullets.length ?? 0;
    entry.bullets.forEach((bullet, position) => {
      if (!changed(bullet)) return;
      (position >= had ? newBullets : rewordedBullets).push(bullet.trim());
    });
  });
  return {
    summary: sentences(after.summary).filter((sentence) => !oldSentences.has(norm(sentence))),
    skills: after.skills.map((skill) => skill.trim()).filter((skill) => skill && !oldSkills.has(norm(skill))),
    bullets: after.experience
      .flatMap((entry) => entry.bullets)
      .map((bullet) => bullet.trim())
      .filter((bullet) => bullet && !oldBullets.has(norm(bullet))),
    newBullets,
    rewordedBullets,
    title,
  };
}

/**
 * The caption for a set of changes, each kind counted apart: "Summary rewritten · 2 bullets
 * improved · 1 new bullet · 2 skills added". Empty when nothing changed.
 */
export const changeCaption = (changes: ResumeChanges, hadSummary: boolean): string =>
  [
    changes.summary.length > 0 ? (hadSummary ? "Summary rewritten" : "New summary") : null,
    changes.rewordedBullets.length > 0 ? `${changes.rewordedBullets.length} bullet${changes.rewordedBullets.length === 1 ? "" : "s"} improved` : null,
    changes.newBullets.length > 0 ? `${changes.newBullets.length} new bullet${changes.newBullets.length === 1 ? "" : "s"}` : null,
    changes.skills.length > 0 ? `${changes.skills.length} skill${changes.skills.length === 1 ? "" : "s"} added` : null,
  ]
    .filter(Boolean)
    .join(" · ");

export const changeCount = (changes: ResumeChanges): number =>
  changes.summary.length + changes.skills.length + changes.bullets.length + (changes.title ? 1 : 0);

/** Every changed string, longest first, so a sentence is matched before a skill that appears inside it. */
export const highlightTexts = (changes: ResumeChanges): string[] =>
  [...changes.summary, ...changes.bullets, ...(changes.title ? [changes.title] : []), ...changes.skills].sort((a, b) => b.length - a.length);

/** One thing to mark on the paper: `text`, found inside the line `within` when it is given. */
export interface HighlightMark {
  text: string;
  within?: string;
}

/** A word as compared: lower case, without the punctuation around it. */
const wordKey = (word: string) => word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/**
 * The runs of words a line gained, as `after` writes them (owner, 2026-10-21: "we are only meant to
 * highlight what we added, not the whole line that was changed"). Compared word for word against the
 * line it replaced, by the longest common run of words, so a reworded line marks only what is new.
 */
export function addedParts(before: string, after: string): string[] {
  const a = before.trim().split(/\s+/).filter(Boolean);
  const b = after.trim().split(/\s+/).filter(Boolean);
  const ka = a.map(wordKey);
  const kb = b.map(wordKey);
  // Longest common subsequence of words: what stayed. Lines are short, so the table is small.
  const table = Array.from({ length: ka.length + 1 }, () => new Array<number>(kb.length + 1).fill(0));
  for (let i = ka.length - 1; i >= 0; i -= 1) {
    for (let j = kb.length - 1; j >= 0; j -= 1) {
      table[i][j] = ka[i] && ka[i] === kb[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const kept = new Array<boolean>(b.length).fill(false);
  for (let i = 0, j = 0; i < ka.length && j < kb.length; ) {
    if (ka[i] && ka[i] === kb[j]) {
      kept[j] = true;
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  const parts: string[] = [];
  let run: string[] = [];
  b.forEach((word, index) => {
    if (!kept[index] && wordKey(word)) run.push(word);
    else if (run.length > 0) {
      parts.push(run.join(" "));
      run = [];
    }
  });
  if (run.length > 0) parts.push(run.join(" "));
  return parts;
}

/**
 * What the paper marks: in a reworded bullet or a rewritten summary only the words it gained, inside
 * that line; a new bullet, a new title and a new skill whole.
 */
export function highlightMarks(before: ResumeContent | null, after: ResumeContent): HighlightMark[] {
  const changes = resumeChanges(before, after);
  const marks: HighlightMark[] = [];
  const reworded = new Set(changes.rewordedBullets);
  after.experience.forEach((entry, index) => {
    entry.bullets.forEach((bullet, position) => {
      const line = bullet.trim();
      if (!reworded.has(line)) return;
      const old = before?.experience[index]?.bullets[position] ?? "";
      for (const text of addedParts(old, line)) marks.push({ text, within: line });
    });
  });
  for (const line of changes.newBullets) marks.push({ text: line });
  if (changes.summary.length > 0 && before?.summary.trim()) {
    for (const text of addedParts(before.summary, after.summary)) marks.push({ text, within: after.summary.trim() });
  } else {
    for (const sentence of changes.summary) marks.push({ text: sentence });
  }
  if (changes.title) marks.push({ text: changes.title });
  for (const skill of changes.skills) marks.push({ text: skill });
  return marks.sort((x, y) => y.text.length - x.text.length);
}
