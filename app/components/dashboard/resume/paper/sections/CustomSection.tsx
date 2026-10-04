import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";
import { EntryBullets } from "../EntryHeader";

export interface CustomSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
  /** The section's id, which its points are kept under in `content.customSections`. */
  sectionId?: string;
}

/**
 * A section the person named themselves (owner, 2026-10-04): its points as a
 * bullet list, in the entries' bullet style. Its heading — the name they gave
 * it — is the section's own label, drawn by `SectionRenderer` like any other.
 */
const CustomSection: FC<CustomSectionProps> = ({ content, design, sectionId }) => {
  const items = content.customSections?.find((section) => section.id === sectionId)?.items ?? [];
  if (!items.some((item) => item.trim())) {
    return <p data-resume-placeholder className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No points added yet.</p>;
  }
  // By the section's id, so the AI tools can pick a point and the paper can underline or highlight one.
  return <EntryBullets items={items} design={design} customId={sectionId} />;
};

export default CustomSection;
