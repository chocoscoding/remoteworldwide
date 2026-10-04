import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";
import EntryHeader, { EntryBullets } from "../EntryHeader";
import { EntryFrame } from "../highlight";

export interface ExperienceSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

/** A role hidden with the editor's eye toggle stays on the document and off the page (and so off every export of it). */
const ExperienceSection: FC<ExperienceSectionProps> = ({ content, design }) => {
  if (content.experience.length === 0) {
    return <p data-resume-placeholder className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No experience added yet.</p>;
  }
  const shown = content.experience.filter((exp) => !exp.hidden);
  if (shown.length === 0) {
    return <p data-resume-placeholder className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">Every role is hidden.</p>;
  }
  return (
    <div className="flex flex-col gap-[var(--r-gap)]">
      {shown.map((exp) => (
        <div key={exp.id} className="relative">
          <EntryFrame entryId={exp.id} />
          <EntryHeader primary={exp.role} secondary={exp.company} dates={exp.dates} design={design} />
          <EntryBullets items={exp.bullets} design={design} entryId={exp.id} />
        </div>
      ))}
    </div>
  );
};

export default ExperienceSection;
