// The admin waitlist screen (/heroshima/waitlist): picking rows, Gmail's
// "select all N waiting signups", the grant request that comes out of it, the
// body the server action passes on, and the words on the screen
// (app/lib/waitlist/admin.ts). The server actions themselves (libs/waitlist-admin.ts)
// import next/cache and next/headers, so they are checked in their source: each
// export refuses a non-admin before anything else, and forwards the admin's session.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as week-card.test.mjs.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

const {
  NO_SELECTION,
  formatDay,
  grantBody,
  grantButtonLabel,
  grantConfirmCopy,
  grantHeadline,
  grantRequestFor,
  grantSummary,
  grantTimeline,
  nextSelection,
  planLabel,
  selectionView,
  waitingMatching,
} = await import("../app/lib/waitlist/admin.ts");

const row = (id, status = "waiting") => ({ id, status });
// A page of five: three waiting, two already granted.
const PAGE = [row("a"), row("b", "granted"), row("c"), row("d", "active"), row("e")];
const WAITING = 12;

const run = (...actions) => actions.reduce((state, action) => nextSelection(state, action, PAGE, WAITING), NO_SELECTION);
const ids = (state) => selectionView(state, PAGE, WAITING).selectedIds;

describe("picking rows", () => {
  it("only picks rows still waiting", () => {
    assert.deepEqual(ids(run({ type: "row", id: "a" })), ["a"]);
    assert.deepEqual(ids(run({ type: "row", id: "b" })), []);
    assert.deepEqual(ids(run({ type: "row", id: "nope" })), []);
    assert.deepEqual(ids(run({ type: "row", id: "a" }, { type: "row", id: "a" })), []);
  });

  it("the header box picks every waiting row on the page, then nothing", () => {
    const all = run({ type: "page" });
    assert.deepEqual(ids(all), ["a", "c", "e"]);
    const view = selectionView(all, PAGE, WAITING);
    assert.equal(view.allOnPage, true);
    assert.equal(view.someOnPage, false);
    assert.equal(view.count, 3);
    assert.deepEqual(ids(nextSelection(all, { type: "page" }, PAGE, WAITING)), []);
    // From a partial pick it fills the page rather than clearing it.
    assert.deepEqual(ids(run({ type: "row", id: "c" }, { type: "page" })), ["a", "c", "e"]);
    assert.equal(selectionView(run({ type: "row", id: "c" }), PAGE, WAITING).someOnPage, true);
  });

  it("offers every waiting signup once the page is full, and only when there are more", () => {
    assert.equal(selectionView(run({ type: "row", id: "a" }), PAGE, WAITING).offerEvery, false);
    assert.equal(selectionView(run({ type: "page" }), PAGE, WAITING).offerEvery, true);
    assert.equal(selectionView(run({ type: "page" }), PAGE, 3).offerEvery, false);
    // Refused unless the page is full first.
    assert.equal(run({ type: "every" }).everyWaiting, false);
  });

  it("selects every waiting signup, counting them all, and drops back like Gmail when one is unticked", () => {
    const every = run({ type: "page" }, { type: "every" });
    const view = selectionView(every, PAGE, WAITING);
    assert.equal(view.everyWaiting, true);
    assert.equal(view.count, 12);
    assert.equal(view.offerEvery, false);
    assert.deepEqual(view.selectedIds, ["a", "c", "e"]);

    const dropped = nextSelection(every, { type: "row", id: "c" }, PAGE, WAITING);
    assert.equal(dropped.everyWaiting, false);
    assert.deepEqual(ids(dropped), ["a", "e"]);

    assert.deepEqual(nextSelection(every, { type: "page" }, PAGE, WAITING), NO_SELECTION);
    assert.deepEqual(nextSelection(every, { type: "clear" }, PAGE, WAITING), NO_SELECTION);
  });

  it("forgets a pick that stopped waiting, as after the refresh that follows a grant", () => {
    const picked = run({ type: "row", id: "a" }, { type: "row", id: "c" });
    const refreshed = [row("a", "granted"), row("b", "granted"), row("c"), row("d", "active"), row("e")];
    assert.deepEqual(selectionView(picked, refreshed, WAITING).selectedIds, ["c"]);
  });

  it("has nothing to pick on a page with nobody waiting", () => {
    const granted = [row("x", "granted"), row("y", "ended")];
    const view = selectionView(nextSelection(NO_SELECTION, { type: "page" }, granted, 0), granted, 0);
    assert.equal(view.allOnPage, false);
    assert.equal(view.count, 0);
  });
});

