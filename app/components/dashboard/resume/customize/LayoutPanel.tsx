"use client";

import type { FC } from "react";
import { StepperSlider, ThumbnailPicker, type ThumbnailOption } from "../controls";
import SectionOrderList from "./SectionOrderList";
import { useResumeDesign } from "../useResumeDesign";
import { SIDE_WIDTH_PCT_STEPS } from "@/app/lib/dashboard/resume/design-defaults";
import type { ColumnsMode } from "@/app/lib/dashboard/resume/design-types";

const COLUMNS_OPTIONS: ThumbnailOption<ColumnsMode>[] = [
  {
    id: "one",
    label: "One",
    preview: (
      <div className="flex h-12 gap-1 p-1.5">
        <div className="h-full w-full rounded bg-black/15" />
      </div>
    ),
  },
  {
    id: "two",
    label: "Two",
    preview: (
      <div className="flex h-12 gap-1 p-1.5">
        <div className="h-full flex-[2] rounded bg-black/15" />
        <div className="h-full flex-1 rounded bg-black/10" />
      </div>
    ),
  },
  {
    id: "mix",
    label: "Mix",
    preview: (
      <div className="flex h-12 flex-col gap-1 p-1.5">
        <div className="h-3 w-full flex-none rounded bg-black/15" />
        <div className="flex flex-1 gap-1">
          <div className="h-full flex-[2] rounded bg-black/15" />
          <div className="h-full flex-1 rounded bg-black/10" />
        </div>
      </div>
    ),
  },
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
      <ThumbnailPicker
        label="Columns"
        columns={3}
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
