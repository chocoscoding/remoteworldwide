// The resume editor's one undo history (app/lib/dashboard/resume/history.ts):
// steps, runs of typing or dragging that undo as one, facts that are true of
// every point and never a step, and how a change to one field is told from a
// structural one.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// The module under test imports nothing, so no resolve hook is needed.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { canRedo, canUndo, everywhere, record, redo, settle, soleLeafPath, startHistory, undo } = await import(
  "../app/lib/dashboard/resume/history.ts"
);

const point = (text, extra = {}) => ({ text, ...extra });

describe("steps", () => {
  it("undoes and redoes one change at a time", () => {
    const a = point("a");
    const b = point("b");
    const c = point("c");
    let h = record(record(startHistory(a), b), c);
    assert.equal(h.present, c);
    h = undo(h);
    assert.equal(h.present, b);
    h = undo(h);
    assert.equal(h.present, a);
    assert.equal(canUndo(h), false);
    h = redo(h);
    assert.equal(h.present, b);
    assert.equal(canRedo(h), true);
  });

  it("drops what could be redone once something new is done", () => {
    let h = record(record(startHistory(point("a")), point("b")), point("c"));
    h = undo(h);
    h = record(h, point("d"));
    assert.equal(canRedo(h), false);
    assert.deepEqual(h.past.map((p) => p.text), ["a", "b"]);
  });

  it("returns the same history for a change to the same point, and with nothing to undo or redo", () => {
    const h = startHistory(point("a"));
    assert.equal(record(h, h.present), h);
    assert.equal(undo(h), h);
    assert.equal(redo(h), h);
  });
});

describe("runs", () => {
  it("folds typing into one field into one step", () => {
    let h = startHistory(point(""));
    for (const text of ["H", "He", "Hel", "Hell", "Hello"]) h = record(h, point(text), "type:/summary");
    assert.equal(h.present.text, "Hello");
    assert.equal(canUndo(h), true);
    h = undo(h);
    assert.equal(h.present.text, "");
    assert.equal(canUndo(h), false);
    assert.equal(redo(h).present.text, "Hello");
  });

  it("starts a new step when typing moves to another field", () => {
    let h = startHistory(point("", { other: "" }));
    h = record(h, point("Hi", { other: "" }), "type:/summary");
    h = record(h, point("Hi", { other: "x" }), "type:/name");
    h = undo(h);
    assert.equal(h.present.text, "Hi");
    assert.equal(h.present.other, "");
    h = undo(h);
    assert.equal(h.present.text, "");
  });

  it("closes a run on settle, so the next keystroke is a step of its own", () => {
    let h = startHistory(point(""));
    h = record(h, point("one"), "type:/summary");
    h = settle(h);
    h = record(h, point("one two"), "type:/summary");
    h = undo(h);
    assert.equal(h.present.text, "one");
  });

  it("makes a slider drag one step when its commit lands on the value already shown", () => {
    let h = startHistory(point("11pt"));
    h = record(h, point("12pt"), "design:fontSize/setBase:");
    const shown = point("13pt");
    h = record(h, shown, "design:fontSize/setBase:");
    h = record(h, shown);
    assert.equal(h.pending, null);
    assert.equal(undo(h).present.text, "11pt");
  });

  it("closes the open run before a plain step", () => {
    let h = startHistory(point(""));
    h = record(h, point("typed"), "type:/summary");
    h = record(h, point("typed", { applied: true }));
    h = undo(h);
    assert.equal(h.present.text, "typed");
    assert.equal(h.present.applied, undefined);
    assert.equal(undo(h).present.text, "");
  });
});

describe("facts", () => {
  const same = (a, b) => a.text === b.text && a.check === b.check;

  it("writes a fact into every point instead of adding a step", () => {
    let h = record(record(startHistory(point("a", { check: null })), point("b", { check: null })), point("c", { check: null }));
    h = undo(h);
    h = everywhere(h, (p) => ({ ...p, check: "72" }), same);
    assert.equal(h.present.check, "72");
    assert.ok(h.past.every((p) => p.check === "72"));
    assert.ok(h.future.every((p) => p.check === "72"));
    assert.deepEqual(h.past.map((p) => p.text), ["a"]);
  });

  it("drops a step the fact leaves changing nothing", () => {
    // A check standing, removed (a step), then a new check lands: undoing the removal would do nothing.
    let h = startHistory(point("a", { check: "old" }));
    h = record(h, point("a", { check: null }));
    h = everywhere(h, (p) => (p.check === "new" ? p : { ...p, check: "new" }), same);
    assert.equal(h.present.check, "new");
    assert.equal(canUndo(h), false);
  });

  it("returns the same history when the fact was already known", () => {
    const h = record(startHistory(point("a")), point("b"));
    assert.equal(everywhere(h, (p) => p, same), h);
  });
});

describe("telling typing from a structural edit", () => {
  const content = { summary: "Hi", skills: ["Go"], experience: [{ id: "e1", role: "Dev", bullets: ["Built it"] }] };

  it("names the one leaf that changed", () => {
    assert.equal(soleLeafPath(content, { ...content, summary: "Hi there" }), "/summary");
    const bullet = { ...content, experience: [{ ...content.experience[0], bullets: ["Built it fast"] }] };
    assert.equal(soleLeafPath(content, bullet), "/experience/0/bullets/0");
  });

  it("treats a field filled in for the first time as a leaf", () => {
    const entry = { id: "e1", school: "MIT" };
    assert.equal(soleLeafPath(entry, { ...entry, location: "Boston" }), "/location");
  });

  it("is null when an entry is added or removed, or two fields change", () => {
    assert.equal(soleLeafPath(content, { ...content, skills: ["Go", "Rust"] }), null);
    assert.equal(soleLeafPath(content, { ...content, skills: [] }), null);
    assert.equal(soleLeafPath(content, { ...content, summary: "x", skills: ["Rust"] }), null);
  });

  it("is undefined when nothing changed", () => {
    assert.equal(soleLeafPath(content, content), undefined);
    assert.equal(soleLeafPath(content, { ...content }), undefined);
  });
});
