// Tiny decorative gallery-card previews — one per template, gesturing at its
// distinguishing structural feature. NOT `ResumePaper` consumers: no `--r-*`
// CSS vars, no design object, just static Tailwind bars in a small bordered
// box. Follows the established Customize-rail mini-preview convention (see
// `HeadingsPanel.tsx`'s `HeadingStylePreview` and `TemplatesPanel.tsx`'s
// static Atlas card): `bg-[#fbfbf7]` box, literal `<span>` bars sized with
// fixed Tailwind height/width classes.
//
// `accent` is a runtime prop, and a Tailwind class assembled at render time
// (`` `bg-[${accent}]` ``) is invisible to Tailwind's build-time scanner —
// the same reasoning `SwatchGrid.tsx` documents for its own closed-palette
// `SWATCH_CLASS` lookup, and the established precedent this file follows
// instead of an inline `style={}`. The 6 templates only ever pass one of 6
// known accent hexes (their own `design.colors.accent`), so a literal
// class-lookup map covers every real call; an unknown hex falls back to a
// neutral chip rather than silently rendering unstyled.

import type { FC } from "react";
import { cn } from "@/lib/utils";

interface AccentClasses {
  bg: string;
  border: string;
}

const ACCENT_CLASS: Record<string, AccentClasses> = {
  "#222325": { bg: "bg-[#222325]", border: "border-[#222325]" }, // Ink (atlas/cadence default)
  "#3a4a7a": { bg: "bg-[#3a4a7a]", border: "border-[#3a4a7a]" }, // Navy (meridian)
  "#2b6cb0": { bg: "bg-[#2b6cb0]", border: "border-[#2b6cb0]" }, // Azure (cadence)
  "#2f5d50": { bg: "bg-[#2f5d50]", border: "border-[#2f5d50]" }, // Pine (quarry)
  "#a4522b": { bg: "bg-[#a4522b]", border: "border-[#a4522b]" }, // Rust (beacon)
  "#6d2434": { bg: "bg-[#6d2434]", border: "border-[#6d2434]" }, // Burgundy (linen)
};

const FALLBACK_ACCENT: AccentClasses = { bg: "bg-[#5c6670]", border: "border-[#5c6670]" };

function accentOf(accent: string): AccentClasses {
  return ACCENT_CLASS[accent.toLowerCase()] ?? FALLBACK_ACCENT;
}

const THUMB_BOX = "flex h-16 w-12 flex-none overflow-hidden rounded-lg bg-[#fbfbf7]";

/** Plain stacked bars, no color block — the honest "no chrome flourish" look. */
export const AtlasThumb: FC<{ accent: string }> = () => (
  <div className={cn(THUMB_BOX, "flex-col gap-1 p-2")}>
    <span className="block h-1.5 w-8 rounded-full bg-black/70" />
    <span className="block h-1 w-6 rounded-full bg-black/30" />
    <span className="mt-1 block h-px w-full bg-black/15" />
    <span className="block h-1 w-full rounded-full bg-black/15" />
    <span className="block h-1 w-9/12 rounded-full bg-black/15" />
  </div>
);

/** Colored band across the top, two columns of bars below. */
export const MeridianThumb: FC<{ accent: string }> = ({ accent }) => (
  <div className={cn(THUMB_BOX, "flex-col gap-1")}>
    <span className={cn("block h-3.5 w-full flex-none", accentOf(accent).bg)} />
    <div className="flex flex-1 gap-1 px-2 pb-2">
      <div className="flex flex-1 flex-col gap-1">
        <span className="block h-1 w-full rounded-full bg-black/25" />
        <span className="block h-1 w-8/12 rounded-full bg-black/15" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="block h-1 w-full rounded-full bg-black/15" />
        <span className="block h-1 w-6/12 rounded-full bg-black/15" />
      </div>
    </div>
  </div>
);

/** Colored vertical strip down one side, bars filling the remaining area. */
export const QuarryThumb: FC<{ accent: string }> = ({ accent }) => (
  <div className={THUMB_BOX}>
    <span className={cn("block h-full w-3.5 flex-none", accentOf(accent).bg)} />
    <div className="flex flex-1 flex-col gap-1 p-2">
      <span className="block h-1.5 w-8 rounded-full bg-black/60" />
      <span className="block h-1 w-full rounded-full bg-black/15" />
      <span className="block h-1 w-9/12 rounded-full bg-black/15" />
    </div>
  </div>
);

/** A small colored circle (the photo) atop a colored band, single column below. */
export const BeaconThumb: FC<{ accent: string }> = ({ accent }) => (
  <div className={cn(THUMB_BOX, "flex-col items-center gap-1 p-2")}>
    <span className={cn("h-2.5 w-2.5 flex-none rounded-full", accentOf(accent).bg)} />
    <span className={cn("block h-1 w-9/12 flex-none rounded-full", accentOf(accent).bg)} />
    <span className="mt-1 block h-1 w-full rounded-full bg-black/15" />
    <span className="block h-1 w-8/12 rounded-full bg-black/15" />
  </div>
);

/** A colored border/frame around the whole box, bars inside. */
export const LinenThumb: FC<{ accent: string }> = ({ accent }) => (
  <div className={cn(THUMB_BOX, "flex-col gap-1 border-2 bg-white p-1.5", accentOf(accent).border)}>
    <span className="block h-1.5 w-8 rounded-full bg-black/70" />
    <span className="mt-1 block h-1 w-full rounded-full bg-black/15" />
    <span className="block h-1 w-9/12 rounded-full bg-black/15" />
  </div>
);

/** A thin colored top rule, two tight columns of bars — conveys density. */
export const CadenceThumb: FC<{ accent: string }> = ({ accent }) => (
  <div className={cn(THUMB_BOX, "flex-col gap-1")}>
    <span className={cn("block h-1 w-full flex-none", accentOf(accent).bg)} />
    <div className="flex flex-1 gap-1 px-2 pb-2">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="block h-0.5 w-full rounded-full bg-black/25" />
        <span className="block h-0.5 w-full rounded-full bg-black/15" />
        <span className="block h-0.5 w-8/12 rounded-full bg-black/15" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="block h-0.5 w-full rounded-full bg-black/15" />
        <span className="block h-0.5 w-9/12 rounded-full bg-black/15" />
      </div>
    </div>
  </div>
);
