"use client";

import { type ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grid of round colour swatches with a check on the selected one, plus a
 * trailing "custom" swatch (rainbow disc) that opens the colour popover.
 *
 * ## Why the palette is a closed set
 *
 * `style={}` is banned everywhere in this feature except the resume paper
 * root, and a Tailwind class assembled at runtime (`` `bg-[${hex}]` ``) is
 * invisible to Tailwind's build-time scanner — it would simply never ship.
 * So every paintable swatch resolves through {@link SWATCH_CLASS}, a
 * class-lookup map whose class strings are written out literally below (the
 * same house pattern as `StickerButton`'s `STICKER_SHADOW_HOVER`).
 *
 * Callers should seed their palette from {@link RESUME_SWATCH_HEXES}. A hex
 * outside the map renders on a neutral chip rather than crashing, and an
 * arbitrary custom colour (from the wheel) is represented by the trailing
 * custom swatch taking the selected ring — its actual value is shown inside
 * `ColorWheelPopover`.
 *
 * Presentational and fully prop-driven: no design types, no context.
 */

interface SwatchClasses {
  /** Static Tailwind background class for the chip. */
  bg: string;
  /** Foreground class for the check glyph — precomputed for contrast. */
  on: string;
}

const ON_LIGHT = "text-[#222325]";
const ON_DARK = "text-white";

/**
 * The closed swatch palette. Matches `ACCENT_SWATCHES` in
 * `app/lib/dashboard/resume/palette.ts` (A0) hex-for-hex — this file stays
 * decoupled from that module (no import, per this chunk's own presentational
 * contract), but the two lists must agree or most of the Resume Colors panel
 * would render on the neutral fallback chip instead of its real color. `on`
 * contrast per entry was computed with the same WCAG relative-luminance
 * calculation `palette.ts` uses (threshold 0.2148, not the standard 0.179 —
 * see that file for why), not eyeballed.
 */
export const SWATCH_CLASS: Record<string, SwatchClasses> = {
  "#222325": { bg: "bg-[#222325]", on: ON_DARK }, // Ink
  "#3f4348": { bg: "bg-[#3f4348]", on: ON_DARK }, // Charcoal
  "#5c6670": { bg: "bg-[#5c6670]", on: ON_DARK }, // Slate
  "#7d8794": { bg: "bg-[#7d8794]", on: ON_LIGHT }, // Mist
  "#3a4a7a": { bg: "bg-[#3a4a7a]", on: ON_DARK }, // Navy
  "#2c5282": { bg: "bg-[#2c5282]", on: ON_DARK }, // Denim
  "#2b6cb0": { bg: "bg-[#2b6cb0]", on: ON_DARK }, // Azure
  "#3a7ca5": { bg: "bg-[#3a7ca5]", on: ON_DARK }, // Cerulean
  "#14706b": { bg: "bg-[#14706b]", on: ON_DARK }, // Teal
  "#2f5d50": { bg: "bg-[#2f5d50]", on: ON_DARK }, // Pine
  "#4a7c59": { bg: "bg-[#4a7c59]", on: ON_DARK }, // Fern
  "#6b7f3a": { bg: "bg-[#6b7f3a]", on: ON_DARK }, // Olive
  "#e1f073": { bg: "bg-[#e1f073]", on: ON_LIGHT }, // Lime (brand)
  "#8a5a2b": { bg: "bg-[#8a5a2b]", on: ON_DARK }, // Clay
  "#a4522b": { bg: "bg-[#a4522b]", on: ON_DARK }, // Rust
  "#6d2434": { bg: "bg-[#6d2434]", on: ON_DARK }, // Burgundy
  "#a13d55": { bg: "bg-[#a13d55]", on: ON_DARK }, // Rose
};

/** Every hex {@link SwatchGrid} can paint, in palette order. */
export const RESUME_SWATCH_HEXES: string[] = Object.keys(SWATCH_CLASS);

const UNKNOWN_SWATCH: SwatchClasses = { bg: "bg-[#e5e5e0]", on: ON_LIGHT };

/** Static because arbitrary Tailwind values must be literals in source. */
const RAINBOW_CLASS =
  "bg-[image:conic-gradient(from_180deg,#ff0000,#ffa500,#ffff00,#00c853,#00bcd4,#3f51b5,#9c27b0,#ff0000)]";

export interface SwatchGridProps {
  /** Hex values to offer. Use entries from {@link RESUME_SWATCH_HEXES}. */
  swatches: string[];
  /** Currently selected hex. A value outside `swatches` selects the custom chip. */
  value: string;
  onChange: (hex: string) => void;
  /** Renders the built-in custom (rainbow) chip. Omit both custom props to hide it. */
  onCustomClick?: () => void;
  /**
   * Renders this in place of the built-in custom chip — pass a
   * `ColorWheelPopover` here so the popover anchors to the chip itself.
   * Takes precedence over `onCustomClick`.
   */
  customTrigger?: ReactNode;
  /** Optional label rendered above the grid. */
  label?: string;
  className?: string;
}

export default function SwatchGrid({ swatches, value, onChange, onCustomClick, customTrigger, label, className }: SwatchGridProps) {
  const current = value.toLowerCase();
  const isCustom = !swatches.some((hex) => hex.toLowerCase() === current);
  const showCustom = Boolean(customTrigger) || Boolean(onCustomClick);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-xs font-semibold text-black/55">{label}</span>}
      <div className="flex flex-wrap items-center gap-2.5">
        {swatches.map((hex) => {
          const classes = SWATCH_CLASS[hex.toLowerCase()] ?? UNKNOWN_SWATCH;
          const selected = hex.toLowerCase() === current;
          return (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              aria-pressed={selected}
              onClick={() => onChange(hex)}
              className={cn(
                "grid h-7 w-7 flex-none place-content-center rounded-full transition-shadow cursor-pointer",
                classes.bg,
                selected ? "ring-2 ring-black/70 ring-offset-2" : "ring-1 ring-black/10 hover:ring-black/25"
              )}>
              {selected && <Check className={cn("h-3.5 w-3.5", classes.on)} strokeWidth={3} />}
            </button>
          );
        })}

        {showCustom &&
          (customTrigger ?? (
            <button
              type="button"
              aria-label="Custom colour"
              aria-pressed={isCustom}
              onClick={onCustomClick}
              className={cn(
                "relative grid h-7 w-7 flex-none place-content-center rounded-full transition-shadow cursor-pointer",
                RAINBOW_CLASS,
                isCustom ? "ring-2 ring-black/70 ring-offset-2" : "ring-1 ring-black/10 hover:ring-black/25"
              )}>
              <span className="grid h-4 w-4 place-content-center rounded-full bg-white">
                <Plus className="h-2.5 w-2.5 text-[#222325]" strokeWidth={3} />
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}
