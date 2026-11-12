// Chart colours for the admin Outreach screens (light only, on the panels' white). The hues are the
// dataviz method's documented categorical palette, checked with its validate_palette.js against
// #ffffff: slots 1 to 4 and 5 to 7 pass every adjacent gate (worst CVD 9.1, normal vision 22.9);
// aqua, yellow and magenta sit under 3:1 contrast, so every chart ships direct labels or its table
// view. Colour follows the entity on every screen: "clicked" is the same orange wherever it shows.

/** The fixed categorical order. Never cycle it or invent a ninth hue. */
export const SLOT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"] as const;

/** The funnel measures (slots 1 to 4): the outcome gets the strongest hue, the top of the funnel the lightest. */
export const METRIC = {
  converted: SLOT[0],
  clicked: SLOT[1],
  opened: SLOT[2],
  delivered: SLOT[3],
  sent: SLOT[3],
} as const;

/** Where a mail comes from (slots 5 to 7), so a source never shares a hue with a measure on the Analytics page. */
export const SOURCE = { product: SLOT[4], campaign: SLOT[5], playbook: SLOT[6] } as const;

/** How strongly a conversion is tied to a mail: one hue in two ordinal steps (blue 450 and 250), credited the darker. */
export const CONVERSION = { credited: "#2a78d6", influenced: "#86b6ef" } as const;

/** The context series beside the one that matters (the emphasis form: one hue plus gray). */
export const CONTEXT = "#898781";

/** Feedback faces: a diverging blue to red scale with a gray middle. */
export const FACE = { great: "#256abf", good: "#86b6ef", meh: "#c3c2b7", bad: "#e34948" } as const;

/** Reserved status colours, always shown with an icon and a word, never used for a series. */
export const STATUS = { ok: "#0ca30c", warn: "#fab219", pause: "#d03b3b" } as const;

/** Chart furniture in the admin's own grays: hairline grid, axis, muted text, crosshair. */
export const CHROME = {
  surface: "#ffffff",
  grid: "#e5e7eb",
  axis: "#d1d5db",
  text: "#6b7280",
  label: "#374151",
  crosshair: "#9ca3af",
  empty: "#e5e7eb",
} as const;
