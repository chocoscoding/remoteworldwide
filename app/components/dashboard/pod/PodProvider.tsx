"use client";

// The pod context's shape, shared by the pod screen's dialogs.
//
// `LivePodProvider` (mounted by /dashboard/pod) is the only provider: it backs
// this context with the API, so InvitePodDialog, JoinPodDialog, ManageGoalsDialog
// and the rest read `usePod()` without knowing where the data comes from. Pod
// posts made from elsewhere in the dashboard (a landed job, a tracker step) go
// to the API directly through the pod mutations instead.

import { createContext, useContext } from "react";
import type { JoinResult } from "@/app/lib/dashboard/pod-invite";
import type { PodGoal, PodGoalKind } from "@/app/lib/dashboard/types";
import type { WinRecord } from "@/app/lib/dashboard/win";

/** One row of "What's moving" — the pod's shared feed. */
export interface PodMovingItem {
  id: string;
  text: string;
  time: string;
  /** Fire-reaction count. The fire is the only reaction — one tap, one dopamine hit. */
  fires: number;
  firedByMe: boolean;
  hot?: boolean;
  /** True for items you shared — the pod screen labels them quietly. */
  mine?: boolean;
}

export interface SuggestedGoal {
  kind: PodGoalKind;
  label: string;
  target: number;
  unit: string;
}

export interface PodContextValue {
  /** Whether you are in a pod at all. Leaving drops you to solo. */
  inPod: boolean;
  /** Ten. Exposed so every surface quotes the same number. */
  capacity: number;
  /** Members counting you when you are in; the seats left follow from it. */
  memberCount: number;
  seatsLeft: number;
  /** This pod's invite code — what you hand out, and what the link carries. */
  inviteCode: string;
  /** What the pod calls itself. Sits beside "Your pod" in the header. */
  podName: string;
  /** You own it, which is what gates renaming. */
  isOwner: boolean;
  /** You are the only one here, so leaving deletes the pod. The confirm dialog
   *  branches on this, and it has to know before the click. */
  soleMember: boolean;
  /** You have muted this pod's notifications. Never silences your own membership. */
  muted: boolean;
  /** The full link for this pod, built against the current origin. */
  invitePath: (origin: string) => string;
  /** The company's own route back in: matched by role, band and timezone. */
  joinByMatching: () => void;
  /** Starts a pod of your own, which is what makes you its owner. */
  createPod: (name: string) => void;
  /** Owner only. */
  renamePod: (name: string) => void;
  toggleMute: () => void;
  /**
   * Joins with a pasted code or invite link. Refuses if you are already in a
   * pod — an invite moves someone with no pod, never poaches one who has one.
   */
  joinWithCode: (input: string) => JoinResult | Promise<JoinResult>;
  leavePod: () => void;

  moving: PodMovingItem[];
  /** Prepends an update to What's moving as "just now". Everything that
   *  feels share-worthy anywhere in the dashboard funnels through this. */
  shareToPod: (text: string, opts?: { hot?: boolean }) => void;
  toggleFire: (id: string) => void;

  goals: PodGoal[];
  /** Majority needed to resolve a vote — derived from pod size. */
  voteMajority: number;
  suggestGoal: (input: SuggestedGoal) => void;
  /** Your downvote on a live goal, which puts it under review (app/lib/pod/goalVotes.ts). */
  suggestRemoval: (goalId: string) => void;
  /** An upvote ("for") or downvote ("against") on the goal itself, add or review alike; null takes yours back. */
  castVote: (goalId: string, choice: "for" | "against" | null) => void;

  /**
   * The whole reason a job win is worth logging: it lands on the pod feed as
   * a hot item AND moves the pod's protected "someone lands a job" goal.
   */
  recordJobWin: (win: WinRecord) => void;
}

// Supplied by LivePodProvider on /dashboard/pod, the only place the pod's
// dialogs render.
export const PodCtx = createContext<PodContextValue | null>(null);

export function usePod(): PodContextValue {
  const ctx = useContext(PodCtx);
  if (!ctx) throw new Error("usePod must be used inside LivePodProvider");
  return ctx;
}
