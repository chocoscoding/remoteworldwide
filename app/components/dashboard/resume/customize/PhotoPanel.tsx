"use client";

import type { FC } from "react";
import { SegmentedControl, StepperSlider, ToggleRow, type SegmentedControlOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import { PHOTO_SIZE_MM_STEPS } from "@/app/lib/dashboard/resume/design-defaults";
import type { PhotoPosition, PhotoShape } from "@/app/lib/dashboard/resume/design-types";

const SHAPE_OPTIONS: SegmentedControlOption<PhotoShape>[] = [
  { id: "circle", label: "Circle" },
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
];

const POSITION_OPTIONS: SegmentedControlOption<PhotoPosition>[] = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "above", label: "Above" },
];

const formatMm = (v: number) => `${v}mm`;

const PhotoPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { photo } = design;
  const disabled = !photo.show;

  return (
    <div className="flex flex-col gap-5">
      <ToggleRow label="Show Photo" checked={photo.show} onCheckedChange={() => dispatch({ type: "photo/toggle" })} />
      <SegmentedControl
        label="Shape"
        options={SHAPE_OPTIONS}
        value={photo.shape}
        disabled={disabled}
        onChange={(shape) => dispatch({ type: "photo/setShape", shape })}
      />
      <StepperSlider
        label="Size"
        steps={PHOTO_SIZE_MM_STEPS}
        value={photo.sizeMm}
        format={formatMm}
        disabled={disabled}
        onChange={(mm, opts) => dispatch({ type: "photo/setSize", mm, transient: opts?.transient })}
      />
      <SegmentedControl
        label="Position"
        options={POSITION_OPTIONS}
        value={photo.position}
        disabled={disabled}
        onChange={(position) => dispatch({ type: "photo/setPosition", position })}
      />
    </div>
  );
};

export default PhotoPanel;
