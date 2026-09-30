// The 12 resume faces as DATA: ids, labels, CSS variable names and fallback
// stacks — everything about a font except the font.
//
// Split out of `./fonts.ts` so the parts of the app that only need to NAME a
// face can do it without loading one. `next/font/google` calls are a build-time
// transform that only the Next compiler can run, so a module holding them can't
// be imported from a route handler's DOCX export, from a plain `node --test`, or
// from anything else that wants the registry without twelve @font-face rules.
// `./fonts.ts` keeps the loaders and re-exports this, so its callers are
// unchanged.
//
// The two halves must agree: each `varName` here is the `variable` of exactly
// one loader there, and each `fallback` is that loader's `fallback` list joined.
// `tests/resume-exports.test.mjs` reads both files and fails when they drift.

import type { FontId } from "./design-types";

export const SANS_FALLBACK = ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"];
export const SERIF_FALLBACK = ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"];

export interface FontDef {
  id: FontId;
  label: string;
  group: "sans" | "serif";
  /** The CSS custom property Next generates for this family. */
  varName: `--r-f-${string}`;
  /** Comma-joined fallback stack, ready to drop straight into a var value. */
  fallback: string;
  /**
   * Static Tailwind class so a dropdown row can render in its own face.
   * Written out as a literal (never built with a template string) so Tailwind's
   * build-time scanner emits it — same convention as ProgressBar's
   * WIDTH_CLASSES.
   */
  previewClass: string;
}

const SANS_FALLBACK_CSS = SANS_FALLBACK.join(", ");
const SERIF_FALLBACK_CSS = SERIF_FALLBACK.join(", ");

export const FONT_REGISTRY: Record<FontId, FontDef> = {
  "work-sans": {
    id: "work-sans",
    label: "Work Sans",
    group: "sans",
    varName: "--r-f-work-sans",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-work-sans)]",
  },
  jost: {
    id: "jost",
    label: "Jost",
    group: "sans",
    varName: "--r-f-jost",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-jost)]",
  },
  archivo: {
    id: "archivo",
    label: "Archivo",
    group: "sans",
    varName: "--r-f-archivo",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-archivo)]",
  },
  rubik: {
    id: "rubik",
    label: "Rubik",
    group: "sans",
    varName: "--r-f-rubik",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-rubik)]",
  },
  nunito: {
    id: "nunito",
    label: "Nunito",
    group: "sans",
    varName: "--r-f-nunito",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-nunito)]",
  },
  "ibm-plex-sans": {
    id: "ibm-plex-sans",
    label: "IBM Plex Sans",
    group: "sans",
    varName: "--r-f-ibm-plex-sans",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-ibm-plex-sans)]",
  },
  "source-sans-3": {
    id: "source-sans-3",
    label: "Source Sans 3",
    group: "sans",
    varName: "--r-f-source-sans-3",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-source-sans-3)]",
  },
  "open-sans": {
    id: "open-sans",
    label: "Open Sans",
    group: "sans",
    varName: "--r-f-open-sans",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-open-sans)]",
  },
  lato: {
    id: "lato",
    label: "Lato",
    group: "sans",
    varName: "--r-f-lato",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-lato)]",
  },
  "titillium-web": {
    id: "titillium-web",
    label: "Titillium Web",
    group: "sans",
    varName: "--r-f-titillium-web",
    fallback: SANS_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-titillium-web)]",
  },
  "source-serif-4": {
    id: "source-serif-4",
    label: "Source Serif 4",
    group: "serif",
    varName: "--r-f-source-serif-4",
    fallback: SERIF_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-source-serif-4)]",
  },
  lora: {
    id: "lora",
    label: "Lora",
    group: "serif",
    varName: "--r-f-lora",
    fallback: SERIF_FALLBACK_CSS,
    previewClass: "font-[family-name:var(--r-f-lora)]",
  },
};

/** Dropdown order — sans first, then serif, matching FONT_REGISTRY's order. */
export const FONT_OPTIONS: FontDef[] = Object.values(FONT_REGISTRY);
