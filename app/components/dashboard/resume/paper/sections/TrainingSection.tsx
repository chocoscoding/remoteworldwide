import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";
import EntryHeader from "../EntryHeader";

export interface TrainingSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

/**
 * "training" is the SECTION KIND's name (`DEFAULT_SECTION_LABELS.training`,
 * `SectionConfig.kind`), but there is no `content.training` field anywhere —
 * a real naming mismatch between the section-kind vocabulary
 * (design-types.ts) and the content model (types.ts). `ResumeContent` models
 * this data as `certifications: ResumeCertEntry[]`, so that's what this
 * section reads. Flagged here rather than left as a silent bug; see the
 * chunk A2 report.
 */
const TrainingSection: FC<TrainingSectionProps> = ({ content, design }) => {
  if (content.certifications.length === 0) {
    return <p className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No certifications added yet.</p>;
  }
  return (
    <div className="flex flex-col gap-[var(--r-gap)]">
      {content.certifications.map((cert) => (
        <EntryHeader key={cert.id} primary={cert.name} secondary={cert.issuer ?? ""} dates={cert.year} design={design} />
      ))}
    </div>
  );
};

export default TrainingSection;
