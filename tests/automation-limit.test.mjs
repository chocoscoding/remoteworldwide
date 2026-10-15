// The automation page's per-run cap (app/lib/automation/limit.ts): what the admin may set, and that
// the trigger route checks it and hands it to the bot.
//
//   npm test        (node --test --experimental-strip-types tests/)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const { DEFAULT_POST_LIMIT, MAX_POST_LIMIT, parsePostLimit } = await import("../app/lib/automation/limit.ts");

describe("parsePostLimit", () => {
  it("defaults to 2 when no limit is sent", () => {
    assert.equal(DEFAULT_POST_LIMIT, 2);
    assert.equal(parsePostLimit(undefined), 2);
    assert.equal(parsePostLimit(null), 2);
    assert.equal(parsePostLimit(""), 2);
  });

  it("takes a whole number from 1 to the maximum, as a number or as typed", () => {
    assert.equal(parsePostLimit(1), 1);
    assert.equal(parsePostLimit(5), 5);
    assert.equal(parsePostLimit("7"), 7);
    assert.equal(parsePostLimit(MAX_POST_LIMIT), MAX_POST_LIMIT);
  });

  it("refuses anything else", () => {
    for (const value of [0, -1, 2.5, MAX_POST_LIMIT + 1, "abc", "2.5", "1e1", NaN, [2], {}]) {
      assert.equal(parsePostLimit(value), null, `expected ${JSON.stringify(value)} to be refused`);
    }
  });
});

describe("the trigger route", () => {
  const route = readFileSync(new URL("../app/api/admin/automation/trigger/route.ts", import.meta.url), "utf8");

  it("checks the limit and passes it to the bot", () => {
    assert.match(route, /parsePostLimit\(/);
    assert.match(route, /[?&]limit=\$\{limit\}/);
  });

  it("still refuses a non-admin before anything else", () => {
    assert.ok(route.indexOf("requireAdmin()") < route.indexOf("parsePostLimit("));
  });
});
