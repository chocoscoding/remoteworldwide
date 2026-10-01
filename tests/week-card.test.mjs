// The week card's words (app/lib/dashboard/week-card.ts): the date range, the
// tiles, the line under them and the caption that goes out with the image. The
// Monday mail (remoteworldwideevents userWeekReport.ts) says the same things.
//
//   npm test        (node --test --experimental-strip-types tests/)

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

const { hasWeekToShare, weekCaption, weekEyebrow, weekRangeLabel, weekStreakLine, weekTiles } = await import("../app/lib/dashboard/week-card.ts");

const LINK = "https://www.remoteworldwide.net/j/ada";

const week = (over = {}) => ({
  weekStart: "2026-09-21",
  weekEnd: "2026-09-27",
  partial: false,
  applied: 7,
  interviews: 2,
  offers: 1,
  activeDays: 5,
  streak: 5,
  ...over,
});

describe("the week card", () => {
  it("dates the week from its keys, across a month when it has to", () => {
    assert.equal(weekRangeLabel(week()), "21–27 Sep");
    assert.equal(weekRangeLabel(week({ weekStart: "2026-09-28", weekEnd: "2026-10-04" })), "28 Sep – 4 Oct");
    assert.equal(weekRangeLabel(week({ weekStart: "2026-09-28", weekEnd: "2026-09-28" })), "28 Sep");
    assert.equal(weekEyebrow(week()), "Last week");
    assert.equal(weekEyebrow(week({ partial: true })), "This week");
  });

  it("labels the tiles in the singular for one", () => {
    assert.deepEqual(weekTiles(week()), [
      { n: 7, label: "Applied" },
      { n: 2, label: "Interviews" },
      { n: 1, label: "Offer" },
    ]);
    assert.deepEqual(
      weekTiles(week({ interviews: 1, offers: 0 })).map((t) => t.label),
      ["Applied", "Interview", "Offers"],
    );
  });

  it("shows the streak while there is one, else the days that counted", () => {
    assert.deepEqual(weekStreakLine(week()), { flame: true, text: "5-day streak" });
    assert.deepEqual(weekStreakLine(week({ streak: 0, activeDays: 1 })), { flame: false, text: "1 active day" });
    assert.equal(hasWeekToShare(week({ activeDays: 0 })), false);
    assert.equal(hasWeekToShare(null), false);
    assert.equal(hasWeekToShare(week()), true);
  });

  it("captions only what happened, with the invite link tagged per network", () => {
    assert.equal(
      weekCaption(week(), LINK),
      `My job search last week: 7 applications, 2 interviews and 1 offer, and a 5-day streak \u{1F525}. Tracking it all on Remote Worldwide — if you're searching too: ${LINK}`,
    );
    const quiet = weekCaption(week({ partial: true, applied: 1, interviews: 0, offers: 0, streak: 0 }), LINK, "whatsapp");
    assert.match(quiet, /^My job search this week so far: 1 application\. /);
    assert.match(quiet, /utm_source=whatsapp&utm_medium=weekcard/);
    assert.match(weekCaption(week({ applied: 0, interviews: 0, offers: 0, activeDays: 3, streak: 3 }), LINK), /: 3 active days, and a 3-day streak/);
  });
});
