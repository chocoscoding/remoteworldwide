// The 12 resume body/name faces.
//
// `next/font/google` is a BUILD-TIME TRANSFORM, not a runtime API: every call
// must be a top-level named import with a statically-analysable object literal.
// There is deliberately no `FONTS[id]()` indirection and no runtime strings —
// that would not compile.
//
// Why 12 and not 30: a picker where two-thirds of the options are decorative
// undermines the premise that every control genuinely changes the document.
//
// Loading policy:
//  - `preload: false` on EVERY family is mandatory. Without it Next injects one
//    `<link rel=preload>` per family into this route's <head> — 12 blocking
//    font fetches for the 1 face actually on screen. With it off the @font-face
//    rules still ship, and a file is only fetched once something renders in it,
//    so the 11 unused families cost ~0 bytes.
//  - `adjustFontFallback` stays at its default (true) to minimise the layout
//    shift when a face swaps in.
//  - `subsets: ["latin"]` (not `latin-ext`) roughly halves each file. Known
//    limitation: this conflicts with the Document > Language control if a
//    non-Latin language is ever shipped — revisit the subset list then.
//  - 10 of the 12 are variable fonts, so `weight` is OMITTED and one file
//    covers 100–900. Only Lato and Titillium Web are static; those must
//    enumerate weights, and they are capped at 2 families for that reason.
//  - `style: ["normal", "italic"]` everywhere: entry subtitles render the
//    company name in italic, and synthesised oblique looks visibly wrong at
//    print sizes. Every one of the 12 has a real italic.
//
// `next build` downloads all 12 families, so the first build is slower and
// needs network access.

import {
  Archivo,
  IBM_Plex_Sans,
  Jost,
  Lato,
  Lora,
  Nunito,
  Open_Sans,
  Rubik,
  Source_Sans_3,
  Source_Serif_4,
  Titillium_Web,
  Work_Sans,
} from "next/font/google";

import type { FontId } from "./design-types";

const SANS_FALLBACK = ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"];
const SERIF_FALLBACK = ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"];

// --- Variable families: no `weight`, one file spans the whole axis ----------

const workSans = Work_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-work-sans",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const jost = Jost({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-jost",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const archivo = Archivo({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-archivo",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const rubik = Rubik({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-rubik",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const nunito = Nunito({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-nunito",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-ibm-plex-sans",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-source-sans-3",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const openSans = Open_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-open-sans",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-source-serif-4",
  display: "swap",
  preload: false,
  fallback: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
});

const lora = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--r-f-lora",
  display: "swap",
  preload: false,
  fallback: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
});

// --- Static families: `weight` is required. Capped at 2. --------------------

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--r-f-lato",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const titilliumWeb = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--r-f-titillium-web",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

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

/**
 * Apply to the resume screen's OUTERMOST element so every `--r-f-*` var is in
 * scope. Without this the font picker resolves to the fallback stack for any
 * family whose class isn't otherwise on the tree.
 */
export const ALL_FONT_VARS: string = [
  workSans.variable,
  jost.variable,
  archivo.variable,
  rubik.variable,
  nunito.variable,
  ibmPlexSans.variable,
  sourceSans3.variable,
  openSans.variable,
  lato.variable,
  titilliumWeb.variable,
  sourceSerif4.variable,
  lora.variable,
].join(" ");
