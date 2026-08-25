import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { BulletGlyph, ResumeDesign } from "@/app/lib/dashboard/resume/design-types";

export interface EntryHeaderProps {
  /** Role / degree / project or certification name. */
  primary: string;
  /** Company / school / issuer. Pass "" for entry kinds with no counterpart (Projects). */
  secondary: string;
  dates?: string;
  location?: string;
  design: ResumeDesign;
}

/**
 * Shared header row for Experience/Education/Projects/Training entries —
 * every entry kind in the content model reduces to "a primary line, an
 * optional secondary line, an optional date, an optional location", so this
 * is the one place `design.entries` (subtitle placement, structure, date
 * position, show/hide toggles) gets interpreted. Whatever's specific to one
 * entry kind (Experience's bullets, Education's detail line, Projects' link)
 * is rendered by that section component AFTER this, not here.
 */
const EntryHeader: FC<EntryHeaderProps> = ({ primary, secondary, dates, location, design }) => {
  const { entries } = design;
  const showDates = entries.showDates && Boolean(dates);
  const showLocation = entries.showLocation && Boolean(location);

  const primaryEl = (
    <span className="text-[length:var(--r-fs-entry)] font-bold leading-tight text-[color:var(--r-text)]">{primary}</span>
  );
  const secondaryEl = secondary ? (
    <span className="text-[length:var(--r-fs-entry)] italic leading-tight text-[color:var(--r-c-subtitle)]">{secondary}</span>
  ) : null;

  const titleBlock =
    entries.subtitle === "same-line" ? (
      <p className="flex flex-wrap items-baseline gap-x-[5pt]">
        {primaryEl}
        {secondaryEl}
      </p>
    ) : (
      <div>
        <p>{primaryEl}</p>
        {secondaryEl && <p className="mt-[1pt]">{secondaryEl}</p>}
      </div>
    );

  if (!showDates && !showLocation) return titleBlock;

  // "split": location rides with the title block on the left, dates alone on
  // the far right — the two meta fields deliberately go to OPPOSITE ends,
  // unlike "left"/"right" which keep them stacked together on one side.
  if (entries.datePosition === "split") {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-x-[8pt] gap-y-[2pt]">
        <div className="min-w-0">
          {titleBlock}
          {showLocation && <p className="mt-[1pt] text-[length:var(--r-fs-small)] text-[color:var(--r-c-date)]">{location}</p>}
        </div>
        {showDates && <span className="flex-none text-[length:var(--r-fs-small)] text-[color:var(--r-c-date)]">{dates}</span>}
      </div>
    );
  }

  const meta = (align: "start" | "end") => (
    <div
      className={cn(
        "flex flex-none flex-col text-[length:var(--r-fs-small)] leading-tight text-[color:var(--r-c-date)]",
        align === "end" ? "items-end" : "items-start"
      )}>
      {showDates && <span>{dates}</span>}
      {showLocation && <span>{location}</span>}
    </div>
  );

  const rowClass =
    entries.structure === "columns"
      ? "grid grid-cols-[1fr_auto] items-baseline gap-x-[8pt] gap-y-[2pt]"
      : "flex flex-wrap items-baseline justify-between gap-x-[8pt] gap-y-[2pt]";

  if (entries.datePosition === "left") {
    return (
      <div className={rowClass}>
        {meta("start")}
        <div className="min-w-0">{titleBlock}</div>
      </div>
    );
  }

  // "right" (default)
  return (
    <div className={rowClass}>
      <div className="min-w-0">{titleBlock}</div>
      {meta("end")}
    </div>
  );
};

export default EntryHeader;

// ---------------------------------------------------------------------------
// EntryBullets — the bullet list under an Experience entry. Co-located with
// EntryHeader because both are "entry" primitives driven by `design.entries`;
// no other section kind has a bullets array (Education/Projects/Training use
// EntryHeader alone, no bullets).
// ---------------------------------------------------------------------------

const BULLET_GLYPH_CHAR: Record<Exclude<BulletGlyph, "none">, string> = {
  dot: "•",
  dash: "–",
  square: "▪",
};

export interface EntryBulletsProps {
  items: string[];
  design: ResumeDesign;
}

/** `bulletGlyph: "none"` hides the marker entirely and left-aligns the text (no reserved indent). */
export const EntryBullets: FC<EntryBulletsProps> = ({ items, design }) => {
  if (items.length === 0) return null;
  const { bulletGlyph, indentBullets } = design.entries;
  const showGlyph = bulletGlyph !== "none";

  return (
    <ul className={cn("mt-[var(--r-gap-half)] flex flex-col gap-[2pt]", showGlyph && indentBullets && "pl-[14pt]")}>
      {items.map((item, i) => (
        <li
          key={i}
          className={cn(
            "text-[length:var(--r-fs-base)] leading-[var(--r-lh)] text-[color:var(--r-text)]",
            showGlyph && "flex gap-[6pt]"
          )}>
          {showGlyph && (
            <span aria-hidden className="flex-none text-[color:var(--r-c-bullet)]">
              {BULLET_GLYPH_CHAR[bulletGlyph]}
            </span>
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};
