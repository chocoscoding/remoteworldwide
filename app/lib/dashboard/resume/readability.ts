// Readability: what in a resume's design makes it harder for an applicant tracking system to read
// (RWW/ATS-QUALITY-PLAN.md, 13.2). Worked out here from the design itself, free, with no AI call.
// Each flag carries the one design action that fixes it; templates are never taken away, the check
// only says what a choice costs (Jeff Su's data: 87% of hiring managers say their AI reads simple,
// text-based resumes more accurately).
//
// Pure and type-only in its imports, so it can be tested on its own.

import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { DesignAction } from "@/app/lib/dashboard/resume/design-reducer";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";

export interface ReadabilityFlag {
  id: "columns" | "photo" | "heading-icons" | "heading-name" | "education-first";
  /** What is wrong, in a few words. */
  title: string;
  /** Why it matters, one short sentence. */
  why: string;
  /** The fix's button label. */
  fixLabel: string;
  /** The design actions that fix it, applied as one step. */
  fix: DesignAction[];
  /** A note rather than a fault (a photo where local norms expect one). */
  soft?: boolean;
}

/** Heading names an applicant tracking system recognises, lowercase. */
const STANDARD_HEADINGS = new Set([
  "summary",
  "profile",
  "professional summary",
  "about",
  "about me",
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "employment history",
  "education",
  "skills",
  "technical skills",
  "key skills",
  "projects",
  "certifications",
  "certifications & training",
  "certifications and training",
  "training",
  "licenses & certifications",
  "personal details",
  "contact",
]);

/** The standard name a section of each kind is renamed to. */
const STANDARD_NAME: Partial<Record<SectionConfig["kind"], string>> = {
  summary: "Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  training: "Certifications & Training",
};

/** Every readability flag for a resume as it stands, most important first. */
export function readabilityFlags(design: ResumeDesign, sections: readonly SectionConfig[], content: ResumeContent): ReadabilityFlag[] {
  const flags: ReadabilityFlag[] = [];
  if (design.layout.columns !== "one") {
    flags.push({
      id: "columns",
      title: "Two columns",
      why: "Applicant tracking systems read one column best; a side column can be read out of order.",
      fixLabel: "Switch to one column",
      fix: [{ type: "layout/setColumns", columns: "one" }],
    });
  }
  if (design.photo.show) {
    flags.push({
      id: "photo",
      title: "Photo",
      why: "A photo adds file size and nothing an applicant tracking system can read. Keep it where your country expects one.",
      fixLabel: "Hide the photo",
      fix: [{ type: "photo/toggle" }],
      soft: true,
    });
  }
  if (design.headings.icons !== "none") {
    flags.push({
      id: "heading-icons",
      title: "Icons on headings",
      why: "Icons are images to a parser; a plain heading reads every time.",
      fixLabel: "Turn heading icons off",
      fix: [{ type: "headings/setIcons", icons: "none" }],
    });
  }
  // Contact-line icons are not flagged: they sit beside the email and phone as text, which a parser
  // still reads, and the default design uses them.
  const renames = sections
    .filter((section) => section.visible && STANDARD_NAME[section.kind] && !STANDARD_HEADINGS.has(section.label.trim().toLowerCase()))
    .map((section): DesignAction => ({ type: "sections/rename", id: section.id, label: STANDARD_NAME[section.kind] as string }));
  if (renames.length > 0) {
    flags.push({
      id: "heading-name",
      title: renames.length === 1 ? "A heading with an unusual name" : `${renames.length} headings with unusual names`,
      why: "A parser looks for headings like Experience and Education; an unusual name can hide what is under it.",
      fixLabel: renames.length === 1 ? "Use the standard name" : "Use the standard names",
      fix: renames,
    });
  }
  const experience = sections.findIndex((section) => section.kind === "experience" && section.visible);
  const education = sections.findIndex((section) => section.kind === "education" && section.visible);
  const hasRoles = content.experience.some((entry) => !entry.hidden && (entry.role.trim() || entry.company.trim()));
  if (hasRoles && experience !== -1 && education !== -1 && education < experience) {
    flags.push({
      id: "education-first",
      title: "Education above Experience",
      why: "Most hiring managers value relevant work over education, so lead with your experience.",
      fixLabel: "Move Experience up",
      fix: [{ type: "sections/reorder", from: experience, to: education }],
    });
  }
  return flags;
}
