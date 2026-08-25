// The `ResumeDesign` shape — every knob the resume Customize panel can turn.
//
// Grouped BY CUSTOMIZE PANEL, so each panel component takes exactly one slice
// (`design.spacing`, `design.headings`, …) rather than reaching across the
// whole object. Types only — this module has zero runtime code.
//
// Unit convention (important): **numbers with implied units, never strings.**
// `basePt: 11`, not `"11pt"`. The font-size model is arithmetic (base + offset,
// FlowCV's "+8pt" semantics), so the values have to stay numeric.
// `designToCssVars()` is the single place that does the math and appends the
// unit. `pt`/`mm` are real CSS absolute units and are emitted literally — they
// are never converted to px in JS.

import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Closed enums — one per control that offers a fixed set of choices
// ---------------------------------------------------------------------------

export type ColumnsMode = "one" | "two" | "mix";

export type HeadingStyleId =
  | "accent-underline"
  | "boxed"
  | "plain"
  | "full-rule"
  | "small-caps"
  | "rule-right"
  | "wavy"
  | "over-rule";

export type CapsMode = "capitalize" | "uppercase";
export type IconMode = "none" | "outline" | "filled";
export type DatePosition = "right" | "left" | "split";
export type SubtitlePlace = "same-line" | "below";
export type EntryStructure = "full-width" | "columns";
export type HeaderArrange = "stack" | "inline" | "split";
export type SeparatorMode = "icon" | "bullet" | "bar";

export type IconSetId =
  | "line"
  | "solid"
  | "rounded"
  | "square"
  | "circle"
  | "mono"
  | "duotone";

export type ColorArea = "full" | "header" | "border";
export type ColorMode = "single" | "multi";
export type PageFormat = "a4" | "letter";
export type DateFormatId = "mm-yyyy" | "month-yyyy" | "mm-dd-yyyy";

export type BulletGlyph = "dot" | "dash" | "square" | "none";
export type PhotoShape = "circle" | "square" | "rounded";
export type PhotoPosition = "left" | "right" | "above";
export type LinkStyle = "icon" | "text" | "both";
export type TextAlign = "left" | "center";
export type ColumnSlot = "main" | "side";

/** Which slot of the type scale a `fontSize/setOffset` action targets. */
export type FontSizeOffsetKey = "name" | "title" | "heading" | "entryHeader";

/** The four flat colors that are NOT the accent — settable from the Colors panel. */
export type NeutralColorKey = "text" | "textMuted" | "rule" | "pageBg";

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

/**
 * The 12 shipped families. Kebab-case, and each id maps 1:1 to its CSS custom
 * property (`work-sans` -> `--r-f-work-sans`) — see `./fonts`.
 */
export type FontId =
  | "work-sans"
  | "jost"
  | "archivo"
  | "rubik"
  | "nunito"
  | "ibm-plex-sans"
  | "source-sans-3"
  | "open-sans"
  | "lato"
  | "titillium-web"
  | "source-serif-4"
  | "lora";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * The 6 gallery templates. The registry that fleshes these out (name, blurb,
 * design diff, section seed, chrome, live thumbnail) is owned by a later chunk
 * and lives outside this folder; only the id union is fixed here so the
 * reducer and the gallery agree on the keys.
 *
 * Intended chrome per id: atlas -> plain (the base "basic corporate" look),
 * meridian -> band-top, quarry -> sidebar-fill, beacon -> header-block,
 * linen -> rule-frame, cadence -> plain (two-column variant).
 */
export type ResumeTemplateId =
  | "atlas"
  | "meridian"
  | "quarry"
  | "beacon"
  | "linen"
  | "cadence";

// ---------------------------------------------------------------------------
// Accent targets — the 9 "Apply Accent Color" checkboxes
// ---------------------------------------------------------------------------

export type AccentTarget =
  | "name"
  | "jobTitle"
  | "headings"
  | "headingsLine"
  | "headerIcons"
  | "bullets"
  | "dates"
  | "entrySubtitle"
  | "linkIcons";

// ---------------------------------------------------------------------------
// The design object
// ---------------------------------------------------------------------------

