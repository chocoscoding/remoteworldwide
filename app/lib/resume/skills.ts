// Skills, as one plain list ("All") or split into titled groups ("Sub skills").
//
// `content.skills` is the flat list in BOTH modes, and `content.skillGroups`
// says how it is split when it is. Keeping the flat list whole is what lets
// every reader that predates groups (the AI tools, the ATS check, the text the
// check compares, the builder) carry on reading one list, untouched. The cost
// is one rule, kept here: in groups mode, `skills` is exactly the groups' skills
// in order. `withGroups` writes both together; `reconcileGroups` repairs the
// groups after something that only knows the flat list (Tailor, Add missing
// keywords, a server-side edit) has changed it.
//
// Types only from outside, so the tests can load it on their own.

import type { ResumeContent, ResumeSkillGroup } from "@/app/lib/dashboard/types";
import type { SkillSeparator } from "@/app/lib/dashboard/resume/design-types";

/** A skill is a few words. Longer than this is a sentence, and it would stretch a grid column across the page. */
export const SKILL_MAX_CHARS = 50;

/** A group's title sits on a skill's line or above its columns: a label, not a heading. */
export const SKILL_GROUP_TITLE_MAX_CHARS = 40;

/** How the paper (and Word) separate skills. A star is "★", read as a decorative mark, not a footnote. */
export const SKILL_SEPARATOR_GLYPH: Record<SkillSeparator, string> = { bullet: "•", comma: ",", star: "★" };

const key = (skill: string) => skill.trim().toLowerCase();

export const isGrouped = (content: Pick<ResumeContent, "skillGroups">): content is { skillGroups: ResumeSkillGroup[] } =>
  Array.isArray(content.skillGroups);

/** Every group's skills as one list, in order, each skill once (case-insensitively). */
export function flattenGroups(groups: ResumeSkillGroup[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const skill of group.skills) {
      const k = key(skill);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(skill);
    }
  }
  return out;
}

/** The content with these groups, and the flat list rebuilt from them. */
export const withGroups = (content: ResumeContent, groups: ResumeSkillGroup[]): ResumeContent => ({
  ...content,
  skillGroups: groups,
  skills: flattenGroups(groups),
});

/** "All" -> "Sub skills": what is there becomes the first group, untitled until they name it. */
export const toGrouped = (content: ResumeContent, id: string): ResumeContent =>
  withGroups(content, [{ id, title: "", skills: [...content.skills] }]);

/** "Sub skills" -> "All": the titles go, the skills stay — the flat list already holds them all. */
export function toFlat(content: ResumeContent): ResumeContent {
  if (!isGrouped(content)) return content;
  const next: ResumeContent = { ...content, skills: flattenGroups(content.skillGroups) };
  delete next.skillGroups;
  return next;
}

/**
 * Brings the groups back in line with the flat list after something that only
 * knows the flat list changed it: a skill no longer listed leaves its group, a
 * new one joins the last group (one that is all there is, untitled, when there
 * are none). Returns the same object when nothing was out of line.
 */
export function reconcileGroups(content: ResumeContent): ResumeContent {
  if (!isGrouped(content)) return content;
  const listed = new Set(content.skills.map(key));
  let changed = false;
  const groups = content.skillGroups.map((group) => {
    const kept = group.skills.filter((skill) => listed.has(key(skill)));
    if (kept.length === group.skills.length) return group;
    changed = true;
    return { ...group, skills: kept };
  });
  const grouped = new Set(groups.flatMap((group) => group.skills.map(key)));
  const loose = content.skills.filter((skill) => key(skill) && !grouped.has(key(skill)));
  if (loose.length > 0) {
    changed = true;
    if (groups.length === 0) groups.push({ id: "skg-1", title: "", skills: [] });
    const last = groups[groups.length - 1];
    groups[groups.length - 1] = { ...last, skills: [...last.skills, ...loose] };
  }
  const flat = flattenGroups(groups);
  const sameOrder = flat.length === content.skills.length && flat.every((skill, i) => skill === content.skills[i]);
  if (!changed && sameOrder) return content;
  return { ...content, skillGroups: groups, skills: flat };
}

/** Whether the resume lists this skill already, whatever its case. */
export const hasSkill = (content: Pick<ResumeContent, "skills">, skill: string): boolean =>
  content.skills.some((have) => key(have) === key(skill));

/**
 * The content with these skills added to the end of the list — into the last sub skill group when
 * the skills are grouped — each only if it is not there already. Returns the same object when
 * nothing was new.
 */
export function addSkills(content: ResumeContent, skills: string[]): ResumeContent {
  const fresh = flattenGroups([{ id: "", title: "", skills }]).filter((skill) => !hasSkill(content, skill));
  if (fresh.length === 0) return content;
  return reconcileGroups({ ...content, skills: [...content.skills, ...fresh] });
}

/** The groups worth printing: those with a skill in them. */
export const printableGroups = (groups: ResumeSkillGroup[]): ResumeSkillGroup[] =>
  groups.map((group) => ({ ...group, title: group.title.trim(), skills: group.skills.map((s) => s.trim()).filter(Boolean) })).filter((group) => group.skills.length > 0);

/** Skills on one line: "React, TypeScript" or "React • TypeScript" or "React ★ TypeScript". */
export const skillLine = (skills: string[], separator: SkillSeparator): string =>
  skills.join(separator === "comma" ? ", " : ` ${SKILL_SEPARATOR_GLYPH[separator]} `);
