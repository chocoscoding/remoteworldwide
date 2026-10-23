import assert from "node:assert/strict";
import { it } from "node:test";
import { readFileSync } from "node:fs";
import { sentenceEnding, punctuationLines } from "../app/lib/apply/punctuation.ts";
it("adds only missing sentence endings and is idempotent", () => {
  for (const text of ["Lifted completed orders by 12% in first month", "Ran 30+ user interviews quarterly", "Aligned teams (fully async)"]) {
    assert.equal(sentenceEnding(text), text + ".");
    assert.equal(sentenceEnding(sentenceEnding(text)), text + ".");
  }
  assert.equal(sentenceEnding("Led the project;"), "Led the project.");
});
it("preserves existing punctuation, short labels, introductions and URLs", () => {
  for (const text of ["Built the new platform.", "Built the new platform!", "What did we improve?", "Work Experience", "Tools used included:", "See my work at https://example.com", "", 'Delivered the project.”']) assert.equal(sentenceEnding(text), text);
});
it("reports summary and experience prose without inspecting skills or headings", () => {
  assert.deepEqual(punctuationLines({summary: "Designer with seven years of experience", experience: [{role: "Senior Product Designer", bullets: ["Built the new platform.", "Ran research across teams"]}], skills: ["Product design"]}), ["Designer with seven years of experience", "Ran research across teams"]);
});
it("uses the same punctuation rules as the scorer", () => {
  assert.equal(readFileSync(new URL("../app/lib/apply/punctuation.ts", import.meta.url), "utf8"), readFileSync(new URL("../../remoteworldwideai/src/lib/punctuation.ts", import.meta.url), "utf8"));
});

it("keeps frontend and backend scoring versions aligned", () => {
 assert.equal(readFileSync(new URL("../app/lib/ats/scoring-version.ts", import.meta.url), "utf8"), readFileSync(new URL("../../remoteworldwideai/src/lib/scoring-version.ts", import.meta.url), "utf8"));
});
