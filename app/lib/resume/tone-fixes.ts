// "Fix tone & grammar" proposals on the resume screen (owner, 2026-10-04): the service proposes,
// the person applies or sets aside, one by one, and the paper underlines in red what each would
// change while it waits.
//
// The service numbers lines its own way (a bullet among its role's non-empty bullets, an entry by
// position); a proposal is pinned here, once, to what it is on the page — an entry's id, a bullet's
// stored index, a skill's text — so it follows its line when roles are reordered or a bullet is
// added above it. A fix applies only while its line still reads as it did when it was proposed:
// a line edited since is the person's, not the proposal's.
//
// Types only from outside, so the tests load it on their own.

import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ToneFix } from "@/app/lib/resume/ai";
import { changedRanges } from "./diff";
import { reconcileGroups } from "./skills";

/** Where a proposal sits on the page, by what it is. The same shape as the paper's `UnderlineAt`. */
export type ToneWhere =
  | { field: "summary" }
  | { field: "bullet"; entryId: string; index: number }
  | { field: "skill"; skill: string }
  | { field: "degree"; entryId: string }
  | { field: "detail"; entryId: string }
  | { field: "project"; entryId: string }
  | { field: "certification"; entryId: string }
  /** A custom section's point, by its stored index in the section's points. */
  | { field: "point"; customId: string; index: number };

export interface ToneProposal {
  key: string;
  where: ToneWhere;
  before: string;
  after: string;
  kind: string;
  /** Where it is, for its card: "Summary", "Frontend Engineer", "Skills"… */
  label: string;
  /** What it would change in `before`, for the red underline. */
  ranges: [number, number][];
}

export type ToneProposalState = "pending" | "applied" | "dismissed" | "gone";

const storedIndex = (bullets: string[], nth: number): number => {
  let seen = -1;
  for (let i = 0; i < bullets.length; i++) {
    if (bullets[i].trim()) seen += 1;
    if (seen === nth) return i;
  }
  return -1;
};

const whereKey = (where: ToneWhere): string =>
  where.field === "summary"
    ? "summary"
    : where.field === "skill"
      ? `skill:${where.skill}`
      : where.field === "bullet"
        ? `bullet:${where.entryId}:${where.index}`
        : where.field === "point"
          ? `point:${where.customId}:${where.index}`
          : `${where.field}:${where.entryId}`;

/**
 * The service's proposals, pinned to the page as it is now. One that names a line no longer there is
 * dropped. A custom section's point is labelled with the section's `title` when the content carries
 * one (`withSectionTitles`).
 */
export function pinToneFixes(content: ResumeContent, fixes: ToneFix[]): ToneProposal[] {
  return fixes.flatMap((fix): ToneProposal[] => {
    const at = fix.at;
    let where: ToneWhere | null = null;
    let label = "";
    if (at.field === "summary") {
      where = { field: "summary" };
      label = "Summary";
    } else if (at.field === "bullet") {
      const entry = content.experience[at.entryIndex];
      const index = entry ? storedIndex(entry.bullets, at.bulletIndex) : -1;
      if (entry && index >= 0) {
        where = { field: "bullet", entryId: entry.id, index };
        label = entry.role.trim() || entry.company.trim() || "A role";
      }
    } else if (at.field === "skill") {
      where = { field: "skill", skill: fix.before };
      label = "Skills";
    } else if (at.field === "degree" || at.field === "detail") {
      const entry = content.education[at.index];
      if (entry) {
        where = { field: at.field, entryId: entry.id };
        label = entry.school.trim() || "Education";
      }
    } else if (at.field === "project") {
      const entry = content.projects[at.index];
      if (entry) {
        where = { field: "project", entryId: entry.id };
        label = entry.name.trim() || "A project";
      }
    } else if (at.field === "certification") {
      const entry = content.certifications[at.index];
      if (entry) {
        where = { field: "certification", entryId: entry.id };
        label = "Certifications";
      }
    } else if (at.field === "point") {
      const section = content.customSections?.find((s) => s.id === at.customId);
      const index = section ? storedIndex(section.items, at.index) : -1;
      if (section && index >= 0) {
        where = { field: "point", customId: section.id, index };
        label = section.title?.trim() || "Custom section";
      }
    }
    if (!where) return [];
    return [{ key: `${whereKey(where)}|${fix.before}|${fix.after}`, where, before: fix.before, after: fix.after, kind: fix.kind, label, ranges: changedRanges(fix.before, fix.after) }];
  });
}

/** What the line a proposal is about reads now, or null when it is gone. */
export function lineNow(content: ResumeContent, where: ToneWhere): string | null {
  switch (where.field) {
    case "summary":
      return content.summary;
    case "bullet":
      return content.experience.find((entry) => entry.id === where.entryId)?.bullets[where.index] ?? null;
    case "skill":
      return content.skills.includes(where.skill) ? where.skill : null;
    case "degree":
      return content.education.find((entry) => entry.id === where.entryId)?.degree ?? null;
    case "detail":
      return content.education.find((entry) => entry.id === where.entryId)?.detail ?? null;
    case "project":
      return content.projects.find((entry) => entry.id === where.entryId)?.detail ?? null;
    case "certification":
      return content.certifications.find((entry) => entry.id === where.entryId)?.name ?? null;
    case "point":
      return content.customSections?.find((section) => section.id === where.customId)?.items[where.index] ?? null;
  }
}

/** Where a proposal stands: still waiting, in, set aside, or overtaken by an edit to its line. */
export function proposalState(content: ResumeContent, proposal: ToneProposal, dismissed: readonly string[]): ToneProposalState {
  const now = lineNow(content, proposal.where);
  if (proposal.where.field === "skill") {
    if (content.skills.includes(proposal.after)) return "applied";
    if (now === null) return "gone";
  } else if (now === proposal.after) return "applied";
  if (now !== proposal.before) return "gone";
  return dismissed.includes(proposal.key) ? "dismissed" : "pending";
}

/** The content with one proposal applied — only while its line still reads as it did. */
export function applyToneFix(content: ResumeContent, proposal: ToneProposal): ResumeContent {
  const { where, before, after } = proposal;
  if (lineNow(content, where) !== (where.field === "skill" ? where.skill : before)) return content;
  switch (where.field) {
    case "summary":
      return { ...content, summary: after };
    case "bullet":
      return {
        ...content,
        experience: content.experience.map((entry) =>
          entry.id === where.entryId ? { ...entry, bullets: entry.bullets.map((bullet, i) => (i === where.index ? after : bullet)) } : entry,
        ),
      };
    case "skill": {
      // Renamed where it stands, in the flat list and in its sub skill group alike.
      const rename = (skill: string) => (skill === where.skill ? after : skill);
      const skillGroups = content.skillGroups?.map((group) => ({ ...group, skills: group.skills.map(rename) }));
      return reconcileGroups({ ...content, skills: content.skills.map(rename), ...(skillGroups ? { skillGroups } : {}) });
    }
    case "degree":
    case "detail":
      return { ...content, education: content.education.map((entry) => (entry.id === where.entryId ? { ...entry, [where.field]: after } : entry)) };
    case "project":
      return { ...content, projects: content.projects.map((entry) => (entry.id === where.entryId ? { ...entry, detail: after } : entry)) };
    case "certification":
      return { ...content, certifications: content.certifications.map((entry) => (entry.id === where.entryId ? { ...entry, name: after } : entry)) };
    case "point":
      return {
        ...content,
        customSections: content.customSections?.map((section) =>
          section.id === where.customId ? { ...section, items: section.items.map((item, i) => (i === where.index ? after : item)) } : section,
        ),
      };
  }
}
