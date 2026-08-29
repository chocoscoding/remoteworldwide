// One place for the Interview Prep surface styles, so the whole feature reads
// as a single system rather than eight screens that each invented their own.
//
// Weight is a signal, and a signal only works if it's rare. So surfaces stay
// quiet — the same hairline card the rest of the dashboard uses (DashCard) —
// and the hard ink border plus offset shadow is reserved for things you can
// actually press. One dark hero per screen carries the emphasis; everything
// else recedes and lets the content read.

/** Default card. Matches DashCard so prep sits inside the dashboard, not beside it. */
export const PANEL = "rounded-2xl border border-black/10 bg-white";

/** The single emphasis surface per screen — dark fill, hard border, offset shadow. */
export const RAISED_DARK = "rounded-2xl border-[1.5px] border-[#222325] bg-[#222325] text-white shadow-[4px_4px_0_0_#e1f073]";

/**
 * Press feedback for real controls. Hover lifts onto a shadow, active drops
 * it back flush — the app's established StickerButton motion, not a heavy
 * always-on shadow.
 */
export const PRESS =
  "transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[3px_3px_0_0_#e1f073] hover:-translate-x-px hover:-translate-y-px active:translate-x-0 active:translate-y-0 active:shadow-none";

/** Press variant for controls on a dark surface, where lime would disappear. */
export const PRESS_ON_DARK =
  "transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[3px_3px_0_0_rgba(255,255,255,.3)] hover:-translate-x-px hover:-translate-y-px active:translate-x-0 active:translate-y-0 active:shadow-none";

/** Square icon-only control for secondary nav (pagination). Quiet until hovered. */
export const ICON_BUTTON =
  "inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-black/15 bg-white text-black/50 cursor-pointer transition-colors hover:border-[#222325] hover:text-[#222325]";

/**
 * Icon control for the primary per-row action (open this track). Keeps the
 * full two-stage press — rests on a shadow, hover grows it 0.5px so it lifts
 * without moving, then active translates onto it and collapses it so the
 * button lands flush. Same motion as NeoCheckbox.
 */
export const ICON_BUTTON_PRESS =
  "inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border-[1.5px] border-[#222325] bg-white text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

/** Secondary text button — bordered, no fill. */
export const BUTTON_OUTLINE =
  "inline-flex items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3.5 py-2 text-xs font-bold text-[#222325] cursor-pointer transition-colors hover:border-[#222325]";

/** Primary text button — ink fill. */
export const BUTTON_SOLID = `inline-flex items-center gap-1.5 rounded-lg bg-[#222325] px-3.5 py-2 text-xs font-bold text-white cursor-pointer ${PRESS}`;

/**
 * Accent button — lime fill, for the single strongest action on a screen.
 * Carries the full two-stage press because it is the thing you are meant to
 * hit: rests on a white shadow so it reads as raised off the dark card,
 * hover grows it 0.5px, active lands it flush.
 */
export const BUTTON_ACCENT =
  "inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-[#e1f073] px-3.5 py-2 text-xs font-bold text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#ffffff] hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

/** Segmented control shell + its selected/unselected item states. */
export const SEGMENT_SHELL = "inline-flex items-center gap-0.5 rounded-lg bg-[#f0f0ea] p-1";
export const SEGMENT_ON = "rounded-md bg-[#222325] px-3 py-1.5 text-xs font-bold text-white cursor-pointer";
export const SEGMENT_OFF = "rounded-md px-3 py-1.5 text-xs font-bold text-black/50 hover:text-[#222325] cursor-pointer transition-colors";

/** Text field shell used across the feature's inputs. */
export const FIELD_SHELL = "flex items-center gap-2 rounded-lg border border-black/15 bg-[#fbfbf7] px-3 py-2 transition-colors focus-within:border-[#222325]";
