import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ChromeId, ResumeCssVars, ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import { designToCssVars } from "@/app/lib/dashboard/resume/design-to-css";
import { buildLayout, type Band } from "@/app/lib/dashboard/resume/section-layout";
import HeaderBlock from "./HeaderBlock";
import SectionRenderer from "./SectionRenderer";
import { CHROME_COMPONENTS } from "./chrome";

export interface ResumePaperProps {
  design: ResumeDesign;
  sections: SectionConfig[];
  content: ResumeContent;
  /** Page-shell treatment. Defaults to "plain" (the base "basic corporate" look). */
  chrome?: ChromeId;
  className?: string;
}

/**
 * Flattens `buildLayout()`'s `Band[]` into the two slots `ChromeProps` has.
 * "mix" can produce up to 2 bands (an optional full head band, then one split
 * band), but chrome only takes `children`/`side`, not a list — a full band's
 * items prepend into `main`, a split band's `main`/`side` append into both.
 * Handles one-column (single full band, `side` stays null), two-column
 * (single split band) and mix with no per-mode special-casing.
 */
function flattenForChrome(bands: Band[]): { main: SectionConfig[]; side: SectionConfig[] | null } {
  const main: SectionConfig[] = [];
  let side: SectionConfig[] | null = null;
  for (const band of bands) {
    if (band.kind === "full") main.push(...band.items);
    else {
      main.push(...band.main);
      side = [...(side ?? []), ...band.side];
    }
  }
  return { main, side };
}

/**
 * The document itself — sizes the page, computes every `--r-*` CSS var once,
 * and delegates all actual layout to the selected chrome component. This is
 * the root every other `paper/` component ultimately renders under, and the
 * ONLY place in the feature that owns an inline `style={}`.
 *
 * Deliberately unadorned beyond background/size/text color: no shadow,
 * rounded corners or "mat" background. Those are editor presentation, not
 * the document, and HARD RULE #3 keeps `--r-*` vars confined to this
 * subtree while app chrome stays pure Tailwind — so the shadow/mat treatment
 * belongs in chunk A3's `Client.tsx` wrapper around `<ResumePaper/>`, the
 * same way the current screen wraps its own preview div today.
 */
const ResumePaper: FC<ResumePaperProps> = ({ design, sections, content, chrome = "plain", className }) => {
  // The ONE style={} in this entire feature. Every continuous/unbounded value
  // the design can express (pt, mm, line-height, arbitrary hex) becomes a CSS
  // custom property here; every consumer downstream reads it back through a
  // STATIC Tailwind arbitrary-value class, never through its own style prop.
  // Same house exception as `tracker/Client.tsx` (dnd-kit's drag transform)
  // and `ats/Client.tsx` (a conic-gradient) — both scope a single inline
  // style to one root for a value Tailwind's static scanner cannot express.
  //
  // `--r-photo-size` is the one var `designToCssVars()` doesn't already
  // return: `design-to-css.ts` is A0's closed file, and a photo diameter is a
  // continuous mm value only HeaderBlock's placeholder needs, so it's added
  // at this call site instead of reopening that module for one var. HeaderBlock
  // reads it back exactly like every other `--r-*` var — a static
  // arbitrary-value class, not a second style prop — so this stays the sole
  // style={} owner.
  const cssVars: ResumeCssVars = {
    ...designToCssVars(design),
    "--r-photo-size": `${design.photo.sizeMm}mm`,
  };

  // Personal Details (sections[0]) is structurally special — pinned, not part
  // of a column band, and its content comes from `content`/`design.header`
  // directly rather than from a SectionConfig. Splitting it off here, before
  // buildLayout runs, is what keeps "personal" from ever needing to be a case
  // in SectionRenderer's dispatch. (A3 renders the same entry outside
  // dnd-kit's SortableContext for the identical reason — this split is what
  // makes that consistent.)
  const [, ...rest] = sections;
  const bands = buildLayout(rest, design.layout.columns);
  const { main, side } = flattenForChrome(bands);

  const header: ReactNode = <HeaderBlock content={content} design={design} />;
  const mainContent: ReactNode = <SectionRenderer items={main} content={content} design={design} />;
  const sideContent: ReactNode = side ? <SectionRenderer items={side} content={content} design={design} /> : null;

  const Chrome = CHROME_COMPONENTS[chrome];

  return (
    <div
      style={cssVars}
      className={cn(
        "relative w-[var(--r-page-w)] min-h-[var(--r-page-h)] bg-[color:var(--r-page-bg)] px-[var(--r-mx)] py-[var(--r-my)] text-[color:var(--r-text)]",
        className
      )}>
      <Chrome design={design} content={content} header={header} side={sideContent}>
        {mainContent}
      </Chrome>
    </div>
  );
};

export default ResumePaper;
