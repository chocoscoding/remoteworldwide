"use client";

import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";
import EntryHeader, { EntryBullets } from "../EntryHeader";
import AddExperience from "../AddExperience";
import { EditableLine, EntryFrame, usePaperHighlight } from "../highlight";

export interface ExperienceSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

/** A role hidden with the editor's eye toggle stays on the document and off the page (and so off every export of it). */
const ExperienceSection: FC<ExperienceSectionProps> = ({ content, design }) => {
  const {edits} = usePaperHighlight();
  if (content.experience.length === 0 && !edits?.onAddExperience) {
    return <p data-resume-placeholder className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No experience added yet.</p>;
  }
  const shown = content.experience.filter((exp) => !exp.hidden);
  if (shown.length === 0 && !edits?.onAddExperience) {
    return <p data-resume-placeholder className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">Every role is hidden.</p>;
  }
  return (
    <div className="flex flex-col gap-[var(--r-gap)]">
      {shown.map((exp) => (
        // `data-resume-entry` is what the AI tools' pick mode reads a clicked role by (PagePicker).
        // `group/entry`: hovering a role shows its lines' eyes on the apply wizard's paper (highlight.tsx).
        <div key={exp.id} data-resume-entry={exp.id} className="group/entry relative">
          <EntryFrame entryId={exp.id} />
          <EntryHeader primary={exp.role} secondary={exp.company} dates={exp.dates} location={exp.location} locationBelow design={design}
            onPrimaryChange={edits?.onExperienceField ? text=>edits.onExperienceField!(exp.id,"role",text) : undefined}
            onSecondaryChange={edits?.onExperienceField ? text=>edits.onExperienceField!(exp.id,"company",text) : undefined}
            onDatesChange={edits?.onExperienceField ? text=>edits.onExperienceField!(exp.id,"dates",text) : undefined} />
          <EntryBullets items={exp.bullets} design={design} entryId={exp.id} />
          {edits?.onAddBullet && <div data-resume-highlight className="mt-1 text-sm print:hidden"><EditableLine text="" label="Add a bullet" onCommit={text=>{if(text.trim()) edits.onAddBullet!(exp.id,text);}} /></div>}
        </div>
      ))}
      {edits?.onAddExperience && <AddExperience onSave={edits.onAddExperience} />}
    </div>
  );
};

export default ExperienceSection;
