"use client";

import type { FC } from "react";
import { SegmentedControl, type SegmentedControlOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import { isGrouped } from "@/app/lib/resume/skills";
import type { SkillGroupLayout, SkillSeparator } from "@/app/lib/dashboard/resume/design-types";

const LAYOUT_OPTIONS: SegmentedControlOption<SkillGroupLayout>[] = [
  { id: "line", label: "One line" },
  { id: "grid", label: "Grid" },
  { id: "bubbles", label: "Bubbles" },
];

const SEPARATOR_OPTIONS: SegmentedControlOption<SkillSeparator>[] = [
  { id: "bullet", label: "Bullets" },
  { id: "comma", label: "Commas" },
  { id: "star", label: "Stars" },
];

/**
 * How skills split into sub skills print: each group's underlined title with
 * its skills on one line, over rows and columns of them (filled across, as
 * many columns as fit), or over bubbles. The separator goes between skills on
 * a line, and before (or, for commas, after) each skill in the grid; bubbles
 * need none, so it rests while they are chosen.
 *
 * A single plain list keeps its pills, so on a resume whose skills are "All"
 * the choices are kept for later and the panel says where to switch.
 */
const SkillsPanel: FC = () => {
  const { design, content, dispatch } = useResumeDesign();
  const grouped = isGrouped(content);

  return (
    <div className="flex flex-col gap-5">
      {!grouped && (
        <p className="rounded-lg bg-[#f6f6f6] px-3 py-2 text-[11px] leading-snug text-black/55">
          These apply when your skills are split into sub skills. Switch in Content, under Skills.
        </p>
      )}
      <SegmentedControl
        label="Sub skill layout"
        options={LAYOUT_OPTIONS}
        value={design.skills.groupLayout}
        onChange={(layout) => dispatch({ type: "skills/setGroupLayout", layout })}
      />
      <SegmentedControl
        label="Separator"
        options={SEPARATOR_OPTIONS}
        value={design.skills.separator}
        disabled={design.skills.groupLayout === "bubbles"}
        onChange={(separator) => dispatch({ type: "skills/setSeparator", separator })}
      />
    </div>
  );
};

export default SkillsPanel;
