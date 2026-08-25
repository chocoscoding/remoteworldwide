// `designToCssVars` — the whole styling model in one pure function.
//
// This is the hinge of the feature. Everything the design object can express
// that is continuous or unbounded (pt, mm, line-height, arbitrary hex) becomes
// a CSS custom property here, and this object is emitted by exactly ONE inline
// `style={}` on the paper root. Consumers then reference the vars from STATIC
// Tailwind arbitrary-value classes (`text-[length:var(--r-fs-name)]`,
// `text-[color:var(--r-c-name)]`) so Tailwind's build-time scanner can see
// every class it needs to emit. Nowhere else in the feature uses `style={}`.
//
// Two rules that keep the consumers dumb:
//  1. Put COMPLETE values in the vars. Never write a fallback inside a class
//     string — Tailwind arbitrary values can't contain spaces.
//  2. The 9 accent targets are RESOLVED here, so a consumer is unconditional:
//     it always reads `--r-c-date`, never `apply.dates ? accent : muted`.
//
// `pt` and `mm` are real CSS absolute units and are emitted literally. Nothing
// in this file converts to px.

import type {
  AccentTarget,
  PageFormat,
  ResumeCssVars,
  ResumeDesign,
} from "./design-types";
import { FONT_REGISTRY } from "./fonts";
import { onAccent } from "./palette";

const PAGE: Record<PageFormat, { w: string; h: string }> = {
  a4: { w: "210mm", h: "297mm" },
  letter: { w: "216mm", h: "279mm" },
};

export function designToCssVars(d: ResumeDesign): ResumeCssVars {
  const { basePt, nameOffPt, titleOffPt, headingOffPt, entryHeaderOffPt } = d.fontSize;
  const a = d.colors.accent;
  const on = (t: AccentTarget, fallback: string) => (d.colors.apply[t] ? a : fallback);
  const page = PAGE[d.doc.pageFormat];
  const bodyFont = FONT_REGISTRY[d.font.body];
  const nameFont = FONT_REGISTRY[d.font.name];

  return {
    // Inherited base — set ONCE here, never repeated on children. font-family,
    // color and line-height all inherit, so descendants only override where
    // they genuinely differ.
    fontFamily: `var(${bodyFont.varName}), ${bodyFont.fallback}`,

    // Geometry
    "--r-page-w": page.w,
    "--r-page-h": page.h,
    "--r-mx": `${d.spacing.marginXmm}mm`,
    "--r-my": `${d.spacing.marginYmm}mm`,
    "--r-side-w": `${d.layout.sideWidthPct}%`,

    // Type scale — the base + offset arithmetic happens ONCE, right here
    "--r-fs-base": `${basePt}pt`,
    "--r-fs-name": `${basePt + nameOffPt}pt`,
    "--r-fs-title": `${basePt + titleOffPt}pt`,
    "--r-fs-heading": `${basePt + headingOffPt}pt`,
    "--r-fs-entry": `${basePt + entryHeaderOffPt}pt`,
    "--r-fs-small": `${basePt - 1}pt`,
    "--r-lh": String(d.spacing.lineHeight),
    "--r-gap": `${d.spacing.elementGapPt}pt`,
    "--r-gap-half": `${d.spacing.elementGapPt / 2}pt`,

    "--r-font-name": `var(${nameFont.varName}), ${nameFont.fallback}`,

    // Base palette
    "--r-accent": a,
    "--r-accent-2": d.colors.mode === "multi" ? d.colors.accent2 : a,
    "--r-accent-3": d.colors.mode === "multi" ? d.colors.accent3 : a,
    "--r-on-accent": onAccent(a),
    "--r-text": d.colors.text,
    "--r-text-muted": d.colors.textMuted,
    "--r-rule": d.colors.rule,
    "--r-page-bg": d.colors.pageBg,

    // Chrome fills (Colors > application area)
    "--r-side-bg": d.colors.area === "full" ? a : "transparent",
    "--r-side-fg": d.colors.area === "full" ? onAccent(a) : d.colors.text,
    "--r-band-bg": d.colors.area === "header" ? a : "transparent",
    "--r-border-c": d.colors.area === "border" ? a : "transparent",

    // The 9 accent targets, RESOLVED
    "--r-c-name": on("name", d.colors.text),
    "--r-c-title": on("jobTitle", d.colors.textMuted),
    "--r-c-heading": on("headings", d.colors.text),
    "--r-c-heading-rule": on("headingsLine", d.colors.rule),
    "--r-c-header-icon": on("headerIcons", d.colors.textMuted),
    "--r-c-bullet": on("bullets", d.colors.textMuted),
    "--r-c-date": on("dates", d.colors.textMuted),
    "--r-c-subtitle": on("entrySubtitle", d.colors.textMuted),
    "--r-c-link-icon": on("linkIcons", d.colors.textMuted),
  };
}
