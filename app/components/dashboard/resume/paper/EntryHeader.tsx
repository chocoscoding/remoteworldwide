import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { BulletGlyph, ResumeDesign } from "@/app/lib/dashboard/resume/design-types";
import { displayDates } from "@/app/lib/resume/dates";
import { BulletText, UnderlinedText, type UnderlineAt } from "./highlight";

export interface EntryHeaderProps {
  /** Role / degree / project or certification name. */
  primary: string;
  /** Which line `primary` is, where "Fix tone & grammar" may underline it (a degree, a certification's name). */
  primaryAt?: UnderlineAt;
  /** Company / school / issuer. Pass "" for entry kinds with no counterpart (Projects). */
  secondary: string;
  /** The entry's stored date line; printed in `design.doc.dateFormat` when it reads as a range, as written when not. */
  dates?: string;
  location?: string;
  /** Print the location on its own line under the title and company (a role), whatever the date position. */
  locationBelow?: boolean;
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
const EntryHeader: FC<EntryHeaderProps> = ({ primary, primaryAt, secondary, dates: storedDates, location, locationBelow = false, design }) => {
  const { entries } = design;
  const dates = displayDates(storedDates, design.doc.dateFormat);
  const showDates = entries.showDates && Boolean(dates);
  const showLocation = entries.showLocation && Boolean(location);

  const primaryEl = (
    <span className="text-[length:var(--r-fs-entry)] font-bold leading-tight text-[color:var(--r-text)]">
      {primaryAt ? <UnderlinedText at={primaryAt} text={primary} /> : primary}
    </span>
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

  // A role's location sits under its title and company (owner, 2026-10-04): with the title, not the dates.
  const below = locationBelow && showLocation;
  const titled = below ? (
    <div>
      {titleBlock}
      <p className="mt-[1pt] text-[length:var(--r-fs-small)] leading-tight text-[color:var(--r-c-date)]">{location}</p>
    </div>
  ) : (
    titleBlock
  );
  const metaLocation = showLocation && !below;

  if (!showDates && !metaLocation) return titled;

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
      {metaLocation && <span>{location}</span>}
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
        <div className="min-w-0">{titled}</div>
      </div>
    );
  }

  // "right" (default)
  return (
    <div className={rowClass}>
      <div className="min-w-0">{titled}</div>
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
  /** The entry these belong to, so a line the editor points at can be highlighted (see `highlight.tsx`). */
  entryId?: string;
  /** Or the custom section they are the points of. */
  customId?: string;
}

/**
 * `bulletGlyph: "none"` hides the marker entirely and left-aligns the text (no reserved indent).
 *
 * Blank bullets are skipped: the Content form keeps an empty row in the content
 * while it is being typed into, and a marker with nothing beside it is not
 * something a resume should print.
 */
export const EntryBullets: FC<EntryBulletsProps> = ({ items: allItems, design, entryId, customId }) => {
  // Each line keeps its index in the stored list, which is what the editor's pointers name.
  const items = allItems.map((text, index) => ({ text, index })).filter((item) => item.text.trim());
  if (items.length === 0) return null;
  const { bulletGlyph, indentBullets } = design.entries;
  const showGlyph = bulletGlyph !== "none";

  return (
    <ul className={cn("mt-[var(--r-gap-half)] flex flex-col gap-[2pt]", showGlyph && indentBullets && "pl-[14pt]")}>
      {items.map(({ text, index }) => (
        <li
          key={index}
          // What the AI tools' pick mode reads a clicked line by (PagePicker): "<entryId or customId>:<index>".
          data-resume-bullet={entryId || customId ? `${entryId ?? customId}:${index}` : undefined}
          className={cn(
            "relative text-[length:var(--r-fs-base)] leading-[var(--r-lh)] text-[color:var(--r-text)]",
            showGlyph && "flex gap-[6pt]"
          )}>
          {showGlyph && (
            <span aria-hidden className="flex-none text-[color:var(--r-c-bullet)]">
              {BULLET_GLYPH_CHAR[bulletGlyph]}
            </span>
          )}
          <BulletText entryId={entryId} customId={customId} index={index} text={text} />
        </li>
      ))}
    </ul>
  );
};
