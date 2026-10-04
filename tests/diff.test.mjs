// Which words a tone fix changes (app/lib/resume/diff.ts): the ranges the paper underlines in red.
//
//   npm test        (node --test --experimental-strip-types tests/)

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { changedRanges, splitAt } = await import("../app/lib/resume/diff.ts");

const underlined = (before, after) => changedRanges(before, after).map(([s, e]) => before.slice(s, e));

describe("what a fix changes", () => {
  it("is the misspelled word", () => {
    assert.deepEqual(underlined("Platform engineer runing payments infrastructure.", "Platform engineer running payments infrastructure."), ["runing"]);
  });

  it("is a run of changed words, merged across the space between them", () => {
    assert.deepEqual(underlined("Was responsible for building the API", "Built the API"), ["Was responsible for building"]);
  });

  it("is each change where there are several, in order", () => {
    assert.deepEqual(underlined("Leaded the team and manage releases", "Led the team and managed releases"), ["Leaded", "manage"]);
  });

  it("is the word beside an addition that replaced nothing", () => {
    assert.deepEqual(underlined("Shipped features fast", "Shipped features fast and safely"), ["fast"]);
  });

  it("is the whole of a one-word line that changed case", () => {
    assert.deepEqual(underlined("Typescript", "TypeScript"), ["Typescript"]);
  });

  it("is nothing when nothing changed", () => {
    assert.deepEqual(changedRanges("Same line", "Same line"), []);
  });
});

describe("cutting a line at its ranges", () => {
  it("keeps every character, in order", () => {
    const line = "Leaded the team and manage releases";
    const runs = splitAt(line, changedRanges(line, "Led the team and managed releases"));
    assert.equal(runs.map((r) => r.text).join(""), line);
    assert.deepEqual(runs.filter((r) => r.changed).map((r) => r.text), ["Leaded", "manage"]);
  });
});
