// Pod goal votes, applied on the screen before the server answers.
//
// Every goal write is optimistic (hooks/mutations/usePodMutations.ts): a click changes the pod
// goals dialog at once, and the server's overview replaces the guess when it lands. These are the
// patches, pure so they can be tested, and held to the rules the backend resolves with
// (remoteworldwidebackend podService):
//
//  - a vote is always about the goal: "for" is an upvote (add it, keep it), "against" a downvote,
//    and you can take yours back;
//  - votes count against the whole pod: a new goal goes live at a majority of upvotes and is
//    rejected at a majority of downvotes; a goal under review goes at a majority of downvotes, and
//    moves back up at a majority of upvotes once one of them is cast during the review;
//  - short of a majority either way, nothing changes until the 7 days run out;
//  - "Suggest removing" is the caller's downvote, and puts the goal under review.
//
// Type-only imports, so `npm test` loads this file without a resolve hook.

import type { PodGoal, PodGoalVote } from "@/app/lib/dashboard/types";
import type { PodOverview } from "./types";

type Choice = PodGoalVote["choice"];

/** How the server names the caller, in a vote and as a proposer. */
export const ME = "You";

/**
 * The "goal under review" notification links to `/dashboard/pod?goal=<id>` (backend
 * `announceReview`), which opens the goals dialog on that goal.
 */
export const GOAL_LINK_PARAM = "goal";

/** The id a suggestion carries until the server gives it a real one. Nothing can be voted on until then. */
export const PENDING_GOAL_PREFIX = "pending-";

export const isPendingGoal = (goal: Pick<PodGoal, "id">): boolean => goal.id.startsWith(PENDING_GOAL_PREFIX);

export function tally(goal: Pick<PodGoal, "votes">): { up: number; down: number } {
  const down = goal.votes.filter((vote) => vote.choice === "against").length;
  return { up: goal.votes.length - down, down };
}

export const myVote = (goal: Pick<PodGoal, "votes">): Choice | null => goal.votes.find((vote) => vote.memberName === ME)?.choice ?? null;

/** Your vote changed in place, added at the end, or taken back (null), so the tally never counts you twice. */
export function withMyVote(votes: PodGoalVote[], choice: Choice | null): PodGoalVote[] {
  const others = votes.filter((vote) => vote.memberName !== ME);
  if (choice === null) return others;
  const mine: PodGoalVote = { memberName: ME, choice };
  return votes.some((vote) => vote.memberName === ME) ? votes.map((vote) => (vote.memberName === ME ? mine : vote)) : [...others, mine];
}

/**
 * The backend's `verdictFor`: what a goal up for a vote becomes with these votes, null when it is off
 * the list. A review moves back up at a majority of upvotes only when one of them was cast during it
 * (`upvotedNow`): the upvotes that voted the goal in still stand, and alone they would close every
 * review the moment it opened. The server knows when each vote landed; here it is only ever yours.
 */
export function settle(goal: PodGoal, majority: number, upvotedNow = false): PodGoal | null {
  const { up, down } = tally(goal);
  if (goal.status === "voting-add") {
    if (up >= majority) return { ...goal, status: "active", proposedAt: undefined };
    return down >= majority ? null : goal;
  }
  if (goal.status === "voting-remove") {
    if (down >= majority) return null;
    if (up >= majority && upvotedNow) return { ...goal, status: "active", proposedAt: undefined, proposedBy: undefined };
  }
  return goal;
}

const majorityOf = (overview: PodOverview): number => overview.pod?.voteMajority ?? 1;

/** Swaps one goal for its next state; null takes it off the list. */
function withGoal(overview: PodOverview, goalId: string, next: PodGoal | null): PodOverview {
  return {
    ...overview,
    goals: next ? overview.goals.map((goal) => (goal.id === goalId ? next : goal)) : overview.goals.filter((goal) => goal.id !== goalId),
  };
}

/** Your upvote, downvote or taking your vote back (null) on a goal up for a vote, resolved the way the server will. */
export function applyVote(overview: PodOverview, goalId: string, choice: Choice | null): PodOverview {
  const goal = overview.goals.find((g) => g.id === goalId);
  if (!goal || goal.status === "active") return overview;
  return withGoal(overview, goalId, settle({ ...goal, votes: withMyVote(goal.votes, choice) }, majorityOf(overview), choice === "for"));
}

/** "Suggest removing": your downvote, and the goal goes under review with its upvotes standing. */
export function applyRemovalSuggestion(overview: PodOverview, goalId: string, nowIso: string): PodOverview {
  const goal = overview.goals.find((g) => g.id === goalId);
  if (!goal || goal.status !== "active" || goal.protected) return overview;

  const opened: PodGoal = { ...goal, status: "voting-remove", proposedBy: ME, proposedAt: nowIso, votes: withMyVote(goal.votes, "against") };
  return withGoal(overview, goalId, settle(opened, majorityOf(overview)));
}

export interface GoalSuggestion {
  kind: PodGoal["kind"];
  label: string;
  target: number;
  unit: string;
}

/** A suggestion lands in "Up for a vote" at once, under a pending id until the server names it. */
export function applySuggestion(overview: PodOverview, input: GoalSuggestion, id: string, nowIso: string): PodOverview {
  const goal: PodGoal = {
    id,
    kind: input.kind,
    label: input.label,
    target: input.target,
    current: 0,
    unit: input.unit,
    protected: false,
    proposedBy: ME,
    votes: [],
    status: "voting-add",
    proposedAt: nowIso,
  };
  return { ...overview, goals: [...overview.goals, goal] };
}
