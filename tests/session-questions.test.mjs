// Which likely questions a live mock interview asks, by difficulty: about 60%
// led by what the job requires and 40% by the resume, half and half at tough,
// tough asking the sharp ones first and warm-up last (owner, 2026-10-04).
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

const { pickSessionQuestions, OPENING_QUESTION, CLOSING_QUESTION } = await import("../app/lib/prep/sessionQuestions.ts");

/** A likely question: `p3` is the third led by the posting, `r2` the second led by the resume; `!` marks it sharp. */
const q = (tag, format = "behavioural") => {
  const sharp = tag.endsWith("!");
  const id = tag.replace("!", "");
  return {
    id,
    text: `Question ${id}?`,
    why: "Because.",
    format,
    requirement: null,
    basis: id.startsWith("r") ? "resume" : id.startsWith("p") ? "posting" : null,
    sharp,
  };
};

/** Seven led by the job, then five by the resume, as a set of twelve lists them. */
const SET = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "r1", "r2", "r3", "r4", "r5"].map((tag) => q(tag));

const middle = (input) => {
  const picked = pickSessionQuestions({ formats: ["behavioural"], seed: "seed", ...input });
  assert.equal(picked[0].id, OPENING_QUESTION.id);
  assert.equal(picked.at(-1).id, CLOSING_QUESTION.id);
  return picked.slice(1, -1).map((question) => question.id);
};

describe("the session's mix of job and resume questions", () => {
  it("asks about 60% from the job at standard, spread through the session", () => {
    assert.deepEqual(middle({ lengthMinutes: 15, likely: SET, difficulty: "standard" }), ["p1", "p2", "r1", "p3", "r2"]);
    assert.deepEqual(middle({ lengthMinutes: 25, likely: SET, difficulty: "standard" }), ["p1", "p2", "r1", "p3", "r2", "p4", "p5", "r3"]);
  });

  it("is standard when no difficulty is given, and warm-up takes the same share", () => {
    assert.deepEqual(middle({ lengthMinutes: 15, likely: SET }), ["p1", "p2", "r1", "p3", "r2"]);
    assert.deepEqual(middle({ lengthMinutes: 15, likely: SET, difficulty: "warm-up" }), ["p1", "p2", "r1", "p3", "r2"]);
  });

  it("asks half from the resume at tough", () => {
    assert.deepEqual(middle({ lengthMinutes: 25, likely: SET, difficulty: "tough" }), ["p1", "r1", "p2", "r2", "p3", "r3", "p4", "r4"]);
    assert.deepEqual(middle({ lengthMinutes: 6, likely: SET, difficulty: "tough" }), ["p1", "r1"]);
  });

  it("asks the sharp ones first at tough and last at warm-up, keeping the track's order otherwise", () => {
    const set = ["p1", "p2!", "p3", "p4!", "r1", "r2!", "r3"].map((tag) => q(tag));
    assert.deepEqual(middle({ lengthMinutes: 15, likely: set, difficulty: "tough" }), ["p2", "r2", "p4", "r1", "p1"]);
    assert.deepEqual(middle({ lengthMinutes: 15, likely: set, difficulty: "warm-up" }), ["p1", "p3", "r1", "p2", "r3"]);
    assert.deepEqual(middle({ lengthMinutes: 15, likely: set, difficulty: "standard" }), ["p1", "p2", "r1", "p3", "r2"]);
  });

  it("takes the other kind when one runs out", () => {
    const jobOnly = ["p1", "p2", "p3", "p4", "p5"].map((tag) => q(tag));
    assert.deepEqual(middle({ lengthMinutes: 15, likely: jobOnly, difficulty: "tough" }), ["p1", "p2", "p3", "p4", "p5"]);
    const resumeHeavy = ["p1", "r1", "r2", "r3", "r4"].map((tag) => q(tag));
    assert.deepEqual(middle({ lengthMinutes: 15, likely: resumeHeavy, difficulty: "standard" }), ["p1", "r1", "r2", "r3", "r4"]);
  });

  it("asks a set written before questions said what led them in its own order", () => {
    const old = ["a1", "a2", "a3", "a4", "a5", "a6"].map((tag) => q(tag));
    for (const difficulty of ["warm-up", "standard", "tough"]) {
      assert.deepEqual(middle({ lengthMinutes: 15, likely: old, difficulty }), ["a1", "a2", "a3", "a4", "a5"]);
    }
  });

  it("still alternates the chosen formats", () => {
    const set = [q("p1"), q("r1"), q("p2"), q("p3", "portfolio"), q("r2", "portfolio"), q("p4", "portfolio")];
    const picked = pickSessionQuestions({ formats: ["behavioural", "portfolio"], lengthMinutes: 15, seed: "seed", likely: set, difficulty: "standard" });
    // Behavioural, portfolio, behavioural…: the fifth slot wants the resume, but behavioural has only the job's left.
    assert.deepEqual(
      picked.slice(1, -1).map((question) => question.id),
      ["p1", "p3", "r1", "p4", "p2"]
    );
  });
});
