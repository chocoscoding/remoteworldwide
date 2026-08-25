import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { CapsMode, ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import { HEADING_STYLES } from "@/app/lib/dashboard/resume/heading-styles";
import { SECTION_ICONS } from "./section-icons";

export interface SectionHeadingProps {
  config: SectionConfig;
  design: ResumeDesign;
}

// Caps transform is a closed 2-value map, never computed at render time —
// `text-transform: capitalize` cannot un-shout an already-uppercase string,
// which is exactly why `SectionConfig.label` is stored in Title Case and this
// class does the transform instead. Same house pattern as heading-styles.ts.
const CAPS_CLASS: Record<CapsMode, string> = {
  capitalize: "capitalize",
  uppercase: "uppercase",
};

/**
 * Renders one section's heading: looks up `HEADING_STYLES[design.headings.style]`
 * for the label classes + rule placement (spec record, not an if-chain — see
 * heading-styles.ts), applies the caps transform on top (an independent
 * control), and mounts the per-section-kind icon from `SECTION_ICONS` when
 * `design.headings.icons !== "none"`. "outline" is the icon's default lucide
 * stroke rendering; "filled" is the same glyph with `fill="currentColor"`.
 *
 * `spec.labelClass` is already complete and self-contained (e.g. "boxed"
 * bakes its own border/padding into the label element), so this component
 * never special-cases `spec.box` — it only branches on `spec.rule`, which
 * decides where the separate rule element goes relative to the label.
 */
const SectionHeading: FC<SectionHeadingProps> = ({ config, design }) => {
  const spec = HEADING_STYLES[design.headings.style];
  const Icon = SECTION_ICONS[config.kind];
  const showIcon = design.headings.icons !== "none" && Icon !== undefined;

  const icon = showIcon ? (
    <Icon
      aria-hidden
      className="h-[var(--r-fs-heading)] w-[var(--r-fs-heading)] flex-none text-[color:var(--r-c-heading)]"
      fill={design.headings.icons === "filled" ? "currentColor" : "none"}
    />
  ) : null;

  const label = <span className={cn(spec.labelClass, CAPS_CLASS[design.headings.caps])}>{config.label}</span>;

  if (spec.rule === "right") {
    return (
      <div className="flex items-center gap-[6pt]">
        {icon}
        {label}
        {spec.ruleClass && <span aria-hidden className={spec.ruleClass} />}
      </div>
    );
  }

  return (
    <div>
      {spec.rule === "over" && spec.ruleClass && <div aria-hidden className={spec.ruleClass} />}
      <div className="flex items-center gap-[6pt]">
        {icon}
        {label}
      </div>
      {spec.rule === "under" && spec.ruleClass && <div aria-hidden className={spec.ruleClass} />}
    </div>
  );
};

export default SectionHeading;
