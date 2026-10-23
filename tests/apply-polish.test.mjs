// Fix plan Phase 6 (2026-10-22), the apply page's pure parts:
//
//   - app/lib/apply/ask-cap.ts: the Yes/No asks on the fixes list (Tailor's and the posting's
//     examples, "Java", "Azure") show four at a time, the rest behind "Show N more".
//   - app/lib/apply/snapshots.ts: a remount of the wizard starts from the latest state this page
//     had, not the session as first fetched (a dev hot reload lost an Impact step from history).
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Neither module imports anything, so no resolve hook is needed.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

const { ASK_ROWS_SHOWN, capAsks } = await import("../app/lib/apply/ask-cap.ts");
const { attachApplyWizard, forgetApplySnapshots, rememberApplySnapshot, restoreApplySnapshot, savedApplySnapshot, updateApplySnapshot } = await import(
  "../app/lib/apply/snapshots.ts"
);

const isAsk = (row) => row.ask === true;
const ask = (term) => ({ id: `if-true-${term}`, ask: true });
const fix = (id) => ({ id });
const ids = (rows) => rows.map((row) => row.id);

describe("capAsks", () => {
  it("shows four asks", () => assert.equal(ASK_ROWS_SHOWN, 4));

  it("leaves a list with four asks or fewer alone, with no toggle", () => {
    const rows = [fix("title"), ask("Java"), ask("Azure"), ask("Kubernetes"), ask("GraphQL"), fix("best-match")];
    const out = capAsks(rows, isAsk, false);
    assert.deepEqual(ids(out.rows), ids(rows));
    assert.equal(out.hidden, 0);
    assert.equal(out.toggleAfter, -1);
  });

  it("hides the fifth ask on, keeps every other row in its place, and puts the toggle after the last ask shown", () => {
    // The shape ResumeStep builds: the title fix, Tailor's asks, the posting's examples, then the notes.
    const rows = [fix("title"), ask("Java"), ask("Azure"), ask("Terraform"), ask("Kafka"), ask("Go"), ask("Rust"), fix("best-match"), fix("tailor")];
    const closed = capAsks(rows, isAsk, false);
    assert.deepEqual(ids(closed.rows), ["title", "if-true-Java", "if-true-Azure", "if-true-Terraform", "if-true-Kafka", "best-match", "tailor"]);
    assert.equal(closed.hidden, 2);
    assert.equal(closed.rows[closed.toggleAfter].id, "if-true-Kafka");

    const open = capAsks(rows, isAsk, true);
    assert.deepEqual(ids(open.rows), ids(rows));
    assert.equal(open.hidden, 0);
    assert.equal(open.rows[open.toggleAfter].id, "if-true-Rust");
  });

  it("never hides a row that is not an ask, wherever it sits", () => {
    const rows = [ask("a"), fix("x"), ask("b"), ask("c"), ask("d"), fix("y"), ask("e")];
    const out = capAsks(rows, isAsk, false);
    assert.deepEqual(ids(out.rows), ["if-true-a", "x", "if-true-b", "if-true-c", "if-true-d", "y"]);
    assert.equal(out.rows[out.toggleAfter].id, "if-true-d");
  });
});

describe("apply snapshots", () => {
  beforeEach(() => forgetApplySnapshots());

  const OPENED = "2026-10-22T09:00:00.000Z";
  const s0 = { history: ["start"] };
  const s1 = { history: ["start", "tailor"] };
  const s2 = { history: ["start", "tailor", "impact"] };

  it("has nothing for a session this page never opened", () => {
    assert.equal(restoreApplySnapshot("a", OPENED), null);
  });

  it("restores the latest state on a remount that is handed the session as first fetched (the hot-reload case)", () => {
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s0 }, OPENED);
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, OPENED);
    savedApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, "2026-10-22T09:01:00.000Z");
    // The Impact step: made, not saved yet when the remount came.
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s2 }, OPENED);

    const back = restoreApplySnapshot("a", OPENED);
    assert.ok(back);
    assert.equal(back.state, s2);
    assert.equal(back.saved, false, "a pending state is saved again by the remounted wizard");
    assert.deepEqual(back.visited, [1, 2]);
  });

  it("counts a state as saved once its own save answers, and not a newer one made while it was on its way", () => {
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s0 }, OPENED);
    assert.equal(restoreApplySnapshot("a", OPENED).saved, true, "the state as opened is what the server holds");
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, OPENED);
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s2 }, OPENED);
    savedApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, "2026-10-22T09:01:00.000Z");
    assert.equal(restoreApplySnapshot("a", OPENED).saved, false);
    savedApplySnapshot("a", { step: 2, visited: [1, 2], state: s2 }, "2026-10-22T09:02:00.000Z");
    assert.equal(restoreApplySnapshot("a", OPENED).saved, true);
  });

  it("a step change alone is unsaved too", () => {
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, OPENED);
    rememberApplySnapshot("a", { step: 3, visited: [1, 2, 3], state: s1 }, OPENED);
    assert.equal(restoreApplySnapshot("a", OPENED).saved, false);
  });

  it("lets the server's copy win when it was saved after this page's last save (another tab)", () => {
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, OPENED);
    savedApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, "2026-10-22T09:01:00.000Z");
    assert.equal(restoreApplySnapshot("a", "2026-10-22T09:05:00.000Z"), null);
    // And forgets it, so the wizard's next change starts a fresh snapshot from that copy.
    assert.equal(restoreApplySnapshot("a", OPENED), null);
  });

  it("keeps the snapshot when the refetched session is this page's own last save", () => {
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, OPENED);
    savedApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, "2026-10-22T09:01:00.000Z");
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s2 }, OPENED);
    assert.equal(restoreApplySnapshot("a", "2026-10-22T09:01:00.000Z").state, s2);
  });

  it("keeps sessions apart", () => {
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, OPENED);
    rememberApplySnapshot("b", { step: 3, visited: [1, 2, 3], state: s2 }, OPENED);
    assert.equal(restoreApplySnapshot("a", OPENED).state, s1);
    assert.equal(restoreApplySnapshot("b", OPENED).state, s2);
  });
});

