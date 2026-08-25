import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";
import EntryHeader, { EntryBullets } from "../EntryHeader";

export interface ExperienceSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

const ExperienceSection: FC<ExperienceSectionProps> = ({ content, design }) => {
  if (content.experience.length === 0) {
    return <p className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No experience added yet.</p>;
  }
  return (
    <div className="flex flex-col gap-[var(--r-gap)]">
      {content.experience.map((exp) => (
        <div key={exp.id}>
          <EntryHeader primary={exp.role} secondary={exp.company} dates={exp.dates} design={design} />
          <EntryBullets items={exp.bullets} design={design} />
        </div>
      ))}
    </div>
  );
};

export default ExperienceSection;
