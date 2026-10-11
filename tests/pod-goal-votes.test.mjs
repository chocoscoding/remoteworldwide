// Pod goal votes as the screen applies them before the server answers (app/lib/pod/goalVotes.ts).
// A vote is about the goal itself: an upvote adds or keeps it, a downvote drops it, and you can take
// yours back. Votes count against the whole pod, the backend's own rule: a majority of upvotes adds a
// new goal, a majority of downvotes rejects it or removes a goal under review, anything short of a
// majority changes nothing. "Suggest removing" is your downvote and opens a review.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// The module's imports are type-only, so no resolve hook is needed.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { ME, applyRemovalSuggestion, applySuggestion, applyVote, isPendingGoal, myVote, tally, withMyVote } = await import(
  "../app/lib/pod/goalVotes.ts"
);

const NOW = "2026-10-09T12:00:00.000Z";

const goal = (over = {}) => ({
  id: "g1",
  kind: "custom",
  label: "Five a week",
  target: 5,
  current: 0,
  unit: "applications",
  protected: false,
  votes: [],
  status: "active",
  ...over,
});

const overview = (goals, memberCount = 3, voteMajority = 2) => ({
  pod: { memberCount, voteMajority },
  members: [],
  moving: [],
  goals,
});

const up = (memberName) => ({ memberName, choice: "for" });
const down = (memberName) => ({ memberName, choice: "against" });
const goalOf = (o, id = "g1") => o.goals.find((g) => g.id === id);

describe("your vote", () => {
  it("changes in place rather than counting you twice", () => {
    const votes = withMyVote([up("Grace"), up(ME)], "against");
    assert.deepEqual(votes, [up("Grace"), down(ME)]);
    assert.deepEqual(tally({ votes }), { up: 1, down: 1 });
    assert.equal(myVote({ votes }), "against");
  });

  it("is added when you had none", () => {
    assert.deepEqual(withMyVote([up("Grace")], "for"), [up("Grace"), up(ME)]);
    assert.equal(myVote({ votes: [up("Grace")] }), null);
  });

  it("can be taken back", () => {
    assert.deepEqual(withMyVote([up("Grace"), down(ME)], null), [up("Grace")]);
    const o = overview([goal({ status: "voting-add", proposedAt: NOW, votes: [up(ME)] })]);
    assert.deepEqual(goalOf(applyVote(o, "g1", null)).votes, []);
  });
});

describe("a new goal", () => {
  it("goes live once its upvotes reach the pod's majority", () => {
    const o = overview([goal({ status: "voting-add", proposedAt: NOW, votes: [up("Grace")] })]);
    const next = applyVote(o, "g1", "for");
    assert.equal(goalOf(next).status, "active");
    assert.equal(goalOf(next).proposedAt, undefined);
  });

  it("stays up for a vote short of a majority either way", () => {
    const o = overview([goal({ status: "voting-add", proposedAt: NOW })]);
    assert.equal(goalOf(applyVote(o, "g1", "for")).status, "voting-add");
    assert.equal(goalOf(applyVote(o, "g1", "against")).status, "voting-add");
  });

  it("is rejected once a majority of the pod downvotes it", () => {
    const o = overview([goal({ status: "voting-add", proposedAt: NOW, votes: [down("Grace")] })]);
    assert.equal(goalOf(applyVote(o, "g1", "against")), undefined);
  });

  it("lands as a pending suggestion that can't be voted on yet", () => {
    const next = applySuggestion(overview([]), { kind: "prep", label: "Two mocks", target: 2, unit: "mocks" }, "pending-1", NOW);
    const added = goalOf(next, "pending-1");
    assert.equal(added.status, "voting-add");
    assert.equal(added.proposedBy, ME);
    assert.ok(isPendingGoal(added));
    assert.ok(!isPendingGoal(goal()));
  });
});

describe("suggesting a removal", () => {
  it("is your downvote, and keeps the upvotes that voted the goal in", () => {
    const o = overview([goal({ votes: [up(ME), up("Grace")] })]);
    const next = goalOf(applyRemovalSuggestion(o, "g1", NOW));
    assert.equal(next.status, "voting-remove");
    assert.equal(next.proposedBy, ME);
    assert.equal(next.proposedAt, NOW);
    assert.deepEqual(next.votes, [down(ME), up("Grace")]);
  });

  it("never removes the goal on its own while anyone else is in the pod", () => {
    const o = overview([goal({ votes: [] })]);
    assert.equal(goalOf(applyRemovalSuggestion(o, "g1", NOW)).status, "voting-remove");
  });

  it("removes at once in a pod of one", () => {
    const o = overview([goal({ votes: [up(ME)] })], 1, 1);
    assert.equal(goalOf(applyRemovalSuggestion(o, "g1", NOW)), undefined);
  });

  it("leaves the protected goal and goals already up for a vote alone", () => {
    const o = overview([goal({ protected: true }), goal({ id: "g2", status: "voting-add", proposedAt: NOW })]);
    assert.equal(applyRemovalSuggestion(o, "g1", NOW), o);
    assert.equal(applyRemovalSuggestion(o, "g2", NOW), o);
  });
});

describe("a goal under review", () => {
  const review = (votes, memberCount = 3, voteMajority = 2) =>
    overview([goal({ status: "voting-remove", proposedBy: "Grace", proposedAt: NOW, votes })], memberCount, voteMajority);

  it("stays while short of a majority either way", () => {
    assert.equal(goalOf(applyVote(review([down("Grace")]), "g1", "for")).status, "voting-remove");
    assert.equal(goalOf(applyVote(review([down("Grace"), up("Alan")], 5, 3), "g1", "for")).status, "voting-remove");
  });

  it("moves back up when your upvote makes the majority", () => {
    const kept = goalOf(applyVote(review([down("Grace"), up("Alan")]), "g1", "for"));
    assert.equal(kept.status, "active");
    assert.equal(kept.proposedAt, undefined);
    assert.equal(kept.proposedBy, undefined);
  });

  it("is not closed as it opens by the upvotes that voted the goal in", () => {
    const o = overview([goal({ votes: [up("Grace"), up("Alan")] })]);
    assert.equal(goalOf(applyRemovalSuggestion(o, "g1", NOW)).status, "voting-remove");
  });

  it("is not moved up by taking your downvote back", () => {
    assert.equal(goalOf(applyVote(review([down(ME), up("Grace"), up("Alan")]), "g1", null)).status, "voting-remove");
  });

  it("goes once a majority of the pod downvotes it", () => {
    assert.equal(goalOf(applyVote(review([down("Grace"), up("Alan")]), "g1", "against")), undefined);
  });

  it("goes when you switch your upvote to a downvote and that makes the majority", () => {
    assert.equal(goalOf(applyVote(review([down("Grace"), up(ME)]), "g1", "against")), undefined);
  });

  it("counts against the whole pod, not only the upvotes cast", () => {
    // A pod of five needs three: two down and one up is more down, but not a majority.
    const o = review([down("Grace"), up("Alan")], 5, 3);
    assert.equal(goalOf(applyVote(o, "g1", "against")).status, "voting-remove");
  });
});
