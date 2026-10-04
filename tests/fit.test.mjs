// "Jobs worth watching" fit (app/lib/dashboard/fit.ts): listings are ranked by
// the user's target roles and the roles they've been applying to, and a
// listing like neither is not shown at all. Also the title matching behind
// both, the seniority bands listings use, and the searches that build the pool.
//
// Every listing and application here is SYNTHETIC.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as onboarding.test.mjs: Node resolves neither the `@/` alias nor
// an extensionless `./x`, so the hook maps them the way tsconfig does.

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

const { bandsOf, computeFit, fitSignals, recentApplications, roleTokens, searchTermsFor, titleSimilarity, watchSearchTerms } = await import(
  "../app/lib/dashboard/fit.ts"
);

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-30T12:00:00Z");
const sim = (a, b) => titleSimilarity(roleTokens(a), roleTokens(b));

const listing = (role, seniority = "Senior", extra = {}) => ({
  id: role,
  company: "Northwind",
  role,
  seniority,
  timezoneOffsets: [],
  anywhere: true,
  skills: [],
  ...extra,
});
const prefs = (targetRoles, experienceLevel = "") => ({ targetRoles, experienceLevel, remotePolicy: "anywhere" });
const PROFILE = { timezone: "GMT+1" };
const applied = (...rows) => ({ applied: rows.map(([role, daysAgo]) => ({ role, company: "Contoso", at: NOW - daysAgo * DAY })) });
const NONE = { applied: [] };

describe("title matching", () => {
  it("treats spellings and synonyms of the same job as the same job", () => {
    assert.equal(sim("Senior Full Stack Developer", "Fullstack Engineer"), 1);
    assert.equal(sim("Sr. Front-End Developer", "Frontend Engineer"), 1);
  });

  it("scores a neighbouring engineering specialism close, and a different job far", () => {
    assert.ok(sim("Fullstack Engineer", "Software Engineer") >= 0.6);
    assert.ok(sim("Fullstack Engineer", "Premium Support Engineer") < 0.5);
    assert.ok(sim("Senior Product Designer", "Sr. Marketing Designer") < 0.5);
    assert.equal(sim("Fullstack Engineer", "Senior Delivery Manager"), 0);
  });
});

describe("relevance", () => {
  it("hides a listing like neither your target roles nor your applications", () => {
    assert.equal(computeFit(listing("Enterprise Account Executive"), prefs(["Fullstack Engineer"]), PROFILE, applied(["Frontend Engineer", 5]), NOW).relevant, false);
  });

  it("shows nothing at all when there is nothing to go on", () => {
    assert.equal(computeFit(listing("Senior Product Designer"), prefs([]), PROFILE, NONE, NOW).relevant, false);
  });

  it("finds jobs from applications alone, with no target roles set", () => {
    const fit = computeFit(listing("Lead Product Designer"), prefs([]), PROFILE, applied(["Senior Product Designer", 2]), NOW);
    assert.equal(fit.relevant, true);
    assert.equal(fit.tier.label, "Strong match");
    assert.equal(fit.factors.find((f) => f.id === "role").available, false);
  });

  it("ranks a job like a recent application above one like an old one", () => {
    const history = applied(["Backend Engineer", 2], ["Data Analyst", 85]);
    const recent = computeFit(listing("Backend Engineer"), prefs([]), PROFILE, history, NOW);
    const old = computeFit(listing("Data Analyst"), prefs([]), PROFILE, history, NOW);
    assert.ok(recent.score > old.score);
  });
});

describe("seniority", () => {
  it("reads the levels listings use", () => {
    assert.deepEqual(bandsOf("Entry & mid-level"), ["entry", "mid"]);
    assert.deepEqual(bandsOf("Senior ++"), ["senior", "lead"]);
    assert.deepEqual(bandsOf("Internship"), ["intern"]);
    assert.deepEqual(bandsOf("Mid-level"), ["mid"]);
  });

  it("scores your level above one two steps away", () => {
    const same = computeFit(listing("Frontend Engineer", "Senior"), prefs(["Frontend Engineer"], "senior"), PROFILE, NONE, NOW);
    const far = computeFit(listing("Frontend Engineer", "Entry level"), prefs(["Frontend Engineer"], "senior"), PROFILE, NONE, NOW);
    assert.ok(same.score > far.score);
    assert.equal(same.factors.find((f) => f.id === "seniority").met, true);
  });
});

describe("the searches that build the pool", () => {
  it("searches a title without its level words or its bracketed qualifier", () => {
    assert.deepEqual(searchTermsFor("Senior Full Stack Developer"), ["Full Stack Developer", "fullstack"]);
    assert.equal(searchTermsFor("Senior Backend Engineer (Node.js)")[0], "Backend Engineer");
    assert.equal(searchTermsFor("Graphic/UI/UX Designer")[0], "Graphic/UI/UX Designer".replace(/\//g, " "));
  });

  it("puts target roles first, then the roles applied to most", () => {
    const history = { applied: recentApplications([
      { role: "Product Designer", company: "A", loggedAt: new Date(NOW - DAY).toISOString(), duplicateOf: null },
      { role: "Product Designer", company: "B", loggedAt: new Date(NOW - 3 * DAY).toISOString(), duplicateOf: null },
      { role: "Old Role", company: "C", loggedAt: new Date(NOW - 200 * DAY).toISOString(), duplicateOf: null },
    ], NOW) };
    assert.equal(history.applied.length, 2, "an application outside the window doesn't count");
    const terms = watchSearchTerms({ targetRoles: ["UX Researcher"] }, history, 8, NOW);
    assert.deepEqual(terms.slice(0, 3), ["UX Researcher", "ux", "Product Designer"]);
  });
});

describe("the signals a fit is matched on", () => {
  it("names each factor with nothing of yours to match on", () => {
    assert.deepEqual(fitSignals(prefs(["Fullstack Engineer"]), PROFILE, NONE), { role: true, trend: false, seniority: false, timezone: true });
    assert.deepEqual(fitSignals(prefs([], "senior"), PROFILE, applied(["Backend Engineer", 2])), { role: false, trend: true, seniority: true, timezone: true });
  });

  it("reads seniority from the level you've been applying at, and location from a timezone or being open to anywhere", () => {
    assert.equal(fitSignals(prefs([]), PROFILE, applied(["Senior Backend Engineer", 2], ["Senior Fullstack Engineer", 5])).seniority, true);
    assert.equal(fitSignals({ ...prefs([]), remotePolicy: "region" }, { timezone: "" }, NONE).timezone, false);
    assert.equal(fitSignals(prefs([]), { timezone: "" }, NONE).timezone, true);
  });
});
