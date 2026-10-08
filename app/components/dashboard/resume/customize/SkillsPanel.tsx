"use client";

import type { FC } from "react";
import { SegmentedControl, type SegmentedControlOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
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
 * How the Skills entries print, plain skills and sub skills alike: a skill with
 * sub skills is its underlined name over them, and a run of plain skills is one
 * list without a name. Either is on one line, in rows and columns (filled
 * across, as many columns as fit), or in bubbles. The separator goes between
 * skills on a line, and before (or, for commas, after) each skill in the grid;
 * bubbles need none, so it rests while they are chosen.
 */
const SkillsPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Skills layout"
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
