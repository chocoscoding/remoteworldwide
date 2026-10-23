// The open asks the apply step sends as `pending` on every keywords and Tailor call, and the note it
// shows for terms the AI held for one (owner, 2026-10-22, fix plan B: "Google Analytics" was asked,
// then written in through the broader "Analytics tools proficiency" chip).
//
//   node --test --experimental-strip-types tests/pending-asks.test.mjs

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { MAX_PENDING, awaitingNote, pendingTerms } = await import("../app/lib/apply/pending-asks.ts");

describe("pendingTerms", () => {
  it("sends each open ask's term once, case and spacing folded", () => {
    assert.deepEqual(pendingTerms([{ term: "Google Analytics" }, { term: " google  analytics " }, { term: "Amplitude" }]), ["Google Analytics", "Amplitude"]);
  });

  it("leaves out the ask being answered: a yes is the one written in", () => {
    assert.deepEqual(pendingTerms([{ term: "Google Analytics" }, { term: "Amplitude" }], "google analytics"), ["Amplitude"]);
  });

  it("keeps within what the AI service takes", () => {
    const many = Array.from({ length: 40 }, (_, n) => ({ term: `Tool ${n}` }));
    assert.equal(pendingTerms(many).length, MAX_PENDING);
    assert.deepEqual(pendingTerms([{ term: "" }, { term: "x".repeat(81) }, { term: "Jira" }]), ["Jira"]);
  });
});

describe("awaitingNote", () => {
  it("names the question to answer first, in plain words", () => {
    assert.equal(awaitingNote(["Google Analytics"]), "Answer the question about Google Analytics first.");
    assert.equal(awaitingNote(["Google Analytics", "Amplitude"]), "Answer the questions about Google Analytics and Amplitude first.");
    assert.equal(awaitingNote(["AppsFlyer", "Firebase", "App Annie"]), "Answer the questions about AppsFlyer, Firebase and App Annie first.");
  });

  it("says nothing when nothing waits, and never a long dash", () => {
    assert.equal(awaitingNote([]), null);
    assert.equal(awaitingNote(["  "]), null);
    assert.doesNotMatch(awaitingNote(["A", "B"]) ?? "", /—|–/);
  });
});
