"use client";

import type { FC } from "react";
import { StepperSlider } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import { ELEMENT_GAP_STEPS, LINE_HEIGHT_STEPS, MARGIN_MM_STEPS } from "@/app/lib/dashboard/resume/design-defaults";

const formatLineHeight = (v: number) => v.toFixed(1);
const formatPt = (v: number) => `${v}pt`;
const formatMm = (v: number) => `${v}mm`;

const SpacingPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { spacing } = design;

  return (
    <div className="flex flex-col gap-5">
      <StepperSlider
        label="Line Height"
        steps={LINE_HEIGHT_STEPS}
        value={spacing.lineHeight}
        format={formatLineHeight}
        onChange={(value, opts) => dispatch({ type: "spacing/set", key: "lineHeight", value, transient: opts?.transient })}
      />
      <StepperSlider
        label="Space Between Elements"
        steps={ELEMENT_GAP_STEPS}
        value={spacing.elementGapPt}
        format={formatPt}
        onChange={(value, opts) =>
          dispatch({ type: "spacing/set", key: "elementGapPt", value, transient: opts?.transient })
        }
      />
      <StepperSlider
        label="Left & Right Margin"
        steps={MARGIN_MM_STEPS}
        value={spacing.marginXmm}
        format={formatMm}
        onChange={(value, opts) => dispatch({ type: "spacing/set", key: "marginXmm", value, transient: opts?.transient })}
      />
      <StepperSlider
        label="Top & Bottom Margin"
        steps={MARGIN_MM_STEPS}
        value={spacing.marginYmm}
        format={formatMm}
        onChange={(value, opts) => dispatch({ type: "spacing/set", key: "marginYmm", value, transient: opts?.transient })}
      />
    </div>
  );
};

export default SpacingPanel;
