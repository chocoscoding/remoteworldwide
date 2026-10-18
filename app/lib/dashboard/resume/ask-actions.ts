// What Ask may do in the resume editor besides rewriting text (owner, 2026-10-18: "within the
// confinement of Customize and AI tools"): open a tab or a Customize setting, point at a section,
// change a design setting, or start an AI tool or an ATS check.
//
// Mirrors `src/lib/askActions.ts` in the AI service, which already checked every action; this
// file checks again before anything runs, snaps numbers to the panel's own steps, and turns a
// design setting into the Customize panel's own reducer action. A tool or a check is started
// through its own button's handler, so its plan gate and its credit apply exactly as by hand.
//
// The AI service's contract test (`tests/contracts/frontend-types.test.ts`) keeps the lists here
// in step with its own.

import type { DesignAction } from "./design-reducer";
import type { FontId, HeadingStyleId, ResumeDesign, ResumeTemplateId } from "./design-types";
import {
  BASE_PT_STEPS,
  ELEMENT_GAP_STEPS,
  LINE_HEIGHT_STEPS,
  MARGIN_MM_STEPS,
  OFFSET_PT_STEPS,
  SIDE_WIDTH_PCT_STEPS,
} from "./design-defaults";

export const ASK_TABS = ["overview", "content", "customize", "ai"] as const;
export type AskTab = (typeof ASK_TABS)[number];

export const ASK_PANELS = [
  "templates",
  "layout",
  "font-size",
  "spacing",
  "entries",
  "skills",
  "headings",
  "font",
  "colors",
  "header",
  "photo",
  "links",
  "footer",
  "sections",
] as const;

export const ASK_TOOLS = ["tailor", "rewrite", "keywords", "quantify", "shorten", "tone"] as const;
export type AskTool = (typeof ASK_TOOLS)[number];

const TEMPLATES = ["atlas", "meridian", "quarry", "beacon", "linen", "cadence", "graphite", "harbor", "folio", "summit", "pulse"] as const satisfies readonly ResumeTemplateId[];

const FONTS = [
  "work-sans",
  "jost",
  "archivo",
  "rubik",
  "nunito",
  "ibm-plex-sans",
  "source-sans-3",
  "open-sans",
  "lato",
  "titillium-web",
  "source-serif-4",
  "lora",
] as const satisfies readonly FontId[];

const HEADING_STYLES = [
  "accent-underline",
  "boxed",
  "plain",
  "full-rule",
  "small-caps",
  "rule-right",
  "wavy",
  "over-rule",
] as const satisfies readonly HeadingStyleId[];

/** Every design setting Ask may change. Kept in step with the AI service's list by its contract test. */
export const ASK_DESIGN_SETTINGS = [
  "template",
  "columns",
  "sideWidthPct",
  "basePt",
  "nameSizePt",
  "titleSizePt",
  "headingSizePt",
  "entryHeaderSizePt",
  "lineHeight",
  "elementGapPt",
  "marginXmm",
  "marginYmm",
  "bodyFont",
  "nameFont",
  "accent",
  "headingStyle",
  "headingCaps",
  "bulletGlyph",
  "datePosition",
  "headerAlign",
] as const;
export type AskDesignSetting = (typeof ASK_DESIGN_SETTINGS)[number];

export type AskAction =
  | { do: "tab"; tab: AskTab }
  | { do: "panel"; panel: (typeof ASK_PANELS)[number] }
  | { do: "section"; section: string }
  | { do: "design"; set: AskDesignSetting; value: string | number }
  | { do: "tool"; tool: AskTool }
  | { do: "check"; against: "general" | "job" };

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : null;

/** The nearest step a panel's slider offers, or null for a value that is not a number. */
const snap = (steps: readonly number[], value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || steps.length === 0) return null;
  return steps.reduce((best, step) => (Math.abs(step - n) < Math.abs(best - n) ? step : best), steps[0]);
};

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The Customize panel's own reducer action for one design setting, or null when the value is not
 * one the control offers. Numbers are snapped to the slider's steps, as dragging it would.
 */
