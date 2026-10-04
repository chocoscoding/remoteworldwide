import { Fragment, type FC } from "react";
import type { ResumeContent, ResumeSkillGroup } from "@/app/lib/dashboard/types";
import type { ResumeDesign, SkillSeparator } from "@/app/lib/dashboard/resume/design-types";
import { isGrouped, printableGroups, SKILL_SEPARATOR_GLYPH } from "@/app/lib/resume/skills";
import { SkillText } from "../highlight";

export interface SkillsSectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

const PLACEHOLDER = (
  <p data-resume-placeholder className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">
    No skills added yet.
  </p>
);

/** A bullet or a star between skills, set a little smaller and quieter than the words. */
const Mark: FC<{ separator: SkillSeparator }> = ({ separator }) => (
  <span aria-hidden className="mx-[4pt] inline-block text-[0.75em] text-[color:var(--r-text-muted)]">
    {SKILL_SEPARATOR_GLYPH[separator]}
  </span>
);

/** "Frontend: React, TypeScript, Next.js" — the title, then every skill on the one line it wraps from. */
const GroupLine: FC<{ group: ResumeSkillGroup; separator: SkillSeparator }> = ({ group, separator }) => (
  <p className="leading-[var(--r-lh)]">
    {group.title && <span className="font-semibold">{group.title}: </span>}
    {group.skills.map((skill, i) => (
      <Fragment key={`${i}-${skill}`}>
        {i > 0 && (separator === "comma" ? ", " : <Mark separator={separator} />)}
        <SkillText skill={skill} />
      </Fragment>
    ))}
  </p>
);

/**
 * The title, then its skills one under another in columns: a column takes up
 * to 500px of them and the next one starts beside it, so a long group grows
 * sideways instead of down the page. A skill wraps inside its column rather
 * than stretching it (and the Content form caps how long one can be).
 *
 * A column-direction flex box that wraps at `max-height` is what does it — no
 * measuring, so the server's print page lays it out exactly as the editor does.
 */
const GroupGrid: FC<{ group: ResumeSkillGroup; separator: SkillSeparator }> = ({ group, separator }) => (
  <div className="flex flex-col gap-[2pt]">
    {group.title && <p className="font-semibold leading-[var(--r-lh)]">{group.title}</p>}
    <ul className="flex max-h-[500px] flex-col flex-wrap content-start gap-x-[14pt] gap-y-[1pt]">
      {group.skills.map((skill, i) => (
        <li key={`${i}-${skill}`} className="flex max-w-[60mm] items-baseline leading-[var(--r-lh)] [overflow-wrap:anywhere]">
          {separator !== "comma" && (
            <span aria-hidden className="mr-[4pt] flex-none text-[0.75em] text-[color:var(--r-text-muted)]">
              {SKILL_SEPARATOR_GLYPH[separator]}
            </span>
          )}
          <span>
            <SkillText skill={skill} />
            {separator === "comma" && i < group.skills.length - 1 ? "," : ""}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

/**
 * Skills as one list ("All") print as pills. Split into sub skills, each group
 * prints the way the Customize Skills panel says: on one line, or as a grid.
 *
 * Pill color deliberately uses `current` (border-current/25, bg-current/10)
 * rather than a `--r-*` var: `currentColor` already resolves to whatever text
 * color is ambient at this point in the tree (`--r-text` in the main column,
 * `--r-side-fg` inside a filled sidebar), so the pill adapts to either
 * context automatically instead of needing its own color decision.
 */
const SkillsSection: FC<SkillsSectionProps> = ({ content, design }) => {
  if (isGrouped(content)) {
    const groups = printableGroups(content.skillGroups);
    if (groups.length === 0) return PLACEHOLDER;
    const { groupLayout, separator } = design.skills;
    return (
      <div className="flex flex-col gap-[var(--r-gap-half)] text-[length:var(--r-fs-small)]">
        {groups.map((group) =>
          groupLayout === "grid" ? (
            <GroupGrid key={group.id} group={group} separator={separator} />
          ) : (
            <GroupLine key={group.id} group={group} separator={separator} />
          ),
        )}
      </div>
    );
  }

  if (content.skills.length === 0) return PLACEHOLDER;
  return (
    <div className="flex flex-wrap gap-[6pt]">
      {content.skills.map((skill) => (
        <span
          key={skill}
          className="rounded-full border border-current/25 bg-current/10 px-[8pt] py-[2pt] text-[length:var(--r-fs-small)] leading-tight">
          <SkillText skill={skill} />
        </span>
      ))}
    </div>
  );
};

export default SkillsSection;
