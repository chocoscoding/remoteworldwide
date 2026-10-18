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
