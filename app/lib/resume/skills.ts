// Skills as ENTRIES (owner, 2026-10-08, after FlowCV's Skills list): every entry
// is a skill with a name ("Python", or "Soft Skills"), and may carry sub skills,
// typed as text separated by commas ("Effective Communication, Teamwork"). There
// is no "All" / "Sub skills" switch any more: a plain skill is an entry with no
// sub skills, and one list holds both.
//
// The entries live in `content.skillGroups` ({id, title, skills}: `title` is the
// entry's name, `skills` its sub skills, `hidden` the eye). `content.skills`
// stays the FLAT list every reader that predates entries uses (the AI tools, the
// ATS check, the text the check compares, the builder): for each shown entry its
// sub skills when it has some, else its name. A name over sub skills is a
// heading for them ("Soft Skills"), not a skill of its own. `withEntries` writes
// both together; `reconcileGroups` rebuilds the entries after something that only
// knows the flat list (Tailor, Add missing keywords, a server-side edit, a resume
// saved before entries) has changed it.
//
// Types only from outside, so the tests can load it on their own.

import type { ResumeContent, ResumeSkillGroup } from "@/app/lib/dashboard/types";
import type { SkillSeparator } from "@/app/lib/dashboard/resume/design-types";

/** A skill is a few words. Longer than this is a sentence, and it would stretch a grid column across the page. */
export const SKILL_MAX_CHARS = 50;

/** An entry's name: a skill, or the heading over its sub skills. */
export const SKILL_GROUP_TITLE_MAX_CHARS = 50;

/** How the paper (and Word) separate skills. A star is "★", read as a decorative mark, not a footnote. */
export const SKILL_SEPARATOR_GLYPH: Record<SkillSeparator, string> = { bullet: "•", comma: ",", star: "★" };

const key = (skill: string) => skill.trim().toLowerCase();

/** Whether the content already holds its skills as entries. */
export const isGrouped = (content: Pick<ResumeContent, "skillGroups">): content is { skillGroups: ResumeSkillGroup[] } =>
  Array.isArray(content.skillGroups);

/** "Effective Communication, Teamwork," -> the sub skills, as typed, without the empty ones. */
export const parseSubSkills = (text: string): string[] =>
  text
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

/** The sub skills as the text field shows them. */
export const subSkillText = (skills: string[]): string => skills.join(", ");

