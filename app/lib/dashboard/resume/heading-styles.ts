// The 8 section-heading styles, as a SPEC RECORD rather than an if-chain.
//
// House pattern (see ProgressBar's WIDTH_CLASSES / StickerButton's shadow map):
// a closed enum maps to a record of static Tailwind literals. Every class below
// is written out in full so Tailwind's build-time scanner emits it — nothing is
// assembled with a template string at runtime.
//
// Because it's a record, SectionHeading has exactly ONE code path: read the
// spec, render the label with `labelClass`, and render a rule element before /
// after / beside it according to `rule`. Adding a 9th style is a data change.
//
// The classes reference `var(--r-c-heading)` and `var(--r-c-heading-rule)`,
// which `designToCssVars` has already resolved against the "Apply Accent Color"
// checkboxes — so nothing here needs to know about accents.
//
// NOTE: capitalization is NOT baked in. `headings.caps` is an independent
// control, so the consumer adds `uppercase` / `capitalize` on top of these.

import type { HeadingStyleId } from "./design-types";

/** Where the separate rule element sits relative to the label. */
export type HeadingRulePlacement = "none" | "under" | "over" | "right";

export interface HeadingStyleSpec {
  id: HeadingStyleId;
  /** Caption under the thumbnail in the Headings panel. */
  label: string;
  rule: HeadingRulePlacement;
  /** True when the label itself is wrapped in a bordered/filled box. */
  box: boolean;
  /** Complete, self-contained classes for the label element. */
  labelClass: string;
  /** Classes for the rule element. Empty string when `rule` is "none". */
  ruleClass: string;
}

/**
 * The run every `labelClass` opens with. Exported for the panel thumbnails,
 * but note it is also spelled out inside each entry rather than concatenated —
 * Tailwind's scanner has to see whole class names in the source.
 */
export const HEADING_LABEL_BASE_CLASS =
  "text-[length:var(--r-fs-heading)] font-bold leading-tight text-[color:var(--r-c-heading)]";

export const HEADING_STYLES: Record<HeadingStyleId, HeadingStyleSpec> = {
  "accent-underline": {
    id: "accent-underline",
    label: "Accent underline",
    rule: "under",
    box: false,
    labelClass:
      "text-[length:var(--r-fs-heading)] font-bold leading-tight text-[color:var(--r-c-heading)] tracking-[0.06em]",
    ruleClass: "mt-[2pt] h-[2pt] w-[28pt] rounded-full bg-[color:var(--r-c-heading-rule)]",
  },
  boxed: {
    id: "boxed",
    label: "Boxed",
    rule: "none",
    box: true,
    labelClass:
      "text-[length:var(--r-fs-heading)] font-bold leading-tight text-[color:var(--r-c-heading)] tracking-[0.06em] inline-block border border-[color:var(--r-c-heading-rule)] px-[6pt] py-[2pt]",
    ruleClass: "",
  },
  plain: {
    id: "plain",
    label: "Plain",
    rule: "none",
    box: false,
    labelClass:
      "text-[length:var(--r-fs-heading)] font-bold leading-tight text-[color:var(--r-c-heading)] tracking-[0.04em]",
    ruleClass: "",
  },
  "full-rule": {
    id: "full-rule",
    label: "Full rule",
    rule: "under",
    box: false,
    labelClass:
      "text-[length:var(--r-fs-heading)] font-bold leading-tight text-[color:var(--r-c-heading)] tracking-[0.06em]",
    ruleClass: "mt-[2pt] h-px w-full bg-[color:var(--r-c-heading-rule)]",
  },
  "small-caps": {
    id: "small-caps",
    label: "Small caps",
    rule: "none",
    box: false,
    labelClass:
      "text-[length:var(--r-fs-heading)] font-bold leading-tight text-[color:var(--r-c-heading)] tracking-[0.12em] [font-variant:small-caps]",
    ruleClass: "",
  },
  "rule-right": {
    id: "rule-right",
    label: "Rule right",
    rule: "right",
    box: false,
    labelClass:
      "text-[length:var(--r-fs-heading)] font-bold leading-tight text-[color:var(--r-c-heading)] tracking-[0.06em] shrink-0",
    ruleClass: "ml-[6pt] h-px flex-1 bg-[color:var(--r-c-heading-rule)]",
  },
  wavy: {
    id: "wavy",
    label: "Wavy",
    rule: "none",
    box: false,
    labelClass:
      "text-[length:var(--r-fs-heading)] font-bold leading-tight text-[color:var(--r-c-heading)] tracking-[0.04em] underline decoration-wavy decoration-[color:var(--r-c-heading-rule)] underline-offset-4",
    ruleClass: "",
  },
  "over-rule": {
    id: "over-rule",
    label: "Rule above",
    rule: "over",
    box: false,
    labelClass:
      "text-[length:var(--r-fs-heading)] font-bold leading-tight text-[color:var(--r-c-heading)] tracking-[0.06em]",
    ruleClass: "mb-[2pt] h-px w-full bg-[color:var(--r-c-heading-rule)]",
  },
};

/** Thumbnail order for the Headings panel's 8-up grid. */
export const HEADING_STYLE_OPTIONS: HeadingStyleSpec[] = Object.values(HEADING_STYLES);
