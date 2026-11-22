// The blog editor's undo steps (app/lib/blog/undoSteps.ts, used by BlogForm's
// changeContent): a word of typing, a run of deletes, or one action. One undo
// must take back the last step, then the one before (owner, 2026-11-21).
//
//   npm test        (node --test --experimental-strip-types tests/)

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { changeIndex, typingStep } = await import("../app/lib/blog/undoSteps.ts");
const { record, settle, startHistory, undo } = await import("../app/lib/dashboard/resume/history.ts");

describe("typingStep", () => {
  it("reads one typed character as typing, and a space or line break as the end of a word", () => {
    assert.deepEqual(typingStep([{ retain: 12 }, { insert: "a" }]), { kind: "insert", endsWord: false });
    assert.deepEqual(typingStep([{ insert: "a" }]), { kind: "insert", endsWord: false });
    assert.deepEqual(typingStep([{ retain: 3 }, { insert: " " }]), { kind: "insert", endsWord: true });
    assert.deepEqual(typingStep([{ retain: 3 }, { insert: " " }]), { kind: "insert", endsWord: true });
    assert.deepEqual(typingStep([{ retain: 3 }, { insert: "\n", attributes: { header: 2 } }]), { kind: "insert", endsWord: true });
    // Typing inside bold text carries the format; it is still typing.
    assert.deepEqual(typingStep([{ retain: 3 }, { insert: "b", attributes: { bold: true } }]), { kind: "insert", endsWord: false });
  });

  it("counts an emoji as one character", () => {
    assert.deepEqual(typingStep([{ retain: 3 }, { insert: "😀" }]), { kind: "insert", endsWord: false });
  });

  it("reads one deleted character as a delete", () => {
    assert.deepEqual(typingStep([{ retain: 7 }, { delete: 1 }]), { kind: "delete" });
  });

  it("makes everything else a step of its own", () => {
    assert.equal(typingStep([{ retain: 3 }, { retain: 5, attributes: { bold: true } }]), null, "formatting");
    assert.equal(typingStep([{ retain: 3 }, { insert: "pasted text" }]), null, "a paste");
    assert.equal(typingStep([{ retain: 3 }, { insert: { image: "https://x/y.png" } }]), null, "an image");
    assert.equal(typingStep([{ retain: 3 }, { delete: 9 }]), null, "deleting a selection");
    assert.equal(typingStep([{ retain: 3 }, { delete: 4 }, { insert: "x" }]), null, "typing over a selection");
    assert.equal(typingStep([{ retain: 3 }, { delete: 1 }, { retain: 1, attributes: { header: null } }]), null, "joining two lines");
    assert.equal(typingStep([]), null);
  });
});

// The same composition as BlogForm's changeContent, over plain strings.
function type(h, text, limit = 300) {
  let at = h;
  for (const ch of text) {
    const step = typingStep([{ retain: at.present.length }, { insert: ch }]);
    const next = at.present + ch;
    if (!step) {
      at = record(at, next, null, limit);
      continue;
    }
    const moved = record(at, next, `content:${step.kind}`, limit);
    at = step.kind === "insert" && step.endsWord ? settle(moved, limit) : moved;
  }
  return at;
}

function backspace(h, times, limit = 300) {
  let at = h;
  for (let i = 0; i < times; i++) {
    const step = typingStep([{ retain: at.present.length - 1 }, { delete: 1 }]);
    at = record(at, at.present.slice(0, -1), `content:${step.kind}`, limit);
  }
  return at;
}

describe("undo in the blog body", () => {
  it("takes back one word at a time, never the whole session", () => {
    let h = type(startHistory(""), "Writers keep typing without a pause ");
    h = undo(h);
    assert.equal(h.present, "Writers keep typing without a ");
    h = undo(h);
    assert.equal(h.present, "Writers keep typing without ");
    h = undo(h);
    assert.equal(h.present, "Writers keep typing ");
  });

  it("takes back the unfinished word on its own", () => {
    let h = type(startHistory(""), "One two thr");
    h = undo(h);
    assert.equal(h.present, "One two ");
  });

  it("makes a run of Backspace one step, apart from the typing before it", () => {
    let h = type(startHistory(""), "Hello world ");
    h = backspace(h, 6);
    assert.equal(h.present, "Hello ");
    h = undo(h);
    assert.equal(h.present, "Hello world ");
    h = undo(h);
    assert.equal(h.present, "Hello ");
  });

  it("keeps a long session's steps up to the limit, dropping only the oldest", () => {
    const words = Array.from({ length: 350 }, (_, i) => `w${i} `).join("");
    let h = type(startHistory(""), words);
    assert.equal(h.past.length, 300);
    h = undo(h);
    assert.ok(h.present.endsWith("w348 "));
  });
});

describe("changeIndex: the caret after an undo or redo", () => {
  it("goes where an undone word was", () => {
    // "Hello world " back to "Hello ": the word went away at 6.
    assert.equal(changeIndex([{ retain: 6 }, { delete: 6 }]), 6);
  });

  it("goes just after what came back", () => {
    // Redoing " world" after "Hello".
    assert.equal(changeIndex([{ retain: 5 }, { insert: " world" }]), 11);
    assert.equal(changeIndex([{ retain: 2 }, { insert: { image: "x" } }]), 3);
  });

  it("goes to the end of a reformatted stretch", () => {
    assert.equal(changeIndex([{ retain: 4 }, { retain: 5, attributes: { bold: true } }]), 9);
  });

  it("takes the last place when a step changed several", () => {
    assert.equal(changeIndex([{ retain: 2 }, { delete: 1 }, { retain: 10 }, { insert: "ab" }]), 14);
  });

  it("is null when the body did not change", () => {
    assert.equal(changeIndex([]), null);
    assert.equal(changeIndex([{ retain: 12 }]), null);
  });
});
