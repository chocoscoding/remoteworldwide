"use client";

// An entry's dates, picked rather than typed (owner, 2026-10-03): a month and a
// year to start, and a month and a year — or "Present" — to end. Shared by the
// resume editor's Experience, Education and Certifications and by the profile's
// work experience and education (onboarding and Settings → Profile), so a date
// reads the same everywhere it is entered.
//
// The value stays the one string every reader already takes ("Jan 2022 –
// Present"), written by `formatDateRange` in short months; how a resume PRINTS
// it is the resume's own Date format (`displayDates`). Months are optional, so
// "2019 – 2022" is a range too; an empty end is a single date (a graduation, a
// certificate).
//
// A choice the string cannot hold yet — a month still waiting for its year —
// lives in the field's own draft. The draft is kept for as long as the value is
// the one this field last wrote; any other value (a resume filled in, another
// document opened) is read afresh.
//
// A saved line this cannot read in full ("Summer 2019", "2019 – 2020
// (expected)") is left alone until someone picks: the field shows it as
// written, with whatever it could read already in the dropdowns, and offers to
// use those or to clear it.

import { useState, type FC, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { endsBeforeStart, formatDateRange, MONTHS_SHORT, parseDateRange, yearOptions, type DateRange } from "@/app/lib/resume/dates";
import { FIELD_CLASS, FIELD_TONE } from "./FormField";

/** The four dropdowns as they stand. "" is unpicked; the end month may also be "present". */
interface Draft {
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
}

const BLANK: Draft = { startMonth: "", startYear: "", endMonth: "", endYear: "" };

const text = (value: number | null | undefined): string => (typeof value === "number" ? String(value) : "");

function draftOf(range: DateRange | null): Draft {
  if (!range) return BLANK;
  const { start, end } = range;
  return {
    startMonth: text(start?.month),
    startYear: text(start?.year),
    endMonth: end === "present" ? "present" : text(end?.month),
    endYear: end === "present" ? "" : text(end?.year),
  };
}

/** What the draft says, as far as it is complete: a month with no year is not a date yet. */
function rangeOf(draft: Draft): DateRange {
  const point = (month: string, year: string) => (year ? { year: Number(year), month: month ? Number(month) : null } : null);
  return {
    start: point(draft.startMonth, draft.startYear),
    end: draft.endMonth === "present" ? "present" : point(draft.endMonth, draft.endYear),
  };
}

// A dropdown takes the width it is given, not its widest option's ("Present",
// "Month"), so the four share one row. 13px and slim side padding are what let
// "Month" and "2026" fit a 314px card, the narrowest the editor's Content
// column gets on a laptop.
const DateSelect: FC<SelectHTMLAttributes<HTMLSelectElement> & { isActive: boolean; wrapClassName?: string; children: ReactNode }> = ({
  isActive,
  className,
  wrapClassName,
  value,
  children,
  ...rest
}) => (
  <span className={cn("relative flex min-w-0 flex-1", wrapClassName)}>
    <select
      value={value}
      className={cn(
        FIELD_CLASS,
        "w-full min-w-0 cursor-pointer appearance-none pl-2 pr-[22px] text-[13px]",
        isActive ? FIELD_TONE.active : FIELD_TONE.idle,
        // The unpicked option reads as a placeholder, like an empty text field's.
        value === "" && "text-black/45",
        className,
      )}
      {...rest}>
      {children}
    </select>
    <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-black/45" />
  </span>
);

/** Options inherit the select's colour in some browsers; the open list always reads in ink. */
const OPTION = "text-primary";

export interface DateRangeFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Names the group to a screen reader: "Dates", "Dates for Designer at Kite Labs". */
  label?: string;
  isActive?: boolean;
  className?: string;
}

