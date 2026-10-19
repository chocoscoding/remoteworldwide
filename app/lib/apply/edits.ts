// The resume step's own edits on the page (owner, 2026-10-19: "click it and edit its text ... delete
// the line, change the number, since I can undo it"). Each one becomes a change of the draft and a
// step of its history, so undo takes it back. Pure: tests/apply.test.mjs runs it under plain
// `node --test`.

import type { ResumeContent } from "@/app/lib/dashboard/types";

export interface LineEdit {
  content: ResumeContent;
  /** What the history list says: "Edited a line at Kite", "Deleted a line at Kite", "Edited the Summary". */
  label: string;
}

const roleName = (content: ResumeContent, entryId: string): string => {
  const entry = content.experience.find((e) => e.id === entryId);
  return entry ? entry.company.trim() || entry.role.trim() || "a role" : "a role";
};

/** The summary, retyped. Null when nothing changed. */
export function editSummary(content: ResumeContent, text: string): LineEdit | null {
  const next = text.trim();
  if (next === content.summary.trim()) return null;
  return { content: { ...content, summary: next }, label: next ? "Edited the Summary" : "Cleared the Summary" };
}

/**
 * One line of a role, retyped, or deleted when emptied. A deleted line takes its "hidden for this
 * job" mark with it, and the marks on the lines after it move up one, so each still names its line.
 * Null when nothing changed or the line is not there.
 */
export function editBullet(content: ResumeContent, entryId: string, index: number, text: string): LineEdit | null {
  const entryIndex = content.experience.findIndex((e) => e.id === entryId);
  const entry = content.experience[entryIndex];
  if (!entry || index < 0 || index >= entry.bullets.length) return null;
  const next = text.trim();
  if (next === entry.bullets[index].trim()) return null;
  const where = roleName(content, entryId);

  if (next) {
    const bullets = entry.bullets.map((bullet, i) => (i === index ? next : bullet));
    const experience = content.experience.map((e, i) => (i === entryIndex ? { ...e, bullets } : e));
    return { content: { ...content, experience }, label: `Edited a line at ${where}` };
  }

  const bullets = entry.bullets.filter((_, i) => i !== index);
  const experience = content.experience.map((e, i) => (i === entryIndex ? { ...e, bullets } : e));
  const prefix = `exp:${entryId}:`;
  const hiddenParts = content.hiddenParts?.flatMap((key) => {
    if (!key.startsWith(prefix)) return [key];
    const at = Number(key.slice(prefix.length));
    if (!Number.isInteger(at) || at === index) return [];
    return [at > index ? `${prefix}${at - 1}` : key];
  });
  return {
    content: { ...content, experience, ...(hiddenParts ? { hiddenParts } : {}) },
    label: `Deleted a line at ${where}`,
  };
}
