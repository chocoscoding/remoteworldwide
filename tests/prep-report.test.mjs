// The prep report's pure helpers: how scores are banded, how delivery is
// worded, which questions a practice session from the report asks, and how
// the Delivery chart centres pace on the speaker's own usual.
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

// practiceQuestionId and practiceHref read nothing from the browser until called with storage.
const scales = await import("../app/components/dashboard/prep/report/reportScales.ts");
const practice = await import("../app/components/dashboard/prep/report/practiceSets.ts");
const chart = await import("../app/components/dashboard/prep/report/deliveryChart.ts");

describe("score bands", () => {
  it("bands the overall score red under 50, amber to 74, lime-green from 75", () => {
    assert.equal(scales.overallBand(49), "low");
    assert.equal(scales.overallBand(50), "mid");
    assert.equal(scales.overallBand(74), "mid");
    assert.equal(scales.overallBand(75), "high");
  });

  it("bands a dimension red under 5, amber under 7, lime-green from 7", () => {
    assert.equal(scales.dimensionBand(4.8), "low");
    assert.equal(scales.dimensionBand(5), "mid");
    assert.equal(scales.dimensionBand(6.9), "mid");
    assert.equal(scales.dimensionBand(7), "high");
  });

  it("writes a score as given, never with more than one decimal", () => {
    assert.equal(scales.formatScore(3), "3");
    assert.equal(scales.formatScore(4.8), "4.8");
    assert.equal(scales.formatScore(9.46), "9.5");
  });
});

describe("delivery wording", () => {
  it("says where the pace sat against the band", () => {
    const band = { low: 140, high: 160 };
    assert.equal(scales.paceVerdict(140, band), "in range");
    assert.equal(scales.paceVerdict(139, band), "slow");
    assert.equal(scales.paceVerdict(161, band), "fast");
  });

  it("counts kinds, not moments, in the headline", () => {
    assert.equal(scales.deliveryHeadline([]), "nothing stood out");
    assert.equal(scales.deliveryHeadline([{ kind: "fillers" }, { kind: "fillers" }]), "1 thing stood out");
    assert.equal(scales.deliveryHeadline([{ kind: "fillers" }, { kind: "rushing" }]), "2 things stood out");
  });

  it("writes Overall's one line, leaving out what wasn't measured", () => {
    assert.equal(scales.deliverySummary({ wpmMean: 140.4, longPauses: 1, fillersPer100Words: 2.8 }), "140 wpm · 1 long pause · 2.8 fillers per 100 words");
    assert.equal(scales.deliverySummary({ wpmMean: null, longPauses: 2, fillersPer100Words: null }), "2 long pauses");
  });

  it("never writes an em dash", () => {
    const lines = [scales.deliveryHeadline([{ kind: "monotone" }]), scales.deliverySummary({ wpmMean: 150, longPauses: 0, fillersPer100Words: 0 }), scales.listOf(["a", "b", "c"])];
    for (const line of lines) assert.ok(!line.includes("—"), line);
  });
});

describe("practice from the report", () => {
  const questions = [
    { id: "q1", text: "Tell me about a time you owned the month-end close." },
    { id: "q2", text: "Describe how you applied U.S. GAAP to a complex transaction." },
    { id: "q3", text: "Walk me through a reconciliation you fixed." },
  ];
  const turns = [
    { id: "a1", who: "ai", text: "Thanks for joining. Tell me about a time you owned the month-end close." },
    { id: "u1", who: "user", text: "I owned it end to end.", questionId: "q1" },
    { id: "a2", who: "ai", text: "Describe how you applied U.S. GAAP to a complex transaction." },
  ];

  it("lists the questions no answer reached", () => {
    assert.deepEqual(
      practice.notReached(questions, turns).map((q) => q.id),
      ["q2", "q3"]
    );
  });

  it("counts an older answer without a question id by the line it replied to", () => {
    const old = turns.map((t) => ({ ...t, questionId: undefined }));
    assert.deepEqual(
      practice.notReached(questions, old).map((q) => q.id),
      ["q2", "q3"]
    );
  });

  it("picks up from a question through every later one not reached", () => {
    assert.deepEqual(
      practice.pickUpFrom(questions, turns, "q2").map((q) => q.id),
      ["q2", "q3"]
    );
    assert.deepEqual(practice.pickUpFrom(questions, turns, "nope"), []);
  });

  it("asks an answer's own question again, under its own id", () => {
    assert.deepEqual(practice.answerAgain({ turnId: "u1", questionId: "q1", question: null }, questions), { id: "q1", text: questions[0].text });
    const loose = practice.answerAgain({ turnId: "u9", questionId: null, question: "Great, thanks. What would you do differently?" }, questions);
    assert.equal(loose?.text, "What would you do differently?");
    assert.match(loose?.id ?? "", /^practice:/);
  });

  it("practises every criterion not already strong, by its probe", () => {
    const criterion = (id, level, example) => ({ id, label: id, level, probe: { format: "behavioural", kind: "story", example } });
    const picked = practice.criteriaToPractise([
      criterion("values-match", "strong", "Tell me about a value you hold."),
      criterion("adaptability", "not-enough-evidence", "Tell me about a project that went wrong."),
      criterion("learning-agility", "concern", "  "),
    ]);
    assert.deepEqual(
      picked.map((q) => [q.id, q.text]),
      [["practice:adaptability", "Tell me about a project that went wrong."]]
    );
  });
});

describe("the delivery chart", () => {
  const base = { durationMs: 60_000, width: 600, height: 164, pad: 12, words: [] };

  it("draws pace around the session's own average: usual sits on the middle line", () => {
    const pace = chart.buildCenteredPace({
      ...base,
      points: [],
      answers: [{ turnId: "u1", startMs: 28_000, endMs: 45_000, wpm: 143, leadInMs: 500 }],
      wpmMean: 143,
    });
    assert.equal(pace.centre, 143);
    assert.equal(pace.empty, false);
    assert.equal(pace.spans.length, 1);
    assert.equal(pace.spans[0].y, 164 / 2, "an answer at the usual pace is drawn on the usual line");
  });

  it("puts a faster stretch above usual and a slower one below", () => {
    const pace = chart.buildCenteredPace({
      ...base,
      points: [],
      answers: [
        { turnId: "u1", startMs: 0, endMs: 20_000, wpm: 170, leadInMs: 0 },
        { turnId: "u2", startMs: 30_000, endMs: 50_000, wpm: 130, leadInMs: 0 },
      ],
      wpmMean: 150,
    });
    const [fast, slow] = pace.spans;
    assert.ok(fast.y < 82 && slow.y > 82);
  });

  it("has nothing to draw without a measured pace", () => {
    const pace = chart.buildCenteredPace({ ...base, points: [], answers: [], wpmMean: 150 });
    assert.equal(pace.empty, true);
  });

  it("averages a series over an answer, skipping what wasn't measured", () => {
    assert.equal(chart.seriesMean([null, 1, 3, null], 250, 0, 1000), 2);
    assert.equal(chart.seriesMean([null, null], 250, 0, 500), null);
  });
});