const DateRangeField: FC<DateRangeFieldProps> = ({ value, onChange, label = "Dates", isActive = false, className }) => {
  const [state, setState] = useState(() => ({ value, draft: draftOf(parseDateRange(value)?.range ?? null) }));
  let draft = state.draft;
  if (value !== state.value) {
    draft = draftOf(parseDateRange(value)?.range ?? null);
    setState({ value, draft });
  }

  const parsed = parseDateRange(value);
  // A saved line the dropdowns cannot show in full, waiting to be replaced.
  const written = value.trim() && !parsed?.exact ? value.trim() : null;
  const range = rangeOf(draft);
  const years = yearOptions([range.start?.year, range.end === "present" ? null : range.end?.year]);
  const startYear = range.start?.year ?? null;
  const startMonth = range.start?.month ?? null;
  const endYear = draft.endYear ? Number(draft.endYear) : null;

  const commit = (next: Draft) => {
    const line = formatDateRange(rangeOf(next));
    setState({ value: line, draft: next });
    if (line !== value) onChange(line);
  };
  // "Present" has no year of its own.
  const pick = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    if (next.endMonth === "present") next.endYear = "";
    commit(next);
  };

  const waitingForYear = (draft.startMonth !== "" && !draft.startYear) || (draft.endMonth !== "" && draft.endMonth !== "present" && !draft.endYear);

  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 flex-col gap-1.5 [container-type:inline-size]", className)}>
      {/* One row, "Jan · 2024 to Present" (owner, 2026-10-04), on a laptop as on a tablet: from
          304px wide (the 314px card fits) it is a five-column grid, the month a little wider than
          the year as "Month" is wider than "2026", and "Present" takes the end year's column too.
          Narrower (a phone) the end wraps under the start, "to" leading it. */}
      <div className="flex w-full max-w-[440px] flex-col gap-1.5 [@container(min-width:304px)]:grid [@container(min-width:304px)]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto_minmax(0,1.15fr)_minmax(0,1fr)] [@container(min-width:304px)]:items-center [@container(min-width:304px)]:gap-x-1">
        <div className="flex min-w-0 items-center gap-1.5 [@container(min-width:304px)]:contents">
          <DateSelect aria-label="Start month" value={draft.startMonth} onChange={(e) => pick({ startMonth: e.target.value })} isActive={isActive}>
            <option value="" className={OPTION}>
              Month
            </option>
            {MONTHS_SHORT.map((month, index) => (
              <option key={month} value={String(index + 1)} className={OPTION}>
                {month}
              </option>
            ))}
          </DateSelect>
          <DateSelect aria-label="Start year" value={draft.startYear} onChange={(e) => pick({ startYear: e.target.value })} isActive={isActive}>
            <option value="" className={OPTION}>
              Year
            </option>
            {years.map((year) => (
              <option key={year} value={String(year)} className={OPTION}>
                {year}
              </option>
            ))}
          </DateSelect>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 [@container(min-width:304px)]:contents">
          <span aria-hidden className="flex-none px-0.5 text-sm text-black/45">
            to
          </span>
          {/* An end before the start is not on offer: those months and years are greyed out. */}
          <DateSelect
            aria-label="End month, or Present"
            value={draft.endMonth}
            onChange={(e) => pick({ endMonth: e.target.value })}
            isActive={isActive}
            wrapClassName={draft.endMonth === "present" ? "[@container(min-width:304px)]:col-span-2" : undefined}>
            <option value="" className={OPTION}>
              Month
            </option>
            <option value="present" className={OPTION}>
              Present
            </option>
            {MONTHS_SHORT.map((month, index) => (
              <option
                key={month}
                value={String(index + 1)}
                disabled={startYear !== null && startMonth !== null && endYear === startYear && index + 1 < startMonth}
                className={OPTION}>
                {month}
              </option>
            ))}
          </DateSelect>
          {draft.endMonth !== "present" && (
            <DateSelect aria-label="End year" value={draft.endYear} onChange={(e) => pick({ endYear: e.target.value })} isActive={isActive}>
              <option value="" className={OPTION}>
                Year
              </option>
              {years.map((year) => (
                <option key={year} value={String(year)} disabled={startYear !== null && year < startYear} className={OPTION}>
                  {year}
                </option>
              ))}
            </DateSelect>
          )}
        </div>
      </div>

      {written && (
        <p className="px-0.5 text-xs leading-snug text-black/55">
          Written as <span className="font-semibold text-primary">“{written}”</span>.{" "}
          {parsed ? (
            <button type="button" onClick={() => commit(draft)} className="cursor-pointer font-semibold text-primary underline underline-offset-2">
              Use the dates above
            </button>
          ) : (
            "Pick the dates to replace it"
          )}{" "}
          ·{" "}
          <button type="button" onClick={() => commit(BLANK)} className="cursor-pointer font-semibold text-primary underline underline-offset-2">
            Clear
          </button>
        </p>
      )}
      {!written && endsBeforeStart(range) && <p className="px-0.5 text-xs font-semibold text-[#b23c26]">The end date is before the start.</p>}
      {!written && waitingForYear && <p className="px-0.5 text-xs text-black/55">Pick a year to go with the month.</p>}
    </div>
  );
};

export default DateRangeField;
