"use client";

import type { FC } from "react";
import { cn } from "@/lib/utils";
import { SegmentedControl, ThumbnailPicker, type SegmentedControlOption, type ThumbnailOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import { HEADING_STYLE_OPTIONS, type HeadingStyleSpec } from "@/app/lib/dashboard/resume/heading-styles";
import type { CapsMode, HeadingStyleId, IconMode } from "@/app/lib/dashboard/resume/design-types";

const CAPS_OPTIONS: SegmentedControlOption<CapsMode>[] = [
  { id: "capitalize", label: "Capitalize" },
  { id: "uppercase", label: "Uppercase" },
];

const ICON_MODE_OPTIONS: SegmentedControlOption<IconMode>[] = [
  { id: "none", label: "None" },
  { id: "outline", label: "Outline" },
  { id: "filled", label: "Filled" },
];

/**
 * `spec.labelClass` / `spec.ruleClass` read `var(--r-fs-heading)`,
 * `var(--r-c-heading)`, `var(--r-c-heading-rule)` — custom properties that
 * only exist inside `.resume-paper` (set once by `designToCssVars` on the
 * paper root). This thumbnail lives in the Customize rail, outside that
 * subtree, so the three vars are seeded LOCALLY with a static Tailwind
 * ARBITRARY-PROPERTY class (`[--r-fs-heading:13px]` etc. — a real Tailwind
 * v3.1+ feature, not `style={}`), scoped to this one preview only. That lets
 * the spec's own classes be reused verbatim and still render legibly, without
 * reaching outside this card or touching the paper's var scope.
 */
const HEADING_PREVIEW_VARS = "[--r-fs-heading:13px] [--r-c-heading:#222325] [--r-c-heading-rule:#9a9ca1]";

/**
 * Mirrors `SectionHeading.tsx`'s own rule-placement branching (right / over /
 * under / none) so the preview is a faithful miniature of the real render,
 * just without the section icon and using a fixed "Heading" caption.
 */
const HeadingStylePreview: FC<{ spec: HeadingStyleSpec }> = ({ spec }) => {
  const label = <span className={spec.labelClass}>Heading</span>;

  return (
    <div className={cn("flex h-14 w-full flex-col items-center justify-center gap-1 p-2", HEADING_PREVIEW_VARS)}>
      {spec.rule === "right" ? (
        <div className="flex w-full items-center justify-center gap-[6pt]">
          {label}
          {spec.ruleClass && <span aria-hidden className={spec.ruleClass} />}
        </div>
      ) : (
        <>
          {spec.rule === "over" && spec.ruleClass && <span aria-hidden className={spec.ruleClass} />}
          {label}
          {spec.rule === "under" && spec.ruleClass && <span aria-hidden className={spec.ruleClass} />}
        </>
      )}
    </div>
  );
};

const STYLE_OPTIONS: ThumbnailOption<HeadingStyleId>[] = HEADING_STYLE_OPTIONS.map((spec) => ({
  id: spec.id,
  label: spec.label,
  preview: <HeadingStylePreview spec={spec} />,
}));

const HeadingsPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { headings } = design;

  return (
    <div className="flex flex-col gap-5">
      <ThumbnailPicker
        label="Style"
        columns={2}
        options={STYLE_OPTIONS}
        value={headings.style}
        onChange={(id) => dispatch({ type: "headings/setStyle", id })}
      />
      <SegmentedControl
        label="Capitalization"
        options={CAPS_OPTIONS}
        value={headings.caps}
        onChange={(caps) => dispatch({ type: "headings/setCaps", caps })}
      />
      <SegmentedControl
        label="Icons"
        options={ICON_MODE_OPTIONS}
        value={headings.icons}
        onChange={(icons) => dispatch({ type: "headings/setIcons", icons })}
      />
    </div>
  );
};

export default HeadingsPanel;
