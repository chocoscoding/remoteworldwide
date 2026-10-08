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
// neutral chip rather than silently rendering unstyled. Every template's accent
// needs its line in `ACCENT_CLASS`.

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
  "#3f4348": { bg: "bg-[#3f4348]", border: "border-[#3f4348]" }, // Charcoal (graphite)
  "#14706b": { bg: "bg-[#14706b]", border: "border-[#14706b]" }, // Teal (harbor)
  "#8a5a2b": { bg: "bg-[#8a5a2b]", border: "border-[#8a5a2b]" }, // Clay (folio)
  "#2c5282": { bg: "bg-[#2c5282]", border: "border-[#2c5282]" }, // Denim (summit)
  "#a13d55": { bg: "bg-[#a13d55]", border: "border-[#a13d55]" }, // Rose (pulse)
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

/** Name and title, contact details on one line between bars; headings that run into a rule; dates alone on the right. */
export const GraphiteThumb: FC<{ accent: string }> = ({ accent }) => {
  const heading = (width: string) => (
    <div className="flex items-center gap-1.5">
      <Bar className={cn("h-1.5", width, "bg-black/60")} />
      <span className="block h-px flex-1 bg-black/25" />
    </div>
  );
  const entry = (lines: string[]) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <Bar className="h-1.5 w-[45%] bg-black/45" />
        <Bar className={cn("h-1 w-[18%]", accentOf(accent).bg)} />
      </div>
      {lines.map((w, i) => (
        <Bar key={i} className={w} />
      ))}
    </div>
  );
  return (
    <div className={cn(PAGE, "flex-col gap-3 p-[9%]")}>
      <div className="flex flex-col gap-1.5">
        <Bar className={cn("h-2.5 w-[50%]", accentOf(accent).bg)} />
        <Bar className="h-1.5 w-[36%] bg-black/35" />
        <div className="flex items-center gap-1">
          <Bar className="w-[20%]" />
          <span className="block h-1.5 w-px flex-none bg-black/30" />
          <Bar className="w-[18%]" />
          <span className="block h-1.5 w-px flex-none bg-black/30" />
          <Bar className="w-[16%]" />
        </div>
      </div>
      {heading("w-[24%]")}
      <Bar className="w-full" />
      <Bar className="w-10/12" />
      {heading("w-[30%]")}
      {entry(["w-full", "w-11/12", "w-8/12"])}
      {entry(["w-full", "w-9/12"])}
      {heading("w-[22%]")}
      <Bar className="w-9/12" />
    </div>
  );
};

/** A colored band with a rounded photo left of the name; one column below, headings with a short underline. */
export const HarborThumb: FC<{ accent: string }> = ({ accent }) => {
  const section = (lines: string[]) => (
    <div className="flex flex-col gap-1">
      <Bar className="h-1.5 w-[28%] bg-black/60" />
      <span className={cn("block h-0.5 w-[12%] flex-none rounded-full", accentOf(accent).bg)} />
      {lines.map((w, i) => (
        <Bar key={i} className={w} />
      ))}
    </div>
  );
  return (
    <div className={cn(PAGE, "flex-col")}>
      <div className={cn("flex h-[18%] flex-none items-center gap-[5%] px-[9%]", accentOf(accent).bg)}>
        <span className="block aspect-square h-[62%] flex-none rounded-md bg-white/80" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Bar className="h-2.5 w-[70%] bg-white/90" />
          <Bar className="h-1.5 w-[45%] bg-white/50" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-[9%]">
        {section(["w-full", "w-10/12"])}
        {section(["w-full", "w-11/12", "w-full", "w-8/12"])}
        {section(["w-full", "w-9/12"])}
        {section(["w-10/12", "w-7/12"])}
      </div>
    </div>
  );
};

