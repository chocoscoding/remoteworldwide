// The ATS score's recipe on the website (owner, 2026-10-19: "the ATS is meant to be more than a
// keyword matcher"): how it is said under the numbers, and how a stored report scored by the old
// formula (keyword match alone) is told apart, so it is rescored rather than compared.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as apply.test.mjs: Node resolves neither the `@/` alias nor an extensionless `./x`.

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

const { expectedScore, isCurrentScore, projectedLifts, scoreMakeup } = await import("../app/lib/ats/score.ts");
const { strictness } = await import("../app/lib/ats/strictness.ts");

const metrics = (keyword, impact, parse, length) => [
  keyword === null ? { id: "keyword-match", label: "Keyword match", value: null, checked: false } : { id: "keyword-match", label: "Keyword match", value: keyword },
  { id: "parseability", label: "Parseability", value: parse },
  { id: "impact-language", label: "Impact language", value: impact },
  { id: "length-format", label: "Length & format", value: length },
];

describe("the ATS score's recipe", () => {
  it("adds up 70/15/10/5 from the numbers shown, rounding a half up as by hand", () => {
    assert.equal(expectedScore({ metrics: metrics(86, 69, 100, 100) }), 86);
    assert.equal(expectedScore({ metrics: metrics(92, 94, 100, 100) }), 94);
    assert.equal(expectedScore({ metrics: metrics(100, 100, 100, 100), stuffingPenalty: 2 }), 98);
    assert.equal(expectedScore({ metrics: metrics(100, 100, 100, 100) }), 99);
    assert.equal(expectedScore({ metrics: metrics(null, 60, 90, 90) }), 80);
  });

  it("tells a report scored by keyword match alone from one scored today", () => {
    assert.equal(isCurrentScore({ score: 86, metrics: metrics(86, 69, 100, 100) }), true);
    // Before 2026-10-19 the same numbers scored 75 when keyword match was 75.
    assert.equal(isCurrentScore({ score: 75, metrics: metrics(75, 69, 100, 100) }), false);
    // Too old to have every metric: nothing to tell by.
    assert.equal(isCurrentScore({ score: 60, metrics: [{ id: "keyword-match", label: "Keyword match", value: 60 }] }), true);
  });

  it("never says the score's recipe on the page (owner, 2026-10-19: it read as a keyword matcher)", () => {
    const made = scoreMakeup({ score: 86, metrics: metrics(86, 69, 100, 100) }, { keywordChecked: true });
    assert.equal(made.current, true);
    assert.doesNotMatch(JSON.stringify(made), /%|keyword match/i);
    assert.equal(scoreMakeup({ score: 75, metrics: metrics(75, 69, 100, 100) }, { keywordChecked: true }).current, false);
  });
});

describe("what meeting a missing requirement is projected to add", () => {
  const verdict = (id, state, weight = 4, extra = {}) => ({
    requirement: { id, text: id, type: "required", category: "skill", weight, ...extra },
    state,
    score: 0.5,
    resolvedBy: "rerank",
    evidence: [],
    confidence: "high",
  });

  it("is its share of the checked weight, at keyword match's 70%, as a rescore would count it", () => {
    // Two met, one missing, one partly met, all weight 4: 16 checked. Missing lacks 4 of 16 (70 x 4 / 16 = 17.5);
    // partial lacks what the strictness level does not give it (balanced: 55%).
    const report = { metrics: metrics(63, 70, 90, 90), verdicts: [verdict("a", "satisfied"), verdict("b", "satisfied"), verdict("c", "missing"), verdict("d", "partial")] };
    const lifts = projectedLifts(report);
    assert.equal(lifts.get("c"), 17.5);
    assert.equal(lifts.get("d"), 17.5 * (1 - strictness().partialCredit));
    assert.equal(lifts.has("a"), false);
  });

  // Owner, 2026-10-21: met only in the summary or Skills earns the level's mention share, so showing it in the work lifts the rest.
  it("projects the rest of a requirement met only in the summary or Skills", () => {
    const report = { metrics: metrics(63, 70, 90, 90), verdicts: [verdict("a", "satisfied"), { ...verdict("m", "satisfied"), mention: true }] };
    const lifts = projectedLifts(report);
    assert.equal(lifts.get("m"), 35 * (1 - strictness().mentionCredit));
    assert.equal(lifts.has("a"), false);
  });

  it("counts a duty at half, a nice-to-have at 0.4, and nothing unchecked or a posting note", () => {
    const report = {
      metrics: metrics(50, 70, 90, 90),
      verdicts: [
        verdict("duty", "missing", 4, { category: "responsibility" }),
        verdict("plus", "missing", 5, { type: "preferred" }),
        verdict("met", "satisfied", 4),
        verdict("later", "undetermined", 5),
        verdict("where", "missing", 5, { category: "eligibility" }),
      ],
    };
    const lifts = projectedLifts(report);
    // Checked weight: duty 2 + plus 2 + met 4 = 8.
    assert.equal(lifts.get("duty"), 17.5);
    assert.equal(lifts.get("plus"), 17.5);
    assert.equal(lifts.has("later"), false);
    assert.equal(lifts.has("where"), false);
  });

  it("projects nothing when keyword match was not checked", () => {
    assert.equal(projectedLifts({ metrics: metrics(null, 70, 90, 90), verdicts: [verdict("c", "missing")] }).size, 0);
  });
});
