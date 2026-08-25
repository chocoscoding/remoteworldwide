"use client";

import type { FC } from "react";
import { StepperSlider } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import { BASE_PT_STEPS, OFFSET_PT_STEPS } from "@/app/lib/dashboard/resume/design-defaults";

const formatBase = (pt: number) => `${pt}pt`;
const formatOffset = (pt: number) => `+${pt}pt`;

const FontSizePanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { fontSize } = design;

  return (
    <div className="flex flex-col gap-5">
      <StepperSlider
        label="Base Font Size"
        steps={BASE_PT_STEPS}
        value={fontSize.basePt}
        format={formatBase}
        onChange={(pt, opts) => dispatch({ type: "fontSize/setBase", pt, transient: opts?.transient })}
      />
      <StepperSlider
        label="Full Name"
        steps={OFFSET_PT_STEPS}
        value={fontSize.nameOffPt}
        format={formatOffset}
        onChange={(pt, opts) => dispatch({ type: "fontSize/setOffset", key: "name", pt, transient: opts?.transient })}
      />
      <StepperSlider
        label="Professional Title"
        steps={OFFSET_PT_STEPS}
        value={fontSize.titleOffPt}
        format={formatOffset}
        onChange={(pt, opts) => dispatch({ type: "fontSize/setOffset", key: "title", pt, transient: opts?.transient })}
      />
      <StepperSlider
        label="Section Headings"
        steps={OFFSET_PT_STEPS}
        value={fontSize.headingOffPt}
        format={formatOffset}
        onChange={(pt, opts) => dispatch({ type: "fontSize/setOffset", key: "heading", pt, transient: opts?.transient })}
      />
      <StepperSlider
        label="Entry Header"
        steps={OFFSET_PT_STEPS}
        value={fontSize.entryHeaderOffPt}
        format={formatOffset}
        onChange={(pt, opts) =>
          dispatch({ type: "fontSize/setOffset", key: "entryHeader", pt, transient: opts?.transient })
        }
      />
    </div>
  );
};

export default FontSizePanel;
