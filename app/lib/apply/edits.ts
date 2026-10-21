// The resume step's own edits on the page (owner, 2026-10-19: "click it and edit its text ... delete
// the line, change the number, since I can undo it"). Each one becomes a change of the draft and a
// step of its history, so undo takes it back. Pure: tests/apply.test.mjs runs it under plain
// `node --test`.

import type { ResumeContent, ResumeSkillGroup } from "@/app/lib/dashboard/types";
import { entriesOf, entryIdFor, withEntries } from "@/app/lib/resume/skills";

export interface LineEdit {
  content: ResumeContent;
  /** What the history list says: "Edited a line at Kite", "Deleted a line at Kite", "Edited the Summary". */
  label: string;
}

const roleName = (content: ResumeContent, entryId: string): string => {
  const entry = content.experience.find((e) => e.id === entryId);
  return entry ? entry.company.trim() || entry.role.trim() || "a role" : "a role";
};

/** The name, retyped. Never emptied: a resume always says whose it is. Null when nothing changed. */
export function editName(content: ResumeContent, text: string): LineEdit | null {
  const next = text.trim();
  if (!next || next === content.name.trim()) return null;
  return { content: { ...content, name: next }, label: "Edited your name" };
}

/** The title under the name, retyped, or removed when emptied. Null when nothing changed. */
export function editTitle(content: ResumeContent, text: string): LineEdit | null {
  const next = text.trim();
  if (next === (content.title ?? "").trim()) return null;
  return { content: { ...content, title: next }, label: next ? `Title set to ${next}` : "Removed your title" };
}

/**
 * One printed Skills line, retyped (owner, 2026-10-20: "I should also be able to type and edit my
 * skills"): "Frameworks: React, Express" is a group over its sub skills, a line with no colon is
 * skills on their own, and an emptied line takes its entries away. `blockId` is the printed
 * block's id (`printableGroups`): an entry's own id, or "plain:<first entry>" for a run of skills
 * printed as one list. Hidden entries stay where they are. Null when nothing changed.
 */
export function editSkills(content: ResumeContent, blockId: string, text: string): LineEdit | null {
  const entries = entriesOf(content);
  const plain = blockId.startsWith("plain:");
  const start = entries.findIndex((entry) => entry.id === (plain ? blockId.slice("plain:".length) : blockId));
  if (start === -1) return null;

  // The entries the line printed: one with sub skills, or the run of plain ones (skipping hidden
  // and blank entries, as printing does) up to the next entry with sub skills.
  const isPlain = (entry: ResumeSkillGroup) => !entry.hidden && entry.title.trim() !== "" && entry.skills.every((skill) => !skill.trim());
  const skipped = (entry: ResumeSkillGroup) => entry.hidden || (!entry.title.trim() && entry.skills.every((skill) => !skill.trim()));
  let end = start + 1;
  if (plain) while (end < entries.length && (isPlain(entries[end]) || skipped(entries[end]))) end += 1;
  const span = entries.slice(start, end);
  const printed = span.filter((entry) => !entry.hidden && (plain ? isPlain(entry) : true));
  const own = span[0].skills.map((skill) => skill.trim()).filter(Boolean).join(", ");
  const before = plain ? printed.map((entry) => entry.title.trim()).join(", ") : span[0].title.trim() ? `${span[0].title.trim()}: ${own}` : own;

  const line = text.replace(/\s+/g, " ").trim();
  if (line === before) return null;
  const colon = line.indexOf(":");
  const title = colon > 0 ? line.slice(0, colon).trim() : "";
  const skills = (colon > 0 ? line.slice(colon + 1) : line)
    .split(/\s*[,;•★]\s*/)
    .map((skill) => skill.trim())
    .filter((skill, i, all) => skill !== "" && all.findIndex((other) => other.toLowerCase() === skill.toLowerCase()) === i);

  const taken = new Set(entries.filter((_, i) => i < start || i >= end).map((entry) => entry.id));
  const kept = (id: string) => {
    taken.add(id);
    return id;
  };
  const made: ResumeSkillGroup[] =
    skills.length === 0
      ? []
      : title
        ? [{ id: plain ? entryIdFor(title, taken) : kept(span[0].id), title, skills }]
        : skills.map((skill) => ({ id: entryIdFor(skill, taken), title: skill, skills: [] }));
  // Hidden entries in the span keep their place after the line's.
  const groups = [...entries.slice(0, start), ...made, ...span.filter((entry) => entry.hidden), ...entries.slice(end)];
  return { content: withEntries(content, groups), label: made.length === 0 ? "Removed skills" : "Edited your Skills" };
}

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
