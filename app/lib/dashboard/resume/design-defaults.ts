// `DEFAULT_DESIGN` — the "basic corporate" base look every template diffs
// against — plus the default section order and the discrete slider step tables.

import type { ResumeDesign, SectionConfig, SectionKind, SectionSeed } from "./design-types";

// ---------------------------------------------------------------------------
// The base template — "basic corporate"
// ---------------------------------------------------------------------------

/**
 * Body Source Sans 3 at 11pt / 1.3; 14mm side and 16mm top-bottom margins;
 * name at +8pt, professional title at +3.5pt directly beneath it; UPPERCASE
 * section headings at +1pt with a full-width rule under them; role in bold
 * caps with the company italic on the same line and the date range right-
 * aligned; indented round bullets. Accent is near-black and applies only to
 * the name, title, headings and heading rules.
 *
 * Every template's `design` is a DeepPartial merged over this object, so any
 * knob a template doesn't mention keeps the value below.
 */
export const DEFAULT_DESIGN: ResumeDesign = {
  chrome: "plain",
  doc: {
    language: "en-us",
    dateFormat: "mm-yyyy",
    pageFormat: "letter",
  },
  layout: {
    columns: "one",
    sideWidthPct: 32,
  },
  fontSize: {
    basePt: 11,
    nameOffPt: 8,
    titleOffPt: 3.5,
    headingOffPt: 1,
    entryHeaderOffPt: 0,
  },
  spacing: {
    lineHeight: 1.3,
    elementGapPt: 8,
    marginXmm: 6,
    marginYmm: 6,
  },
  entries: {
    structure: "full-width",
    datePosition: "right",
    subtitle: "same-line",
    showDates: true,
    showLocation: true,
    bulletGlyph: "dot",
    indentBullets: true,
  },
  headings: {
    style: "full-rule",
    caps: "uppercase",
    icons: "none",
  },
  font: {
    body: "source-sans-3",
    name: "source-sans-3",
  },
  colors: {
    mode: "single",
    // "full" is FlowCV's default selection. With chrome "plain" + one column it
    // has no visible effect; it only starts to matter once a template with a
    // sidebar or header band is applied.
    area: "full",
    accent: "#222325",
    accent2: "#3a4a7a",
    accent3: "#2f5d50",
    text: "#222325",
    textMuted: "#5f6165",
    rule: "#c9cbcf",
    pageBg: "#ffffff",
    apply: {
      name: true,
      jobTitle: true,
      headings: true,
      headingsLine: true,
      headerIcons: false,
      bullets: false,
      dates: false,
      entrySubtitle: false,
      linkIcons: false,
    },
  },
  header: {
    align: "left",
    arrange: "stack",
    separator: "icon",
    iconSet: "line",
  },
  photo: {
    show: false,
    shape: "circle",
    sizeMm: 28,
    position: "left",
  },
  links: {
    show: true,
    style: "both",
    underline: false,
  },
  footer: {
    show: false,
    text: "",
    showPageNumbers: false,
  },
};

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * Fallback heading text per kind. Stored in Title Case, never pre-uppercased:
 * `headings.caps` does the transform in CSS, and `text-transform: capitalize`
 * cannot turn "WORK EXPERIENCE" back into "Work Experience".
 */
export const DEFAULT_SECTION_LABELS: Record<SectionKind, string> = {
  personal: "Personal Details",
  summary: "Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  training: "Certifications & Training",
  projects: "Projects",
  custom: "Custom Section",
  "page-break": "Page Break",
};

/**
 * Personal Details is locked and first — it is rendered outside dnd-kit's
 * SortableContext, so nothing can drag above or past it.
 */
