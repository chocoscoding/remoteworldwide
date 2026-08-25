import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";
import EntryHeader from "../EntryHeader";

export interface EducationSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

const EducationSection: FC<EducationSectionProps> = ({ content, design }) => {
  if (content.education.length === 0) {
    return <p className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No education added yet.</p>;
  }
  return (
    <div className="flex flex-col gap-[var(--r-gap)]">
      {content.education.map((edu) => (
        <div key={edu.id}>
          <EntryHeader primary={edu.degree} secondary={edu.school} dates={edu.dates} location={edu.location} design={design} />
          {edu.detail && (
            <p className="mt-[2pt] text-[length:var(--r-fs-small)] leading-[var(--r-lh)] text-[color:var(--r-text-muted)]">{edu.detail}</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default EducationSection;