/** A centred serif-feeling header with its contact line between bars; headings under a rule, education first. */
export const FolioThumb: FC<{ accent: string }> = ({ accent }) => {
  const section = (lines: string[]) => (
    <div className="flex flex-col gap-1">
      <span className={cn("block h-px w-full flex-none", accentOf(accent).bg)} />
      <Bar className="h-1.5 w-[26%] bg-black/60" />
      {lines.map((w, i) => (
        <Bar key={i} className={w} />
      ))}
    </div>
  );
  return (
    <div className={cn(PAGE, "flex-col gap-3 p-[10%]")}>
      <div className="flex flex-col items-center gap-1.5">
        <Bar className={cn("h-2.5 w-[55%]", accentOf(accent).bg)} />
        <div className="flex w-[70%] items-center justify-center gap-1">
          <Bar className="w-[28%]" />
          <span className="block h-1.5 w-px flex-none bg-black/30" />
          <Bar className="w-[24%]" />
          <span className="block h-1.5 w-px flex-none bg-black/30" />
          <Bar className="w-[28%]" />
        </div>
      </div>
      {section(["w-full", "w-11/12"])}
      {section(["w-10/12", "w-8/12"])}
      {section(["w-full", "w-10/12", "w-full", "w-9/12"])}
      {section(["w-9/12", "w-7/12"])}
    </div>
  );
};

/** A filled, inset header block over two columns, boxed headings, and bubbles in the narrow column. */
export const SummitThumb: FC<{ accent: string }> = ({ accent }) => {
  const boxed = <Bar className={cn("h-2 w-[40%] rounded-sm", accentOf(accent).bg)} />;
  return (
    <div className={cn(PAGE, "flex-col gap-3 p-[8%]")}>
      <div className={cn("flex flex-none flex-col gap-1.5 rounded-sm px-[7%] py-[7%]", accentOf(accent).bg)}>
        <Bar className="h-2.5 w-[50%] bg-white/90" />
        <Bar className="h-1.5 w-[32%] bg-white/50" />
      </div>
      <div className="flex flex-1 gap-[7%]">
        <div className="flex w-[30%] flex-none flex-col gap-3">
          <div className="flex flex-col gap-1">
            {boxed}
            <div className="flex flex-wrap gap-1">
              {["w-[45%]", "w-[35%]", "w-[40%]", "w-[50%]", "w-[30%]"].map((w, i) => (
                <span key={i} className={cn("block h-1.5 rounded-full border border-black/25 bg-black/10", w)} />
              ))}
            </div>
          </div>
          <Section heading={accentOf(accent).bg} lines={["w-full", "w-8/12"]} />
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <Section heading={accentOf(accent).bg} lines={["w-full", "w-11/12"]} />
          <Section heading={accentOf(accent).bg} lines={["w-full", "w-10/12", "w-full", "w-8/12"]} />
          <Section heading={accentOf(accent).bg} lines={["w-full", "w-9/12", "w-10/12"]} />
        </div>
      </div>
    </div>
  );
};

/** A big name, section icons beside plain headings, colored square bullets, and bubbles in a wide side column. */
export const PulseThumb: FC<{ accent: string }> = ({ accent }) => {
  const heading = (
    <div className="flex items-center gap-1">
      <span className={cn("block aspect-square w-[9%] flex-none rounded-sm", accentOf(accent).bg)} />
      <Bar className="h-1.5 w-[35%] bg-black/60" />
    </div>
  );
  const bullet = (w: string, i: number) => (
    <div key={i} className="flex items-center gap-1">
      <span className={cn("block h-1 w-1 flex-none", accentOf(accent).bg)} />
      <Bar className={w} />
    </div>
  );
  return (
    <div className={cn(PAGE, "flex-col gap-3 p-[8%]")}>
      <div className="flex flex-col gap-1.5">
        <Bar className={cn("h-3 w-[62%]", accentOf(accent).bg)} />
        <Bar className="h-1.5 w-[36%] bg-black/35" />
      </div>
      <div className="flex flex-1 gap-[6%]">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            {heading}
            <Bar className="w-full" />
            <Bar className="w-10/12" />
          </div>
          <div className="flex flex-col gap-1">
            {heading}
            {["w-full", "w-11/12", "w-10/12", "w-9/12"].map(bullet)}
          </div>
          <div className="flex flex-col gap-1">
            {heading}
            {["w-full", "w-8/12"].map(bullet)}
          </div>
        </div>
        <div className="flex w-[36%] flex-none flex-col gap-3">
          <div className="flex flex-col gap-1">
            {heading}
            <div className="flex flex-wrap gap-1">
              {["w-[45%]", "w-[38%]", "w-[52%]", "w-[30%]", "w-[42%]"].map((w, i) => (
                <span key={i} className={cn("block h-1.5 rounded-full bg-black/15", w)} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {heading}
            <Bar className="w-full" />
            <Bar className="w-8/12" />
          </div>
        </div>
      </div>
    </div>
  );
};
