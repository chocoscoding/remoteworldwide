// Resume dates: the one place an entry's date line is read, written and shown.
//
// An entry keeps its dates as ONE string — "Jan 2022 – Present" — on the profile
// (`profile.experience[].dates`, `profile.education[].dates`) and in a resume's
// content (`experience[].dates`, `education[].dates`, `certifications[].year`).
// The builder, job-ask and the backend all read that string as text, so it
// stays the stored shape. What changed (owner, 2026-10-03) is how it gets
// there and how it prints:
//
//   - it is PICKED, never typed: a month and a year for the start, a month and
//     a year — or "Present" — for the end (`DateRangeField`);
//   - the picker writes it in one canonical form, short months ("Jan 2022");
//   - a resume prints it in the format its Document settings choose:
//     "Jan 2022", "January 2022" or "01/2022" (`displayDates`).
//
// `parseDateRange` reads what a resume parser or an older, typed save left
// behind ("01/2020 - current", "2019–2022", "Mar 2022 – present"). A line it
// cannot read IN FULL ("Summer 2019", "2019 – 2020 (expected)", the ambiguous
// "03/04/2020") is never rewritten behind anyone's back: it prints as written,
// and the picker shows it and offers to replace it.
//
// Pure, with type-only imports: `tests/dates.test.mjs` and the onboarding
// tests run it (and `app/lib/onboarding/profile.ts`, which imports it) under
// plain `node --test`.

import type { DateFormatId } from "@/app/lib/dashboard/resume/design-types";

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** What an entry that is still going on ends with. */
export const PRESENT = "Present";

/** Between a start and an end, in every format. */
export const RANGE_DASH = " – ";

export interface MonthYear {
  year: number;
  /** 1–12, or null for a year on its own ("2019 – 2022"). */
  month: number | null;
}

export interface DateRange {
  start: MonthYear | null;
  /** "present" while it is still going on; null for a single date (a graduation, a certificate). */
  end: MonthYear | "present" | null;
}

export interface ParsedDates {
  range: DateRange;
  /**
   * False when the line said more than a range can hold ("Summer", "(expected)") or could be read
   * two ways (is 03/04/2020 March or April?). Such a line is kept as written.
   */
  exact: boolean;
}

const THIS_YEAR = new Date().getFullYear();

/** The years a picker offers: ten ahead (an expected graduation, a certificate's expiry) back to this. */
const EARLIEST_YEAR = 1950;

/**
 * A stored design's date format as one of today's three. The option was on the Document panel long
 * before it did anything, so every saved design states one of the old ids — mostly "mm-yyyy", the
 * old default. They map by intent: the untouched default to the new default (short months),
 * "Month YYYY" to long months, and "MM/DD/YYYY", which someone had to choose, to numbers.
 */
