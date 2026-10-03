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
  bullets: string[];
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
  return {
    summary: sentences(after.summary).filter((sentence) => !oldSentences.has(norm(sentence))),
    skills: after.skills.map((skill) => skill.trim()).filter((skill) => skill && !oldSkills.has(norm(skill))),
    bullets: after.experience
      .flatMap((entry) => entry.bullets)
      .map((bullet) => bullet.trim())
      .filter((bullet) => bullet && !oldBullets.has(norm(bullet))),
    title,
  };
}

export const changeCount = (changes: ResumeChanges): number =>
  changes.summary.length + changes.skills.length + changes.bullets.length + (changes.title ? 1 : 0);

/** Every changed string, longest first, so a sentence is matched before a skill that appears inside it. */
export const highlightTexts = (changes: ResumeChanges): string[] =>
  [...changes.summary, ...changes.bullets, ...(changes.title ? [changes.title] : []), ...changes.skills].sort((a, b) => b.length - a.length);
