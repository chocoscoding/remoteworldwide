// The pod wire contract.
//
// These shapes are not free choices: `ManageGoalsDialog` consumes `PodGoal`
// from app/lib/dashboard/types.ts and the feed consumes `PodMovingItem` from
// PodProvider, so the backend serializes into those exact shapes or the
// existing dialogs stop compiling. Re-exported here rather than redeclared,
// for the same reason.
//
// The one thing the server adds is identity resolution: `name` on a member row
// or a vote is a display string, and the same row is "You" to one member and
// "Priya Sharma" to everyone else. That is per-request serialization, so the
// server sends `me` alongside the name and the UI never has to guess.

import type { PodGoal, PodGoalKind, PodGoalVote } from "@/app/lib/dashboard/types";
import type { PodMovingItem } from "@/app/components/dashboard/pod/PodProvider";

export type { PodGoal, PodGoalKind, PodGoalVote, PodMovingItem };

/** One person in the pod. Mirrors `BoardRow` plus the identity the server owns. */
export interface PodMember {
  userId: string;
  name: string;
  image: string | null;
  /** Leaderboard position by applications, 1-based. */
  rank: number;
  streak: number;
  apps: number;
  /** True for the caller's own row. */
  me: boolean;
  /** Logged something today — drives the pod-streak quorum and the nudge list. */
  loggedToday: boolean;
}

export type PodJoinRefusal = "already-in-pod" | "pod-full" | "unknown-code" | "invalid-code";

/** Everything the pod screen renders, in one call. */
export interface PodOverview {
  /** Null when the caller is in no pod — the empty state is the whole screen. */
  pod: {
    id: string;
    /** What the pod calls itself. Sits beside "Your pod" in the header. */
    name: string;
    /** The caller owns it, which is what gates renaming. */
    isOwner: boolean;
    /** The caller is the only one here, so leaving deletes the pod. The confirm dialog needs to
     *  know this before the click, which is why it rides the overview rather than a probe. */
    soleMember: boolean;
    /** The caller has muted this pod's notifications. */
    muted: boolean;
    inviteCode: string;
    capacity: number;
    memberCount: number;
    seatsLeft: number;
    /** Majority needed to resolve a goal vote, derived from pod size. */
    voteMajority: number;
    /** Consecutive days the pod hit its logging quorum. */
    streakDays: number;
    quorum: number;
    loggedTodayCount: number;
    /** How this pod was matched — shown verbatim in Pod settings. */
    criteria: string;
    weekLabel: string;
  } | null;
  members: PodMember[];
  moving: PodMovingItem[];
  goals: PodGoal[];
}