export function dateFormatOf(value: unknown): DateFormatId {
  switch (value) {
    case "short":
    case "long":
    case "numeric":
      return value;
    case "month-yyyy":
      return "long";
    case "mm-dd-yyyy":
      return "numeric";
    default:
      return "short";
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function formatPoint(point: MonthYear, style: DateFormatId): string {
  if (point.month === null) return String(point.year);
  if (style === "numeric") return `${String(point.month).padStart(2, "0")}/${point.year}`;
  return `${(style === "long" ? MONTHS_LONG : MONTHS_SHORT)[point.month - 1]} ${point.year}`;
}

/** A range as text: "Jan 2022 – Present", "January 2019 – March 2022", "01/2022", "2019 – 2022". Empty for an empty range. */
export function formatDateRange(range: DateRange, style: DateFormatId = "short"): string {
  const parts: string[] = [];
  if (range.start) parts.push(formatPoint(range.start, style));
  if (range.end === "present") parts.push(PRESENT);
  else if (range.end) parts.push(formatPoint(range.end, style));
  return parts.join(RANGE_DASH);
}

/** Whether the end comes before the start — which the picker's own options prevent, but a start moved later can still cause. */
export function endsBeforeStart(range: DateRange): boolean {
  const { start, end } = range;
  if (!start || !end || end === "present") return false;
  if (end.year !== start.year) return end.year < start.year;
  return start.month !== null && end.month !== null && end.month < start.month;
}

/** The years a picker offers, newest first, plus any of `keep` (a saved date) that falls outside them. */
export function yearOptions(keep: readonly (number | null | undefined)[] = []): number[] {
  const years: number[] = [];
  for (let year = THIS_YEAR + 10; year >= EARLIEST_YEAR; year -= 1) years.push(year);
  const extra = keep.filter((year): year is number => typeof year === "number" && !years.includes(year));
  return [...years, ...extra].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const MONTH_WORD = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const MONTH_KEYS = MONTHS_SHORT.map((month) => month.toLowerCase());
/** Only years a resume could mean; "3000" or "1234" is left over, and the line is kept as written. */
const YEAR = "(?:19|20)\\d{2}";
const MONTH_NUMBER = "0?[1-9]|1[0-2]";

/**
 * One date in a line, in the shapes resumes and parsers write them. Tried left to right at each
 * position, so "2020-03" is a month before it is a year, and "Mar 2022" one date, not two.
 */
const TOKEN = new RegExp(
  [
    // 2020-03, 2020/03, 2020-03-15
    `\\b(?<isoY>${YEAR})[-/.](?<isoM>${MONTH_NUMBER})(?:[-/.]\\d{1,2})?\\b`,
    // 03/15/2020 or 15/03/2020
    `\\b(?<dA>\\d{1,2})[-/.](?<dB>\\d{1,2})[-/.](?<dY>${YEAR})\\b`,
    // 03/2020, 3.2020
    `\\b(?<nM>${MONTH_NUMBER})[-/.](?<nY>${YEAR})\\b`,
    // Mar 2022, March, 2022, Mar. 15, 2022, Jan '19 — or a month alone ("Jan – Mar 2020")
    `\\b(?<word>${MONTH_WORD})\\b\\.?(?:\\s+\\d{1,2}(?:st|nd|rd|th)?\\b)?,?\\s*(?:(?<wY>${YEAR})\\b|['’](?<wY2>\\d{2})\\b)?`,
    `\\b(?<present>present|current(?:ly)?|now|ongoing|today|date)\\b`,
    // '19
    `['’](?<y2>\\d{2})\\b`,
    `\\b(?<y>${YEAR})\\b`,
  ].join("|"),
  "gi",
);

/** "(2 yrs 3 mos)", "· 11 months": a length worked out from the dates, which a range does not need. */
const DURATION = /\(?\s*\d+\+?\s*(?:yrs?|years?)\b(?:\s*,?\s*\d+\s*(?:mos?|months?)\b)?\s*\)?|\(?\s*\d+\s*(?:mos?|months?)\b\s*\)?/gi;

/** Words between dates that say nothing a range does not. "since" and "from" before a lone date mean it is still going on. */
const FILLER = /\b(?:to|till|til|until|through|thru|from|since|and|onwards?)\b/gi;
const OPEN_ENDED = /^(?:since|from|onwards?)$/i;

/** All that may be left of a line once its dates and filler words are out. */
const ONLY_SEPARATORS = /^[\s\-–—~→/,.()|:·•+&'’]*$/;

type Point = { year: number | null; month: number | null };
type Token = { kind: "date"; point: Point; ambiguous: boolean } | { kind: "present" };

/** '19 -> 2019, '85 -> 1985: a two-digit year is the nearest one, up to ten years ahead. */
const fullYear = (twoDigits: string): number => {
  const value = Number(twoDigits);
  return value <= (THIS_YEAR % 100) + 10 ? 2000 + value : 1900 + value;
};

function tokenOf(groups: Record<string, string | undefined>): Token | null {
  const date = (year: number | null, month: number | null, ambiguous = false): Token => ({ kind: "date", point: { year, month }, ambiguous });
  if (groups.isoY) return date(Number(groups.isoY), Number(groups.isoM));
  if (groups.dY) {
    const a = Number(groups.dA);
    const b = Number(groups.dB);
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12) return date(Number(groups.dY), a, a !== b);
    if (a >= 1 && a <= 12) return date(Number(groups.dY), a);
    if (b >= 1 && b <= 12) return date(Number(groups.dY), b);
    return null;
  }
  if (groups.nY) return date(Number(groups.nY), Number(groups.nM));
  if (groups.word) {
    const month = MONTH_KEYS.indexOf(groups.word.slice(0, 3).toLowerCase()) + 1;
    const year = groups.wY ? Number(groups.wY) : groups.wY2 ? fullYear(groups.wY2) : null;
    return date(year, month);
  }
  if (groups.present) return { kind: "present" };
  if (groups.y2) return date(fullYear(groups.y2), null);
  if (groups.y) return date(Number(groups.y), null);
  return null;
}

/**
 * A date line as a range, or null when it holds no range at all (nothing that reads as a date,
 * three or more dates, a month that never gets a year). `exact` says whether the range is ALL the
 * line said.
 *
 * A month with no year borrows the other end's: "Jan – Mar 2020" is Jan 2020 – Mar 2020, and
 * "Nov – Feb 2021" is Nov 2020 – Feb 2021. "Since 2020" is 2020 – Present. A numeric date with both
 * parts 12 or under (03/04/2020) is read month first, the US way, but is not exact.
 */
export function parseDateRange(raw: string | null | undefined): ParsedDates | null {
  const text = (raw ?? "").replace(DURATION, " ").trim();
  if (!text) return null;

  const tokens: Token[] = [];
  let exact = true;
  let rest = "";
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const token = tokenOf(match.groups ?? {});
    if (!token) return null;
    if (token.kind === "date" && token.ambiguous) exact = false;
    tokens.push(token);
    rest += `${text.slice(last, match.index)} `;
    last = match.index + match[0].length;
  }
  rest += text.slice(last);
  if (tokens.length === 0 || tokens.length > 2) return null;

  let openEnded = false;
  const leftover = rest.replace(FILLER, (word) => {
    if (OPEN_ENDED.test(word)) openEnded = true;
    return " ";
  });
  if (!ONLY_SEPARATORS.test(leftover)) exact = false;

  const [first, second] = tokens;
  if (first.kind === "present") return second ? null : { range: { start: null, end: "present" }, exact };

  const from = first.point;
  const to: Point | "present" | null = second ? (second.kind === "present" ? "present" : second.point) : openEnded ? "present" : null;
  const toDate = to === "present" ? null : to;
  // Nov – Feb: the end is in the next year.
  const turnsYear = toDate !== null && from.month !== null && toDate.month !== null && from.month > toDate.month ? 1 : 0;

  // A month with no year borrows the other end's.
  const startYear = from.year ?? (toDate && toDate.year !== null ? toDate.year - turnsYear : null);
  if (startYear === null) return null;
  const end: DateRange["end"] = toDate ? { year: toDate.year ?? startYear + turnsYear, month: toDate.month } : to === "present" ? "present" : null;

  return { range: { start: { year: startYear, month: from.month }, end }, exact };
}

/**
 * A date line in the canonical short form when it reads in full ("01/2020 - current" ->
 * "Jan 2020 – Present"); as written, trimmed, when it does not. What a parsed resume's dates
 * become on the profile, so they arrive the way the picker would have written them.
 */
export function normalizeDates(raw: string | null | undefined): string {
  const parsed = parseDateRange(raw);
  return parsed?.exact ? formatDateRange(parsed.range) : (raw ?? "").trim();
}

/** A stored date line as a resume prints it, in the resume's format; a line that does not read in full, as written. */
export function displayDates(raw: string | null | undefined, style: DateFormatId): string {
  const parsed = parseDateRange(raw);
  return parsed?.exact ? formatDateRange(parsed.range, style) : (raw ?? "").trim();
}
