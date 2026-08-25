import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign, SectionConfig, SectionKind } from "@/app/lib/dashboard/resume/design-types";
import SectionHeading from "./SectionHeading";
import {
  SummarySection,
  ExperienceSection,
  EducationSection,
  SkillsSection,
  TrainingSection,
  ProjectsSection,
  CustomSection,
} from "./sections";

export interface SectionRendererProps {
  items: SectionConfig[];
  content: ResumeContent;
  design: ResumeDesign;
}

/** Kinds this component actually dispatches a body for. */
type SectionBodyKind = Exclude<SectionKind, "personal" | "page-break">;

/**
 * Closed dispatch map, not a switch — every section component shares the
 * identical `{content, design}` prop shape (see each file under sections/)
 * specifically so this map can be a plain Record instead of a per-kind
 * branch. Adding a body for a new kind is a one-line addition here.
 */
const SECTION_BODY: Record<SectionBodyKind, FC<{ content: ResumeContent; design: ResumeDesign }>> = {
  summary: SummarySection,
  experience: ExperienceSection,
  education: EducationSection,
  skills: SkillsSection,
  training: TrainingSection,
  projects: ProjectsSection,
  custom: CustomSection,
};

/**
 * Renders one column band (main or side) — `<SectionHeading/>` plus the
 * matching body component from `sections/`, spaced by `--r-gap`.
 *
 * "page-break" gets a lightweight on-screen marker (dashed rule + centered
 * label) instead of a heading+body pair, plus a `break-after` class for
 * print — no real multi-page reflow, which is out of scope for the whole
 * feature, not just this chunk. "personal" is guarded defensively but should
 * never actually reach here: ResumePaper splits it off before `buildLayout`
 * runs, since it's pinned content rendered by HeaderBlock, not a column item.
 */
const SectionRenderer: FC<SectionRendererProps> = ({ items, content, design }) => (
  <div className="flex flex-col gap-[var(--r-gap)]">
    {items
      .filter((item) => item.visible)
      .map((item) => {
        if (item.kind === "personal") return null;

        if (item.kind === "page-break") {
          return (
            <div key={item.id} aria-hidden className="flex break-after-page items-center gap-[8pt]">
              <span className="h-0 flex-1 border-t border-dashed border-[color:var(--r-rule)]" />
              <span className="text-[length:var(--r-fs-small)] uppercase tracking-[0.08em] text-[color:var(--r-text-muted)]">
                Page break
              </span>
              <span className="h-0 flex-1 border-t border-dashed border-[color:var(--r-rule)]" />
            </div>
          );
        }

        const Body = SECTION_BODY[item.kind];
        return (
          <div key={item.id}>
            <SectionHeading config={item} design={design} />
            <div className="mt-[var(--r-gap-half)]">
              <Body content={content} design={design} />
            </div>
          </div>
        );
      })}
  </div>
);

export default SectionRenderer;