export const DEFAULT_SECTIONS: SectionConfig[] = [
  {
    id: "sec-personal",
    kind: "personal",
    label: DEFAULT_SECTION_LABELS.personal,
    visible: true,
    column: "main",
    locked: true,
  },
  { id: "sec-summary", kind: "summary", label: DEFAULT_SECTION_LABELS.summary, visible: true, column: "main" },
  { id: "sec-experience", kind: "experience", label: DEFAULT_SECTION_LABELS.experience, visible: true, column: "main" },
  { id: "sec-education", kind: "education", label: DEFAULT_SECTION_LABELS.education, visible: true, column: "main" },
  { id: "sec-skills", kind: "skills", label: DEFAULT_SECTION_LABELS.skills, visible: true, column: "side" },
  { id: "sec-training", kind: "training", label: DEFAULT_SECTION_LABELS.training, visible: true, column: "side" },
  { id: "sec-projects", kind: "projects", label: DEFAULT_SECTION_LABELS.projects, visible: true, column: "main" },
];

/**
 * Materialises a template's `SectionSeed[]` into `SectionConfig[]`.
 *
 * Ids are derived from `kind` + ordinal, so they are STABLE and DETERMINISTIC —
 * no `Math.random()` / `Date.now()`, which `react-hooks/purity` forbids in the
 * reducer path this runs on, and which would also break dnd-kit keys across
 * re-renders.
 */
export function sectionsFromSeeds(seeds: SectionSeed[]): SectionConfig[] {
  const seen: Record<string, number> = {};
  return seeds.map((seed) => {
    const n = (seen[seed.kind] ?? 0) + 1;
    seen[seed.kind] = n;
    return {
      id: n === 1 ? `sec-${seed.kind}` : `sec-${seed.kind}-${n}`,
      kind: seed.kind,
      label: seed.label ?? DEFAULT_SECTION_LABELS[seed.kind],
      visible: seed.visible ?? true,
      column: seed.column ?? "main",
      ...(seed.locked ? { locked: true } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Step tables
// ---------------------------------------------------------------------------
//
// The Customize sliders are DISCRETE and driven by -/+ buttons, so the allowed
// values live here rather than being computed as `min + i * step` — floating
// point makes 1.0 + 0.1 * 3 land on 1.3000000000000003, which would then miss
// an equality check in the reducer and re-render forever. Written out as exact
// literals for that reason.

/** Base body size, pt. `DEFAULT_DESIGN.fontSize.basePt` (11) is index 6. */
export const BASE_PT_STEPS: number[] = [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14];

/** Offsets added to `basePt` for name / title / heading / entry header, pt. */
export const OFFSET_PT_STEPS: number[] = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** Unitless line-height multiplier. */
export const LINE_HEIGHT_STEPS: number[] = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2];

/** Vertical space between elements, pt. */
export const ELEMENT_GAP_STEPS: number[] = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

/** Page margins, mm. Shared by the X and Y margin sliders. */
export const MARGIN_MM_STEPS: number[] = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

/** Side-column width, % of the paper. Matches the 28–40 range in ResumeDesign. */
export const SIDE_WIDTH_PCT_STEPS: number[] = [28, 30, 32, 34, 36, 38, 40];

/** Header photo diameter/edge, mm. */
export const PHOTO_SIZE_MM_STEPS: number[] = [18, 22, 26, 28, 32, 36, 40];

/**
 * Snaps an arbitrary number to the nearest allowed step. Used by the steppers
 * so a value restored from a template (or an out-of-range one) can never leave
 * the slider sitting between two notches.
 */
export function snapToStep(value: number, steps: number[]): number {
  let best = steps[0];
  let bestDelta = Math.abs(value - best);
  for (const step of steps) {
    const delta = Math.abs(value - step);
    if (delta < bestDelta) {
      best = step;
      bestDelta = delta;
    }
  }
  return best;
}

/** Moves `value` `direction` notches along `steps`, clamped at both ends. */
export function stepBy(value: number, steps: number[], direction: 1 | -1): number {
  const current = steps.indexOf(snapToStep(value, steps));
  const next = Math.min(steps.length - 1, Math.max(0, current + direction));
  return steps[next];
}