describe("what a grant sends", () => {
  it("names the rows picked, or every waiting signup matching the search", () => {
    assert.equal(grantRequestFor(selectionView(NO_SELECTION, PAGE, WAITING), ""), null);
    assert.deepEqual(grantRequestFor(selectionView(run({ type: "row", id: "e" }, { type: "row", id: "a" }), PAGE, WAITING), "x"), { ids: ["a", "e"] });
    const every = selectionView(run({ type: "page" }, { type: "every" }), PAGE, WAITING);
    assert.deepEqual(grantRequestFor(every, "  @acme.com "), { all: true, q: "@acme.com" });
    assert.deepEqual(grantRequestFor(every, ""), { all: true });
  });

  it("counts 'select all' from the Waiting tab's own total, or the Waiting count elsewhere", () => {
    const list = { total: 40, counts: { all: 40, waiting: 31, granted: 4, active: 3, ended: 1, skipped: 1 } };
    assert.equal(waitingMatching("waiting", { ...list, total: 31 }), 31);
    assert.equal(waitingMatching("all", list), 31);
  });

  it("passes on only the two known shapes, whatever the action was handed", () => {
    assert.deepEqual(grantBody({ ids: ["a", " a ", "b"], extra: 1 }), { ids: ["a", "b"] });
    assert.deepEqual(grantBody({ all: true, q: " x ", ids: ["a"] }), { all: true, q: "x" });
    assert.deepEqual(grantBody({ all: true, q: 42 }), { all: true });
    assert.equal(typeof grantBody({ all: "true" }), "string");
    assert.equal(typeof grantBody({ ids: [] }), "string");
    assert.equal(typeof grantBody({ ids: ["a", 1] }), "string");
    assert.equal(typeof grantBody(null), "string");
    assert.equal(typeof grantBody({ ids: Array.from({ length: 501 }, (_, i) => `id${i}`) }), "string");
    assert.equal(grantBody({ ids: Array.from({ length: 500 }, (_, i) => `id${i}`) }).ids.length, 500);
  });
});

describe("the words", () => {
  it("says exactly what happens before the click", () => {
    assert.equal(grantButtonLabel(12), "Give Pro for 1 month + 100 credits (12)");
    assert.equal(
      grantConfirmCopy(12),
      "12 people get Pro for a month with 100 credits. Those with an account start now; the rest start when they sign up. Each gets an email.",
    );
    assert.match(grantConfirmCopy(1), /^1 person gets Pro/);
    assert.equal(grantButtonLabel(1234), "Give Pro for 1 month + 100 credits (1,234)");
  });

  it("sums up the result in the order the admin reads it", () => {
    const result = { granted: 10, applied: 4, pending: 5, skipped: 1, alreadyGranted: 2 };
    assert.equal(grantHeadline(result), "10 people granted Pro for a month.");
    assert.equal(grantHeadline({ ...result, granted: 0 }), "Nobody new was granted.");
    assert.deepEqual(
      grantSummary(result).map(({ label, value }) => `${label}: ${value}`),
      ["Granted: 10", "Started now: 4", "Waits for sign-up: 5", "Skipped, already on a paid plan: 1", "Already granted before: 2"],
    );
  });

  it("dates in UTC, so the server and the browser agree", () => {
    assert.equal(formatDay("2026-10-01T23:30:00.000Z"), "1 Oct 2026");
    assert.equal(formatDay(new Date("2026-10-01T00:10:00.000Z")), "1 Oct 2026");
    assert.equal(formatDay(null), "-");
    assert.equal(formatDay("not a date"), "-");
  });

  it("names the plan they eyed, yearly when it was", () => {
    assert.equal(planLabel({ plan: "pro", billing: "year" }), "Pro · yearly");
    assert.equal(planLabel({ plan: "basic", billing: "month" }), "Basic");
    assert.equal(planLabel({ plan: null, billing: null }), "-");
  });

  it("dates the Pro month as far as it goes", () => {
    const base = { grantedAt: "2026-10-01T10:00:00Z", appliedAt: null, endsAt: null, hasAccount: false, note: null };
    assert.deepEqual(grantTimeline({ ...base, status: "waiting", grantedAt: null }), []);
    assert.deepEqual(grantTimeline({ ...base, status: "granted" }), ["Granted 1 Oct 2026", "Starts when they sign up"]);
    assert.deepEqual(grantTimeline({ ...base, status: "granted", hasAccount: true }), ["Granted 1 Oct 2026", "Starts when they verify their email"]);
    assert.deepEqual(grantTimeline({ ...base, status: "active", appliedAt: "2026-10-02T09:00:00Z", endsAt: "2026-11-02T09:00:00Z" }), [
      "Started 2 Oct 2026",
      "Ends 2 Nov 2026",
    ]);
    assert.deepEqual(grantTimeline({ ...base, status: "ended", appliedAt: "2026-08-02T09:00:00Z", endsAt: "2026-09-02T09:00:00Z" }), [
      "Started 2 Aug 2026",
      "Ended 2 Sep 2026",
    ]);
    assert.deepEqual(grantTimeline({ ...base, status: "skipped", note: "Already on a paid plan" }), ["Granted 1 Oct 2026", "Already on a paid plan"]);
  });
});

describe("the server actions", () => {
  const source = readFileSync(new URL("libs/waitlist-admin.ts", ROOT), "utf8");

  it("is a server-action module that forwards the admin's session to /waitlist/admin", () => {
    assert.match(source, /^"use server";/);
    assert.match(source, /backend<T>\(`\/waitlist\/admin\$\{path\}`, \{ \.\.\.init, session: true \}\)/);
    assert.match(source, /revalidatePath\(SCREEN\)/);
    assert.match(source, /const SCREEN = "\/heroshima\/waitlist";/);
  });

  it("refuses a non-admin first, in every export", () => {
    const exports = [...source.matchAll(/^export const (\w+) = async \([^)]*\)[^{]*\{\n(.*)$/gm)];
    assert.deepEqual(
      exports.map((m) => m[1]),
      ["listWaitlist", "grantWaitlist"],
    );
    for (const [, name, firstLine] of exports) assert.equal(firstLine.trim(), "await requireAdminAction();", name);
    // Nothing else is exported as a value: every export of a "use server" file is a public endpoint.
    assert.deepEqual([...source.matchAll(/^export (?!const \w+ = async|interface|type)/gm)], []);
  });
});
