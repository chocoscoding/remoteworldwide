"use client";

import type { FC } from "react";
import { CollapsibleGroup, SegmentedControl, ToggleRow, type SegmentedControlOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import type { BulletGlyph, DatePosition, EntryStructure, SubtitlePlace } from "@/app/lib/dashboard/resume/design-types";

const STRUCTURE_OPTIONS: SegmentedControlOption<EntryStructure>[] = [
  { id: "full-width", label: "Full Width" },
  { id: "columns", label: "Columns" },
];

const DATE_POSITION_OPTIONS: SegmentedControlOption<DatePosition>[] = [
  { id: "right", label: "Right" },
  { id: "left", label: "Left" },
  { id: "split", label: "Split" },
];

const SUBTITLE_OPTIONS: SegmentedControlOption<SubtitlePlace>[] = [
  { id: "same-line", label: "Same Line" },
  { id: "below", label: "Below Title" },
];

const BULLET_GLYPH_OPTIONS: SegmentedControlOption<BulletGlyph>[] = [
  { id: "dot", label: "Dot" },
  { id: "dash", label: "Dash" },
  { id: "square", label: "Square" },
  { id: "none", label: "None" },
];

const EntriesPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { entries } = design;

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Structure"
        options={STRUCTURE_OPTIONS}
        value={entries.structure}
        onChange={(structure) => dispatch({ type: "entries/setStructure", structure })}
      />
      <SegmentedControl
        label="Date & Location Position"
        options={DATE_POSITION_OPTIONS}
        value={entries.datePosition}
        onChange={(position) => dispatch({ type: "entries/setDatePosition", position })}
      />
      <SegmentedControl
        label="Subtitle Placement"
        options={SUBTITLE_OPTIONS}
        value={entries.subtitle}
        onChange={(place) => dispatch({ type: "entries/setSubtitle", place })}
      />

      <CollapsibleGroup title="Advanced settings">
        <div className="flex flex-col gap-4">
          <ToggleRow
            label="Show Dates"
            checked={entries.showDates}
            onCheckedChange={() => dispatch({ type: "entries/toggleDates" })}
          />
          <ToggleRow
            label="Show Location"
            checked={entries.showLocation}
            onCheckedChange={() => dispatch({ type: "entries/toggleLocation" })}
          />
          <SegmentedControl
            label="Bullet Style"
            options={BULLET_GLYPH_OPTIONS}
            value={entries.bulletGlyph}
            onChange={(glyph) => dispatch({ type: "entries/setBulletGlyph", glyph })}
          />
          <ToggleRow
            label="Indent Bullets"
            checked={entries.indentBullets}
            onCheckedChange={() => dispatch({ type: "entries/toggleIndentBullets" })}
          />
        </div>
      </CollapsibleGroup>
    </div>
  );
};

export default EntriesPanel;
