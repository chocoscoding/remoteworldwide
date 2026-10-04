"use client";

import type { FC } from "react";
import { Columns2, LayoutPanelTop, RectangleVertical } from "lucide-react";
import { SegmentedControl, StepperSlider, type SegmentedControlOption } from "../controls";
import SectionOrderList from "./SectionOrderList";
import { useResumeDesign } from "../useResumeDesign";
import { SIDE_WIDTH_PCT_STEPS } from "@/app/lib/dashboard/resume/design-defaults";
import type { ColumnsMode } from "@/app/lib/dashboard/resume/design-types";

/** A switch, not picture cards (owner, 2026-10-04): the icon says the shape, the paper beside it shows the rest. */
const COLUMNS_OPTIONS: SegmentedControlOption<ColumnsMode>[] = [
  { id: "one", label: "One", icon: RectangleVertical },
  { id: "two", label: "Two", icon: Columns2 },
  { id: "mix", label: "Mix", icon: LayoutPanelTop },
];

const formatPct = (v: number) => `${v}%`;

/**
 * Columns + the drag-reorderable section list. Also carries the side-column
 * width stepper (`layout/setSideWidth`, `SIDE_WIDTH_PCT_STEPS`) — a real,
 * already-wired reducer action with no other panel to live in, only shown
 * once a side column actually exists (`columns !== "one"`).
 */
const LayoutPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Columns"
        options={COLUMNS_OPTIONS}
        value={design.layout.columns}
        onChange={(columns) => dispatch({ type: "layout/setColumns", columns })}
      />

      {design.layout.columns !== "one" && (
        <StepperSlider
          label="Side Column Width"
          steps={SIDE_WIDTH_PCT_STEPS}
          value={design.layout.sideWidthPct}
          format={formatPct}
          onChange={(pct, opts) => dispatch({ type: "layout/setSideWidth", pct, transient: opts?.transient })}
        />
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-black/55">Change Section Layout</span>
        <SectionOrderList />
      </div>
    </div>
  );
};

export default LayoutPanel;
