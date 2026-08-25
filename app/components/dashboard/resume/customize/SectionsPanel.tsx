"use client";

import type { FC } from "react";
import { ToggleRow } from "../controls";
import { useResumeDesign } from "../useResumeDesign";

/** Per-section visibility. The locked "Personal Details" entry is excluded — it's always shown. */
const SectionsPanel: FC = () => {
  const { sections, dispatch } = useResumeDesign();
  const optional = sections.filter((s) => !s.locked);

  return (
    <div className="flex flex-col gap-3">
      {optional.map((section) => (
        <ToggleRow
          key={section.id}
          label={section.label}
          size="sm"
          checked={section.visible}
          onCheckedChange={() => dispatch({ type: "sections/toggle", id: section.id })}
        />
      ))}
      {optional.length === 0 && <p className="text-xs text-black/45">No optional sections yet.</p>}
    </div>
  );
};

export default SectionsPanel;
