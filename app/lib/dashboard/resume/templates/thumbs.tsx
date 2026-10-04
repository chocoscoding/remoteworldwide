// Gallery-card previews — one per template, a sketch of a whole A4 page that
// gestures at the template's distinguishing structure. NOT `ResumePaper`
// consumers: no `--r-*` CSS vars, no design object, just static Tailwind bars.
// Each sketch fills the box it is given (the Templates carousel sizes the
// card), so widths are percentages and only bar heights are fixed.
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
  "#222325": { bg: "bg-[#222325]", border: "border-[#222325]" }, // Ink (atlas default)
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

/** The page itself: A4 proportions, white, clipped like a sheet of paper. */
const PAGE = "flex aspect-[210/297] w-full overflow-hidden bg-white";

/** One line of text. `className` sets its width, and its height/tone when not body copy. */
const Bar: FC<{ className?: string }> = ({ className }) => (
  <span className={cn("block h-1 flex-none rounded-full bg-black/15", className)} />
);

/** A section: heading bar, optional rule, then a few lines of body copy. */
const Section: FC<{ heading?: string; rule?: boolean; lines?: string[]; center?: boolean }> = ({
  heading = "bg-black/60",
  rule = false,
  lines = ["w-full", "w-11/12", "w-9/12"],
  center = false,
}) => (
  <div className={cn("flex flex-col gap-1", center && "items-center")}>
    <Bar className={cn("h-1.5 w-[30%]", heading)} />
    {rule && <span className="block h-px w-full flex-none bg-black/20" />}
    {lines.map((w, i) => (
      <Bar key={i} className={w} />
    ))}
  </div>
);

/** Plain stacked sections under a rule — the honest "no chrome flourish" look. */
export const AtlasThumb: FC<{ accent: string }> = () => (
  <div className={cn(PAGE, "flex-col gap-3 p-[9%]")}>
    <div className="flex flex-col gap-1.5">
      <Bar className="h-2.5 w-[55%] bg-black/75" />
      <Bar className="h-1.5 w-[35%] bg-black/35" />
    </div>
    <Section rule />
    <Section rule lines={["w-full", "w-10/12", "w-full", "w-8/12"]} />
    <Section rule lines={["w-full", "w-9/12"]} />
    <Section rule lines={["w-10/12", "w-7/12"]} />
  </div>
);

/** Colored band across the top, two columns below with the side column on the right. */
export const MeridianThumb: FC<{ accent: string }> = ({ accent }) => (
  <div className={cn(PAGE, "flex-col")}>
    <div className={cn("flex h-[18%] flex-none flex-col justify-center gap-1.5 px-[9%]", accentOf(accent).bg)}>
      <Bar className="h-2.5 w-[50%] bg-white/90" />
      <Bar className="h-1.5 w-[32%] bg-white/50" />
    </div>
    <div className="flex flex-1 gap-[7%] p-[9%]">
      <div className="flex flex-1 flex-col gap-3">
        <Section heading={accentOf(accent).bg} />
        <Section heading={accentOf(accent).bg} lines={["w-full", "w-10/12", "w-full", "w-8/12"]} />
        <Section heading={accentOf(accent).bg} lines={["w-full", "w-9/12"]} />
      </div>
      <div className="flex w-[32%] flex-none flex-col gap-3">
        <Section heading={accentOf(accent).bg} lines={["w-full", "w-8/12"]} />
        <Section heading={accentOf(accent).bg} lines={["w-full", "w-9/12", "w-7/12"]} />
      </div>
    </div>
  </div>
);

