import { Fragment, type CSSProperties, type FC } from "react";
import { cn } from "@/lib/utils";
import type { ResumeContent, ResumeSkillGroup } from "@/app/lib/dashboard/types";
import type { ResumeDesign, SkillSeparator } from "@/app/lib/dashboard/resume/design-types";
import { printableSkills, SKILL_SEPARATOR_GLYPH } from "@/app/lib/resume/skills";
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

/** A group's title, underlined (owner, 2026-10-04) in every layout. */
const TITLE_CLASS = "font-semibold underline decoration-[0.75pt] underline-offset-[2pt]";

/** A title on its own line, over the group's grid or bubbles. */
const GroupTitle: FC<{ title: string }> = ({ title }) => (title ? <p className={cn(TITLE_CLASS, "leading-[var(--r-lh)]")}>{title}</p> : null);

/** "Frontend: React, TypeScript, Next.js" — the title, then every skill on the one line it wraps from. */
const GroupLine: FC<{ group: ResumeSkillGroup; separator: SkillSeparator }> = ({ group, separator }) => (
  <p className="leading-[var(--r-lh)]">
    {group.title && (
      <>
        <span className={TITLE_CLASS}>{group.title}</span>
        <span className="font-semibold">: </span>
      </>
    )}
    {group.skills.map((skill, i) => (
      <Fragment key={`${i}-${skill}`}>
        {i > 0 && (separator === "comma" ? ", " : <Mark separator={separator} />)}
        <SkillText skill={skill} />
      </Fragment>
    ))}
  </p>
);

/**
 * How wide a grid column needs to be for this group: about as many characters
 * as nine in ten of its skills have, so a single long one wraps in its cell
 * instead of widening every column. Between 24mm and 60mm.
 */
function columnWidth(skills: string[]): string {
  const lengths = skills.map((skill) => skill.length).sort((a, b) => a - b);
  const typical = lengths[Math.floor(0.9 * (lengths.length - 1))] ?? 0;
  return `clamp(24mm, calc(${typical}ch + 12pt), 60mm)`;
}

/**
 * The title, then its skills in rows and columns, filled ACROSS (owner,
 * 2026-10-04): as many columns as the width holds, the next skill beside the
 * last, then the next row. Read left to right, each printed line is skills in
 * their own order, which is what an ATS reading the PDF line by line sees; a
 * list that ran down one column and then the next would interleave them.
 * Columns are as wide as the group's skills need (`columnWidth`), never wider
 * than the column the section sits in, and a long skill wraps in its cell.
 */
const GroupGrid: FC<{ group: ResumeSkillGroup; separator: SkillSeparator }> = ({ group, separator }) => (
  <div className="flex flex-col gap-[2pt]">
    <GroupTitle title={group.title} />
    <ul
      className="grid grid-cols-[repeat(auto-fill,minmax(min(var(--skill-col),100%),1fr))] gap-x-[12pt] gap-y-[1pt]"
      style={{ "--skill-col": columnWidth(group.skills) } as CSSProperties}>
      {group.skills.map((skill, i) => (
        <li key={`${i}-${skill}`} className="flex min-w-0 items-baseline leading-[var(--r-lh)] [overflow-wrap:anywhere]">
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

/** A skill's bubble, in the bubbles layout. */
const PILL_CLASS = "rounded-full border border-current/25 bg-current/10 px-[8pt] py-[2pt] text-[length:var(--r-fs-small)] leading-tight";

/** The title, then its skills as bubbles one after another, wrapping onto as many lines as they need. */
const GroupBubbles: FC<{ group: ResumeSkillGroup }> = ({ group }) => (
  <div className="flex flex-col gap-[3pt]">
    <GroupTitle title={group.title} />
    <div className="flex flex-wrap gap-[5pt]">
      {group.skills.map((skill, i) => (
        <span key={`${i}-${skill}`} className={PILL_CLASS}>
          <SkillText skill={skill} />
        </span>
      ))}
    </div>
  </div>
);

/**
 * The Skills entries (app/lib/resume/skills.ts), each printed the way the
 * Customize Skills panel says: on one line, as a grid, or as bubbles. An entry
 * with sub skills is its underlined name over them; a run of plain skills is one
 * list without a name, in the same layout.
 *
 * Bubble color deliberately uses `current` (border-current/25, bg-current/10)
 * rather than a `--r-*` var: `currentColor` already resolves to whatever text
 * color is ambient at this point in the tree (`--r-text` in the main column,
 * `--r-side-fg` inside a filled sidebar), so the bubble adapts to either
 * context automatically instead of needing its own color decision.
 */
const SkillsSection: FC<SkillsSectionProps> = ({ content, design }) => {
  const groups = printableSkills(content);
  if (groups.length === 0) return PLACEHOLDER;
  const { groupLayout, separator } = design.skills;
  return (
    <div className="flex flex-col gap-[var(--r-gap-half)] text-[length:var(--r-fs-small)]">
      {groups.map((group) =>
        groupLayout === "grid" ? (
          <GroupGrid key={group.id} group={group} separator={separator} />
        ) : groupLayout === "bubbles" ? (
          <GroupBubbles key={group.id} group={group} />
        ) : (
          <GroupLine key={group.id} group={group} separator={separator} />
        ),
      )}
    </div>
  );
};

export default SkillsSection;
