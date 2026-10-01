// The onboarding page's few surfaces, named once.
//
// Light brutalism, per the owner (2026-09-26: "reduce the denseness"): the
// pricing CreditEstimator's recipe — a 1.5px ink outline and one ≤4px offset
// shadow on the cards that frame a step, hairline 1px outlines inside them,
// and weight saved for the things you press. Headings stop at bold.

/** A step's frame: the heaviest thing on the page, and the only 4px shadow. */
export const STEP_CARD = "rounded-[20px] bg-white br-bold";

/** A choice inside a step (a document, a built resume): hairline until hovered or picked. */
export const OPTION = "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] duration-100 cursor-pointer";
export const OPTION_IDLE = "border-primary/20 bg-white hover:border-primary/60";
export const OPTION_PICKED = "bg-primary2 br-shadow";

export const BUTTON_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-lg border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white cursor-pointer br-plain-press br-lime disabled:opacity-40 disabled:pointer-events-none";

export const BUTTON_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-primary cursor-pointer transition-colors hover:border-primary disabled:opacity-40 disabled:pointer-events-none";

/** Small caps over a group of fields — the resume editor's content-form label, one step lighter. */
export const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/55";

export const HINT = "text-xs leading-relaxed text-primary/55";
