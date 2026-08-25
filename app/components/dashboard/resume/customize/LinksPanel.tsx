"use client";

import type { FC } from "react";
import { SegmentedControl, ToggleRow, type SegmentedControlOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import type { LinkStyle } from "@/app/lib/dashboard/resume/design-types";

const STYLE_OPTIONS: SegmentedControlOption<LinkStyle>[] = [
  { id: "icon", label: "Icon" },
  { id: "text", label: "Text" },
  { id: "both", label: "Both" },
];

const LinksPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { links } = design;
  const disabled = !links.show;

  return (
    <div className="flex flex-col gap-5">
      <ToggleRow label="Show Links" checked={links.show} onCheckedChange={() => dispatch({ type: "links/toggle" })} />
      <SegmentedControl
        label="Style"
        options={STYLE_OPTIONS}
        value={links.style}
        disabled={disabled}
        onChange={(style) => dispatch({ type: "links/setStyle", style })}
      />
      <ToggleRow
        label="Underline"
        checked={links.underline}
        disabled={disabled}
        onCheckedChange={() => dispatch({ type: "links/toggleUnderline" })}
      />
    </div>
  );
};

export default LinksPanel;
