import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";

export interface CustomSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

/**
 * `ResumeContent` has no generic custom-sections array — adding one is out of
 * scope for this chunk (it would mean reopening A0's finished content types
 * for a speculative feature with no consumer yet). SectionRenderer already
 * renders this section's heading via SectionHeading for every kind including
 * "custom", so this component is only ever the body: a muted placeholder.
 */
const CustomSection: FC<CustomSectionProps> = () => (
  <p className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No content yet.</p>
);

export default CustomSection;
