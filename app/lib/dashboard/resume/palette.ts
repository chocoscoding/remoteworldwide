// Accent swatches for the Colors panel, plus the contrast helper that decides
// what color text goes ON an accent fill.
//
// The five hexes carried over from the previous resume screen's ACCENT_COLORS
// (Ink, Navy, Pine, Clay) and the brand lime are kept so existing saved-looking
// choices still read as "the same" palette.

import type { AccentTarget } from "./design-types";

export interface Swatch {
  hex: string;
  name: string;
}

/**
 * 17 swatches, ordered neutrals -> blues -> teals/greens -> warms, which is how
 * the grid reads left-to-right, top-to-bottom.
 */
export const ACCENT_SWATCHES: Swatch[] = [
  { hex: "#222325", name: "Ink" },
  { hex: "#3f4348", name: "Charcoal" },
  { hex: "#5c6670", name: "Slate" },
  { hex: "#7d8794", name: "Mist" },
  { hex: "#3a4a7a", name: "Navy" },
  { hex: "#2c5282", name: "Denim" },
  { hex: "#2b6cb0", name: "Azure" },
  { hex: "#3a7ca5", name: "Cerulean" },
  { hex: "#14706b", name: "Teal" },
  { hex: "#2f5d50", name: "Pine" },
  { hex: "#4a7c59", name: "Fern" },
  { hex: "#6b7f3a", name: "Olive" },
  { hex: "#e1f073", name: "Lime" },
  { hex: "#8a5a2b", name: "Clay" },
  { hex: "#a4522b", name: "Rust" },
  { hex: "#6d2434", name: "Burgundy" },
  { hex: "#a13d55", name: "Rose" },
];

/** Just the hexes, for membership tests ("is the current accent a preset?"). */
export const ACCENT_SWATCH_HEXES: string[] = ACCENT_SWATCHES.map((s) => s.hex);

// ---------------------------------------------------------------------------
// The 9 "Apply Accent Color" checkboxes
// ---------------------------------------------------------------------------

export interface AccentTargetOption {
  id: AccentTarget;
  label: string;
}

export const ACCENT_TARGETS: AccentTargetOption[] = [
  { id: "name", label: "Full Name" },
  { id: "jobTitle", label: "Professional Title" },
  { id: "headings", label: "Section Headings" },
  { id: "headingsLine", label: "Heading Lines" },
  { id: "headerIcons", label: "Header Icons" },
  { id: "bullets", label: "Bullet Points" },
  { id: "dates", label: "Dates" },
  { id: "entrySubtitle", label: "Entry Subtitle" },
  { id: "linkIcons", label: "Link Icons" },
];

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

/** Foreground candidates for text sitting on an accent fill. */
export const ON_ACCENT_LIGHT = "#ffffff";
export const ON_ACCENT_DARK = "#222325";

/**
 * Crossover luminance between the two candidates above.
 *
 * Solving `contrast(L, white) === contrast(L, #222325)` with the WCAG formula
 * `(Lhi + 0.05) / (Llo + 0.05)`:
 *   L(#222325) = 0.016783
 *   (L + 0.05)^2 = 1.05 * (0.016783 + 0.05)  =>  L = 0.2148
 * Below this, white wins; above it, near-black wins. (Note it is NOT the
 * familiar 0.179 — that constant assumes the dark option is pure #000.)
 */
const ON_ACCENT_THRESHOLD = 0.2148;

/** `#abc` / `#aabbcc` (with or without the hash) -> 0–255 channels. */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2]
      : raw.length === 6
        ? raw
        : null;
  if (full === null || !/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** sRGB channel (0–255) -> linear-light (0–1), per IEC 61966-2-1. */
function toLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * WCAG 2.x relative luminance, 0–1. A real sRGB -> linear -> weighted-sum
 * calculation, not a `(r+g+b)/3` brightness average — the naive version calls
 * mid greens dark and mid blues light, both of which are wrong.
 * Returns 0 for unparseable input.
 */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  return (
    0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)
  );
}

/**
 * The text color to use on top of a fill of `hex`. Feeds `--r-on-accent` and
 * `--r-side-fg` so a filled sidebar or header band stays readable at any accent
 * — including the brand lime, which needs dark text.
 */
export function onAccent(hex: string): typeof ON_ACCENT_LIGHT | typeof ON_ACCENT_DARK {
  return relativeLuminance(hex) > ON_ACCENT_THRESHOLD ? ON_ACCENT_DARK : ON_ACCENT_LIGHT;
}

/** True when `hex` is a syntactically valid 3- or 6-digit hex color. */
export function isValidHex(hex: string): boolean {
  return parseHex(hex) !== null;
}

/** Normalizes user input to a lowercase `#rrggbb`, or null if unparseable. */
export function normalizeHex(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const pair = (n: number) => n.toString(16).padStart(2, "0");
  return `#${pair(rgb.r)}${pair(rgb.g)}${pair(rgb.b)}`;
}