/** A filled sidebar down the left carrying the header and credentials, main column beside it. */
export const QuarryThumb: FC<{ accent: string }> = ({ accent }) => (
  <div className={PAGE}>
    <div className={cn("flex w-[34%] flex-none flex-col gap-3 px-[6%] py-[16%]", accentOf(accent).bg)}>
      <div className="flex flex-col gap-1.5">
        <Bar className="h-2.5 w-full bg-white/90" />
        <Bar className="h-1.5 w-8/12 bg-white/50" />
      </div>
      <Section heading="bg-white/80" lines={["w-full bg-white/30", "w-9/12 bg-white/30", "w-10/12 bg-white/30"]} />
      <Section heading="bg-white/80" lines={["w-full bg-white/30", "w-8/12 bg-white/30"]} />
    </div>
    <div className="flex flex-1 flex-col gap-3 p-[9%] pt-[16%]">
      <Section />
      <Section lines={["w-full", "w-10/12", "w-full", "w-8/12"]} />
      <Section lines={["w-full", "w-9/12"]} />
    </div>
  </div>
);

/** A bordered header block with a round photo centred above the name, one column below. */
export const BeaconThumb: FC<{ accent: string }> = ({ accent }) => (
  <div className={cn(PAGE, "flex-col gap-3 p-[9%]")}>
    <div className={cn("flex flex-none flex-col items-center gap-1.5 rounded-sm border-2 py-[8%]", accentOf(accent).border)}>
      <span className={cn("block aspect-square w-[18%] flex-none rounded-full", accentOf(accent).bg)} />
      <Bar className="mt-0.5 h-2.5 w-[50%] bg-black/75" />
      <Bar className={cn("h-1.5 w-[32%]", accentOf(accent).bg)} />
    </div>
    <Section heading={accentOf(accent).bg} rule />
    <Section heading={accentOf(accent).bg} rule lines={["w-full", "w-10/12", "w-full", "w-8/12"]} />
    <Section heading={accentOf(accent).bg} rule lines={["w-full", "w-9/12"]} />
  </div>
);

/** A full-page rule frame around a centred, quieter single column. */
export const LinenThumb: FC<{ accent: string }> = ({ accent }) => (
  <div className={cn(PAGE, "p-[5%]")}>
    <div className={cn("flex flex-1 flex-col gap-3 border-2 p-[8%]", accentOf(accent).border)}>
      <div className="flex flex-col items-center gap-1.5">
        <Bar className="h-2.5 w-[55%] bg-black/75" />
        <Bar className={cn("h-1.5 w-[35%]", accentOf(accent).bg)} />
      </div>
      <Section center heading={accentOf(accent).bg} rule />
      <Section center heading={accentOf(accent).bg} rule lines={["w-full", "w-10/12", "w-full", "w-8/12"]} />
      <Section center heading={accentOf(accent).bg} rule lines={["w-full", "w-9/12"]} />
    </div>
  </div>
);

/** A thin colored top rule, then two tight columns of thinner lines — conveys density. */
export const CadenceThumb: FC<{ accent: string }> = ({ accent }) => {
  const tight = ["h-0.5 w-full", "h-0.5 w-11/12", "h-0.5 w-full", "h-0.5 w-9/12"];
  return (
    <div className={cn(PAGE, "flex-col")}>
      <span className={cn("block h-1 w-full flex-none", accentOf(accent).bg)} />
      <div className="flex flex-col gap-1.5 px-[8%] pt-[8%]">
        <Bar className="h-2 w-[50%] bg-black/75" />
        <Bar className={cn("h-1 w-[30%]", accentOf(accent).bg)} />
      </div>
      <div className="flex flex-1 gap-[6%] p-[8%]">
        <div className="flex flex-1 flex-col gap-2">
          <Section heading={accentOf(accent).bg} lines={tight} />
          <Section heading={accentOf(accent).bg} lines={[...tight, ...tight]} />
          <Section heading={accentOf(accent).bg} lines={tight} />
          <Section heading={accentOf(accent).bg} lines={tight.slice(0, 2)} />
        </div>
        <div className="flex w-[34%] flex-none flex-col gap-2">
          <Section heading={accentOf(accent).bg} lines={tight.slice(0, 3)} />
          <Section heading={accentOf(accent).bg} lines={tight} />
          <Section heading={accentOf(accent).bg} lines={tight.slice(0, 2)} />
        </div>
      </div>
    </div>
  );
};