export interface ResumeDesign {
  /**
   * The page-shell component `ResumePaper` renders with — seeded by whichever
   * template was last applied (`template/apply` folds `tpl.chrome` in
   * alongside the rest of its diff), otherwise just another persisted design
   * field: it survives undo/redo because it lives in the same snapshot as
   * everything else, and — unlike template *identity*, which is deliberately
   * never stored (see the comment above `lookupTemplate` in
   * `design-reducer.ts`) — remembering the chrome itself doesn't reintroduce
   * that bug, since nothing "re-applies" it later; it just sits here like
   * `layout.columns` does until something explicitly changes it. Independent
   * of `colors.area`: which chrome is active and which page region gets
   * colored have always been meant as two separate controls (see each chrome
   * component's own comment) — this field is what makes that independence
   * real instead of accidentally coupled to the Colors panel.
   */
  chrome: ChromeId;
  doc: {
    language: string;
    dateFormat: DateFormatId;
    pageFormat: PageFormat;
  };
  layout: {
    columns: ColumnsMode;
    /** Width of the side column as a percentage of the paper. 28–40. */
    sideWidthPct: number;
  };
  /**
   * `basePt` is absolute; every other value is an OFFSET in pt added to it
   * (FlowCV semantics — the panel literally shows "+8pt").
   */
  fontSize: {
    basePt: number;
    nameOffPt: number;
    titleOffPt: number;
    headingOffPt: number;
    entryHeaderOffPt: number;
  };
  spacing: {
    /** Unitless CSS line-height multiplier. */
    lineHeight: number;
    elementGapPt: number;
    marginXmm: number;
    marginYmm: number;
  };
  entries: {
    structure: EntryStructure;
    datePosition: DatePosition;
    subtitle: SubtitlePlace;
    showDates: boolean;
    showLocation: boolean;
    bulletGlyph: BulletGlyph;
    indentBullets: boolean;
  };
  headings: {
    style: HeadingStyleId;
    caps: CapsMode;
    icons: IconMode;
  };
  font: {
    body: FontId;
    name: FontId;
  };
  colors: {
    mode: ColorMode;
    area: ColorArea;
    accent: string;
    accent2: string;
    accent3: string;
    text: string;
    textMuted: string;
    rule: string;
    pageBg: string;
    apply: Record<AccentTarget, boolean>;
  };
  header: {
    align: TextAlign;
    arrange: HeaderArrange;
    separator: SeparatorMode;
    iconSet: IconSetId;
  };
  photo: {
    show: boolean;
    shape: PhotoShape;
    sizeMm: number;
    position: PhotoPosition;
  };
  links: {
    show: boolean;
    style: LinkStyle;
    underline: boolean;
  };
  footer: {
    show: boolean;
    text: string;
    showPageNumbers: boolean;
  };
}

/**
 * The return type of `designToCssVars()`. Widened from `CSSProperties` because
 * `@types/react` deliberately removed the index signature, so `--r-*` custom
 * properties are not otherwise assignable to a `style={}` prop.
 */
export type ResumeCssVars = CSSProperties & Record<`--r-${string}`, string | number>;

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export type SectionKind =
  | "personal"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "training"
  | "projects"
  | "custom"
  | "page-break";

export interface SectionConfig {
  /**
   * Stable unique id — the dnd-kit key. Deliberately NOT the kind, because
   * "page-break" and "custom" sections can repeat.
   */
  id: string;
  kind: SectionKind;
  /**
   * User-editable heading text. Stored in Title Case ("Work Experience"), not
   * pre-uppercased: `headings.caps` applies the transform in CSS, and
   * `text-transform: capitalize` cannot un-shout an already-uppercase string.
   */
  label: string;
  visible: boolean;
  /** Only meaningful when `layout.columns !== "one"`. */
  column: ColumnSlot;
  /** Personal Details — pinned to the top and rendered OUTSIDE SortableContext. */
  locked?: boolean;
}

/**
 * What a template declares. Everything but `kind` is optional and falls back to
 * the default for that kind — templates state only what differs.
 */
export interface SectionSeed {
  kind: SectionKind;
  label?: string;
  visible?: boolean;
  column?: ColumnSlot;
  locked?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursive `Partial`. Templates express their design as a diff against
 * `DEFAULT_DESIGN`, which `deepMerge` then folds in. Arrays are treated as
 * leaves (replaced wholesale), never merged element-wise.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

// ---------------------------------------------------------------------------
// Chrome (page-shell treatments) — owned by chunk A2 (app/components/.../paper)
// ---------------------------------------------------------------------------

/**
 * The 5 page-shell treatments a template can select. A closed union, never
 * per-template JSX — every template's chrome must be one of these 5 so it stays
 * responsive to the Customize panel instead of silently ignoring it.
 */
export type ChromeId = "plain" | "band-top" | "sidebar-fill" | "header-block" | "rule-frame";