/** An entry's id from its name, unique among `taken` (which it joins). Deterministic, so an updater run twice agrees. */
function entryIdFor(name: string, taken: Set<string>): string {
  const base = `skl-${key(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x"}`;
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/** The skills of the entries as the flat list: shown entries only, sub skills over a name, each skill once (case-insensitively). */
export function flattenGroups(groups: ResumeSkillGroup[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    if (group.hidden) continue;
    const subs = group.skills.map((skill) => skill.trim()).filter(Boolean);
    for (const skill of subs.length > 0 ? subs : [group.title.trim()]) {
      const k = key(skill);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(skill);
    }
  }
  return out;
}

/** The entries a content has: its own, or one per skill of a resume saved before entries. */
export function entriesOf(content: Pick<ResumeContent, "skills" | "skillGroups">): ResumeSkillGroup[] {
  if (isGrouped(content)) return content.skillGroups;
  const taken = new Set<string>();
  return flattenGroups(content.skills.map((skill) => ({ id: "", title: skill, skills: [] }))).map((skill) => ({
    id: entryIdFor(skill, taken),
    title: skill,
    skills: [],
  }));
}

/** The content with these entries, and the flat list rebuilt from them. */
export const withEntries = (content: ResumeContent, groups: ResumeSkillGroup[]): ResumeContent => ({
  ...content,
  skillGroups: groups,
  skills: flattenGroups(groups),
});

/** An entry that has neither a name nor sub skills: the one being added. Never printed, never in the flat list. */
const isBlank = (group: ResumeSkillGroup) => !group.title.trim() && group.skills.every((skill) => !skill.trim());

/**
 * Brings the entries back in line with the flat list after something that only
 * knows the flat list changed it: a skill no longer listed leaves the entry it
 * was a sub skill of, or takes its entry with it when it was the entry's name; an
 * entry whose sub skills have all gone goes too; a skill new to the list becomes
 * an entry of its own at the end. Hidden and blank entries are left as they
 * are. A resume saved before entries gets one entry per skill. Returns the same
 * object when nothing was out of line.
 */
export function reconcileGroups<C extends Pick<ResumeContent, "skills" | "skillGroups">>(content: C): C {
  const before = entriesOf(content);
  const listed = new Set(content.skills.map(key));
  let changed = !isGrouped(content);
  const entries: ResumeSkillGroup[] = [];
  for (const group of before) {
    if (group.hidden || isBlank(group)) {
      entries.push(group);
      continue;
    }
    if (group.skills.some((skill) => skill.trim())) {
      const kept = group.skills.filter((skill) => listed.has(key(skill)));
      if (kept.length === group.skills.length) entries.push(group);
      else {
        changed = true;
        if (kept.length > 0) entries.push({ ...group, skills: kept });
      }
      continue;
    }
    if (listed.has(key(group.title))) entries.push(group);
    else changed = true;
  }

  const covered = new Set(flattenGroups(entries).map(key));
  const taken = new Set(entries.map((group) => group.id));
  for (const skill of content.skills) {
    const k = key(skill);
    if (!k || covered.has(k)) continue;
    covered.add(k);
    changed = true;
    entries.push({ id: entryIdFor(skill, taken), title: skill.trim(), skills: [] });
  }

  const flat = flattenGroups(entries);
  const sameOrder = flat.length === content.skills.length && flat.every((skill, i) => skill === content.skills[i]);
  if (!changed && sameOrder) return content;
  return { ...content, skillGroups: entries, skills: flat };
}

/** Whether the resume lists this skill already, whatever its case. */
export const hasSkill = (content: Pick<ResumeContent, "skills">, skill: string): boolean =>
  content.skills.some((have) => key(have) === key(skill));

/**
 * The content with these skills added to the end of the list, each as an entry
 * of its own, and only if it is not there already. Returns the same object when
 * nothing was new.
 */
export function addSkills(content: ResumeContent, skills: string[]): ResumeContent {
  const fresh = flattenGroups(skills.map((skill) => ({ id: "", title: skill, skills: [] }))).filter((skill) => !hasSkill(content, skill));
  if (fresh.length === 0) return content;
  return reconcileGroups({ ...content, skills: [...content.skills, ...fresh] });
}

/**
 * What prints, in order: each entry with sub skills as its name over them, and
 * every run of plain skills between them as one list without a name, so plain
 * skills and sub skills share the layout the Customize Skills panel picks.
 * Hidden and blank entries print nothing.
 */
export function printableGroups(groups: ResumeSkillGroup[]): ResumeSkillGroup[] {
  const blocks: ResumeSkillGroup[] = [];
  for (const group of groups) {
    if (group.hidden) continue;
    const title = group.title.trim();
    const skills = group.skills.map((skill) => skill.trim()).filter(Boolean);
    if (skills.length > 0) {
      blocks.push({ id: group.id, title, skills });
      continue;
    }
    if (!title) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.id.startsWith("plain:")) last.skills.push(title);
    else blocks.push({ id: `plain:${group.id}`, title: "", skills: [title] });
  }
  return blocks;
}

/** The blocks a content prints, whether or not it holds its skills as entries yet. */
export const printableSkills = (content: Pick<ResumeContent, "skills" | "skillGroups">): ResumeSkillGroup[] => printableGroups(entriesOf(content));

/** Skills on one line: "React, TypeScript" or "React • TypeScript" or "React ★ TypeScript". */
export const skillLine = (skills: string[], separator: SkillSeparator): string =>
  skills.join(separator === "comma" ? ", " : ` ${SKILL_SEPARATOR_GLYPH[separator]} `);
