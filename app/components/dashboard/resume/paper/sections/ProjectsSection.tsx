import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";
import { ICON_SETS } from "@/app/lib/dashboard/resume/icon-sets";
import EntryHeader from "../EntryHeader";

export interface ProjectsSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

/**
 * `ResumeProjectEntry` has no company/school-equivalent and no dates or
 * location, so EntryHeader is used in its degenerate form — primary = the
 * project name, secondary = "" (its secondary line collapses away). The
 * optional link isn't part of EntryHeader's contract (it has no link slot),
 * so it's rendered here as its own small line, reusing the active icon set's
 * `link` glyph for visual consistency with the header's own link icons.
 */
const ProjectsSection: FC<ProjectsSectionProps> = ({ content, design }) => {
  if (content.projects.length === 0) {
    return <p className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No projects added yet.</p>;
  }
  const LinkIcon = ICON_SETS[design.header.iconSet].link;
  return (
    <div className="flex flex-col gap-[var(--r-gap)]">
      {content.projects.map((proj) => (
        <div key={proj.id}>
          <EntryHeader primary={proj.name} secondary="" design={design} />
          {proj.detail && (
            <p className="mt-[2pt] text-[length:var(--r-fs-base)] leading-[var(--r-lh)] text-[color:var(--r-text)]">{proj.detail}</p>
          )}
          {proj.link && (
            <p className="mt-[2pt] flex items-center gap-[4pt] text-[length:var(--r-fs-small)] text-[color:var(--r-c-link-icon)]">
              <LinkIcon aria-hidden className="h-[1em] w-[1em] flex-none" />
              <span>{proj.link}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProjectsSection;