export function designActionFor(set: AskDesignSetting, value: string | number): DesignAction | null {
  const step = (steps: readonly number[]) => snap(steps, value);
  switch (set) {
    case "template": {
      const id = oneOf(TEMPLATES, value);
      return id ? { type: "template/apply", id } : null;
    }
    case "columns": {
      const columns = oneOf(["one", "two", "mix"] as const, value);
      return columns ? { type: "layout/setColumns", columns } : null;
    }
    case "sideWidthPct": {
      const pct = step(SIDE_WIDTH_PCT_STEPS);
      return pct === null ? null : { type: "layout/setSideWidth", pct };
    }
    case "basePt": {
      const pt = step(BASE_PT_STEPS);
      return pt === null ? null : { type: "fontSize/setBase", pt };
    }
    case "nameSizePt":
    case "titleSizePt":
    case "headingSizePt":
    case "entryHeaderSizePt": {
      const pt = step(OFFSET_PT_STEPS);
      const key = ({ nameSizePt: "name", titleSizePt: "title", headingSizePt: "heading", entryHeaderSizePt: "entryHeader" } as const)[set];
      return pt === null ? null : { type: "fontSize/setOffset", key, pt };
    }
    case "lineHeight":
    case "elementGapPt":
    case "marginXmm":
    case "marginYmm": {
      const steps = set === "lineHeight" ? LINE_HEIGHT_STEPS : set === "elementGapPt" ? ELEMENT_GAP_STEPS : MARGIN_MM_STEPS;
      const snapped = step(steps);
      return snapped === null ? null : { type: "spacing/set", key: set, value: snapped };
    }
    case "bodyFont":
    case "nameFont": {
      const id = oneOf(FONTS, value);
      return id ? { type: "font/set", slot: set === "bodyFont" ? "body" : "name", id } : null;
    }
    case "accent":
      return typeof value === "string" && HEX.test(value.trim()) ? { type: "colors/setAccent", hex: value.trim().toLowerCase() } : null;
    case "headingStyle": {
      const id = oneOf(HEADING_STYLES, value);
      return id ? { type: "headings/setStyle", id } : null;
    }
    case "headingCaps": {
      const caps = oneOf(["capitalize", "uppercase"] as const, value);
      return caps ? { type: "headings/setCaps", caps } : null;
    }
    case "bulletGlyph": {
      const glyph = oneOf(["dot", "dash", "square", "none"] as const, value);
      return glyph ? { type: "entries/setBulletGlyph", glyph } : null;
    }
    case "datePosition": {
      const position = oneOf(["right", "left", "split"] as const, value);
      return position ? { type: "entries/setDatePosition", position } : null;
    }
    case "headerAlign": {
      const align = oneOf(["left", "center"] as const, value);
      return align ? { type: "header/setAlign", align } : null;
    }
    default:
      return null;
  }
}

/** The Customize panel a design setting lives in, so Ask can open it beside the change. */
export const panelOf = (set: AskDesignSetting): (typeof ASK_PANELS)[number] =>
  set === "template"
    ? "templates"
    : set === "columns" || set === "sideWidthPct"
      ? "layout"
      : set.endsWith("Pt") && set !== "elementGapPt"
        ? "font-size"
        : set === "lineHeight" || set === "elementGapPt" || set === "marginXmm" || set === "marginYmm"
          ? "spacing"
          : set === "bodyFont" || set === "nameFont"
            ? "font"
            : set === "accent"
              ? "colors"
              : set === "headingStyle" || set === "headingCaps"
                ? "headings"
                : set === "headerAlign"
                  ? "header"
                  : "entries";

/**
 * The design's current values, as the Ask prompt's editor block reads them. No template: which one
 * was applied last is deliberately never stored (see `lookupTemplate` in design-reducer.ts).
 */
export const askDesignSettings = (design: ResumeDesign): Partial<Record<AskDesignSetting, string | number>> => ({
  columns: design.layout.columns,
  sideWidthPct: design.layout.sideWidthPct,
  basePt: design.fontSize.basePt,
  nameSizePt: design.fontSize.nameOffPt,
  titleSizePt: design.fontSize.titleOffPt,
  headingSizePt: design.fontSize.headingOffPt,
  entryHeaderSizePt: design.fontSize.entryHeaderOffPt,
  lineHeight: design.spacing.lineHeight,
  elementGapPt: design.spacing.elementGapPt,
  marginXmm: design.spacing.marginXmm,
  marginYmm: design.spacing.marginYmm,
  bodyFont: design.font.body,
  nameFont: design.font.name,
  accent: design.colors.accent,
  headingStyle: design.headings.style,
  headingCaps: design.headings.caps,
  bulletGlyph: design.entries.bulletGlyph,
  datePosition: design.entries.datePosition,
  headerAlign: design.header.align,
});

/** One action as the service sent it, checked again here; null when it is not one this editor runs. */
export function checkedAskAction(raw: unknown, sectionIds: ReadonlySet<string>): AskAction | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  switch (row.do) {
    case "tab": {
      const tab = oneOf(ASK_TABS, row.tab);
      return tab ? { do: "tab", tab } : null;
    }
    case "panel": {
      const panel = oneOf(ASK_PANELS, row.panel);
      return panel ? { do: "panel", panel } : null;
    }
    case "section":
      return typeof row.section === "string" && sectionIds.has(row.section) ? { do: "section", section: row.section } : null;
    case "design": {
      const set = oneOf(ASK_DESIGN_SETTINGS, row.set);
      return set && (typeof row.value === "string" || typeof row.value === "number") && designActionFor(set, row.value)
        ? { do: "design", set, value: row.value }
        : null;
    }
    case "tool": {
      const tool = oneOf(ASK_TOOLS, row.tool);
      return tool ? { do: "tool", tool } : null;
    }
    case "check":
      return row.against === "general" || row.against === "job" ? { do: "check", against: row.against } : null;
    default:
      return null;
  }
}
