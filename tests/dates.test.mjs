// Resume dates (app/lib/resume/dates.ts): the line an entry's date picker
// writes, how the lines resume parsers and older typed saves left behind are
// read back into the picker, and how a resume prints them in its chosen format
// ("Jan 2022", "January 2022", "01/2022").
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as print.test.mjs: Node resolves neither the `@/` alias nor an
// extensionless `./x`, so the hook maps them the way tsconfig does. The module
// under test imports types only, which is part of what this checks.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    const isPath = target.startsWith(".") || target.startsWith("file:");
    if (isPath && !/\.[cm]?[jt]sx?$/.test(target)) {
      const base = new URL(target, context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(target, context);
  },
});

const { dateFormatOf, displayDates, endsBeforeStart, formatDateRange, normalizeDates, parseDateRange, yearOptions } = await import("../app/lib/resume/dates.ts");

const at = (year, month = null) => ({ year, month });

describe("writing a picked range", () => {
  it("writes short months by default, with an en dash between the ends", () => {
    assert.equal(formatDateRange({ start: at(2022, 1), end: "present" }), "Jan 2022 – Present");
    assert.equal(formatDateRange({ start: at(2019, 9), end: at(2022, 6) }), "Sep 2019 – Jun 2022");
  });

  it("writes a year on its own when no month was picked, and a single date when there is no end", () => {
    assert.equal(formatDateRange({ start: at(2019), end: at(2022) }), "2019 – 2022");
    assert.equal(formatDateRange({ start: at(2021, 5), end: null }), "May 2021");
    assert.equal(formatDateRange({ start: null, end: "present" }), "Present");
    assert.equal(formatDateRange({ start: null, end: null }), "");
  });

  it("writes the three resume formats", () => {
    const range = { start: at(2019, 3), end: at(2022, 11) };
    assert.equal(formatDateRange(range, "short"), "Mar 2019 – Nov 2022");
    assert.equal(formatDateRange(range, "long"), "March 2019 – November 2022");
    assert.equal(formatDateRange(range, "numeric"), "03/2019 – 11/2022");
    assert.equal(formatDateRange({ start: at(2020), end: "present" }, "numeric"), "2020 – Present");
  });
});

describe("reading a date line", () => {
  const reads = (raw, expected, exact = true) => {
    const parsed = parseDateRange(raw);
    assert.ok(parsed, `${raw} should read`);
    assert.equal(formatDateRange(parsed.range), expected, raw);
    assert.equal(parsed.exact, exact, `${raw} exact`);
  };

  it("reads its own lines back", () => {
    for (const line of ["Jan 2022 – Present", "Sep 2019 – Jun 2022", "2019 – 2022", "May 2021", "Present"]) reads(line, line);
  });

  it("reads what resume parsers write", () => {
    reads("Mar 2022 – present", "Mar 2022 – Present");
    reads("2010–2014", "2010 – 2014");
    reads("2019-2022", "2019 – 2022");
    reads("01/2020 - current", "Jan 2020 – Present");
    reads("2020-03 to 2021-11", "Mar 2020 – Nov 2021");
    reads("January 2018 - December 2019", "Jan 2018 – Dec 2019");
    reads("Sept. 2017 – Feb. 2018", "Sep 2017 – Feb 2018");
    reads("Jun 15, 2020 - Aug 30, 2021", "Jun 2020 – Aug 2021");
    reads("Jan '19 – Mar '21", "Jan 2019 – Mar 2021");
    reads("2019/2020", "2019 – 2020");
    reads("June 2021 – Now", "Jun 2021 – Present");
    reads("2015 to date", "2015 – Present");
    reads("Since 2020", "2020 – Present");
    reads("Jan 2020 - Present · 3 yrs 2 mos", "Jan 2020 – Present");
    reads("15/03/2020 - 30/06/2021", "Mar 2020 – Jun 2021");
  });

  it("gives a month with no year the other end's", () => {
    reads("Jan – Mar 2020", "Jan 2020 – Mar 2020");
    reads("Nov – Feb 2021", "Nov 2020 – Feb 2021");
    reads("Nov 2020 – Feb", "Nov 2020 – Feb 2021");
  });

  it("reads what it can of a line that says more, but does not call it exact", () => {
    reads("2019 – 2020 (expected)", "2019 – 2020", false);
    reads("Summer 2019", "2019", false);
    // Month first, the US way, but it could be April.
    reads("03/04/2020", "Mar 2020", false);
  });

  it("reads nothing from a line with no range in it", () => {
    for (const raw of ["", "   ", null, undefined, "Spring", "Jan 2019 – Mar 2020, Jun 2021 – Present", "Present – 2020", "3000", "Jan – Mar"]) {
      assert.equal(parseDateRange(raw), null, String(raw));
    }
  });

  it("does not take a month from inside a word", () => {
    assert.equal(parseDateRange("Marketing 2020").exact, false);
    assert.deepEqual(parseDateRange("Marketing 2020").range, { start: at(2020), end: null });
  });
});

describe("normalising and printing a stored line", () => {
  it("normalises a line it reads in full and keeps any other as written", () => {
    assert.equal(normalizeDates("01/2020 - current"), "Jan 2020 – Present");
    assert.equal(normalizeDates("  Summer 2019 "), "Summer 2019");
    assert.equal(normalizeDates(""), "");
  });

  it("prints in the resume's format, and an unreadable line as written", () => {
    assert.equal(displayDates("Jan 2022 – Present", "long"), "January 2022 – Present");
    assert.equal(displayDates("Jan 2022 – Mar 2024", "numeric"), "01/2022 – 03/2024");
    assert.equal(displayDates("2019–2022", "short"), "2019 – 2022");
    assert.equal(displayDates("Summer 2019", "long"), "Summer 2019");
    assert.equal(displayDates(undefined, "short"), "");
  });
});

describe("the resume's date format", () => {
  it("keeps today's ids and maps the ones the Document panel stored before it did anything", () => {
    assert.equal(dateFormatOf("short"), "short");
    assert.equal(dateFormatOf("long"), "long");
    assert.equal(dateFormatOf("numeric"), "numeric");
    // The old default, saved by every design that never touched it: the new default.
    assert.equal(dateFormatOf("mm-yyyy"), "short");
    assert.equal(dateFormatOf("month-yyyy"), "long");
    assert.equal(dateFormatOf("mm-dd-yyyy"), "numeric");
    assert.equal(dateFormatOf(42), "short");
  });
});

describe("the picker's rules", () => {
  it("knows an end before its start", () => {
    assert.equal(endsBeforeStart({ start: at(2022, 5), end: at(2021, 9) }), true);
    assert.equal(endsBeforeStart({ start: at(2022, 5), end: at(2022, 4) }), true);
    assert.equal(endsBeforeStart({ start: at(2022, 5), end: at(2022, 5) }), false);
    assert.equal(endsBeforeStart({ start: at(2022), end: at(2022, 1) }), false);
    assert.equal(endsBeforeStart({ start: at(2022, 5), end: "present" }), false);
  });

  it("offers years newest first, back to 1950, and keeps a saved year that falls outside", () => {
    const years = yearOptions();
    const thisYear = new Date().getFullYear();
    assert.equal(years[0], thisYear + 10);
    assert.equal(years.at(-1), 1950);
    assert.ok(yearOptions([1942]).includes(1942));
    assert.equal(yearOptions([1942]).at(-1), 1942);
    assert.equal(yearOptions([2001]).length, years.length);
  });
});
