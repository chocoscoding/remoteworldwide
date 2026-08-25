import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";

export interface SkillsSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

/**
 * Renders `content.skills` as pills. `design` is accepted (unused) only for
 * uniformity with the other section components' prop shape — `ResumeDesign`
 * has no skills-display control to branch on, so there's nothing to read.
 * Pill color deliberately uses `current` (border-current/25, bg-current/10)
 * rather than a `--r-*` var: `currentColor` already resolves to whatever text
 * color is ambient at this point in the tree (`--r-text` in the main column,
 * `--r-side-fg` inside a filled sidebar), so the pill adapts to either
 * context automatically instead of needing its own color decision.
 */
const SkillsSection: FC<SkillsSectionProps> = ({ content }) => {
  if (content.skills.length === 0) {
    return <p className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No skills added yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-[6pt]">
      {content.skills.map((skill) => (
        <span
          key={skill}
          className="rounded-full border border-current/25 bg-current/10 px-[8pt] py-[2pt] text-[length:var(--r-fs-small)] leading-tight">
          {skill}
        </span>
      ))}
    </div>
  );
};

export default SkillsSection;