// Review, 2026-10-22: a tool run (Impact is the long one) saves its draft version and only then writes
// its step into the state, through the `update` of the wizard that started it. After a remount that
// wizard is gone and the write was dropped. ApplyWizard's `update` hands such a late write to
// `updateApplySnapshot`; these pin where it lands.
describe("apply snapshots: a change that lands after the wizard unmounted", () => {
  beforeEach(() => forgetApplySnapshots());

  const OPENED = "2026-10-22T09:00:00.000Z";
  const s1 = { history: ["start", "tailor"] };
  const addImpact = (s) => ({ ...s, history: [...s.history, "impact"] });

  /** A wizard as ApplyWizard is one: restores, remembers every change, attaches while mounted. */
  const mountWizard = (id) => {
    const back = restoreApplySnapshot(id, OPENED);
    const wizard = { state: back ? back.state : { history: ["start"] }, saved: back ? back.saved : true };
    wizard.detach = attachApplyWizard(id, (recipe) => {
      wizard.state = recipe(wizard.state);
      rememberApplySnapshot(id, { step: 2, visited: [1, 2], state: wizard.state }, OPENED);
    });
    rememberApplySnapshot(id, { step: 2, visited: [1, 2], state: wizard.state }, OPENED);
    return wizard;
  };

  it("reaches the wizard mounted now when Impact finishes after a hot reload", () => {
    const first = mountWizard("a");
    first.detach();
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, OPENED);
    // The remount: the old wizard's cleanup already ran, the new one starts from the snapshot.
    const second = mountWizard("a");
    assert.deepEqual(second.state.history, ["start", "tailor"]);

    // The run started in the first wizard lands now.
    assert.equal(updateApplySnapshot("a", addImpact), true);
    assert.deepEqual(second.state.history, ["start", "tailor", "impact"]);
    assert.deepEqual(restoreApplySnapshot("a", OPENED).state.history, ["start", "tailor", "impact"]);
    assert.equal(restoreApplySnapshot("a", OPENED).saved, false, "the mounted wizard's autosave sends it");
  });

  it("goes into the snapshot, unsaved, when no wizard is mounted (left the application while it ran)", () => {
    const first = mountWizard("a");
    rememberApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, OPENED);
    savedApplySnapshot("a", { step: 2, visited: [1, 2], state: s1 }, "2026-10-22T09:01:00.000Z");
    first.detach();

    assert.equal(updateApplySnapshot("a", addImpact), true);
    // Reopened: the refetched session is this page's own last save, so the snapshot wins and is saved again.
    const back = restoreApplySnapshot("a", "2026-10-22T09:01:00.000Z");
    assert.deepEqual(back.state.history, ["start", "tailor", "impact"]);
    assert.equal(back.saved, false);
  });

  it("keeps the new wizard attached when the old one's cleanup runs after the new one mounted", () => {
    const first = mountWizard("a");
    const second = mountWizard("a");
    first.detach();
    updateApplySnapshot("a", addImpact);
    assert.deepEqual(second.state.history, ["start", "impact"]);
    assert.deepEqual(first.state.history, ["start"]);
  });

  it("has nowhere to put a change for a session this page never held", () => {
    assert.equal(updateApplySnapshot("gone", addImpact), false);
    assert.equal(restoreApplySnapshot("gone", OPENED), null);
  });

  it("keeps sessions apart", () => {
    const a = mountWizard("a");
    mountWizard("b").detach();
    updateApplySnapshot("b", addImpact);
    assert.deepEqual(a.state.history, ["start"]);
    assert.deepEqual(restoreApplySnapshot("b", OPENED).state.history, ["start", "impact"]);
  });
});
