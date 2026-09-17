"use client";

// The pod context, backed by the API.
//
// It supplies the exact shape `PodProvider` does, and it is mounted *inside*
// the shell on /dashboard/pod. `useContext` resolves to the nearest provider,
// so `usePod()` reads live data on that route and the mock everywhere else —
// including /dashboard/pod/demo, which simply doesn't mount this. That is what
// lets InvitePodDialog, JoinPodDialog and ManageGoalsDialog work, unchanged, in
// both trees.
//
// The mock's context is re-exported through `usePod`, so nothing imports from
// here except the live page.

import { createContext, useContext, type FC, type ReactNode } from "react";
import { usePodQuery } from "@/hooks/queries/usePodQuery";
import {
  useCastVote,
  useCreatePod,
  useJoinPod,
  useLeavePod,
  useLogDay,
  useMatchPod,
  useRecordWin,
  useRenamePod,
  useSharePost,
  useSuggestGoal,
  useSuggestRemoval,
  useToggleFire,
  useToggleMute,
} from "@/hooks/mutations/usePodMutations";
import { JOIN_PATH, JOIN_PARAM } from "@/app/lib/dashboard/pod-invite";
import type { JoinResult } from "@/app/lib/dashboard/pod-invite";
import type { PodMember, PodOverview } from "@/app/lib/pod/types";
import type { PodGoalKind } from "@/app/lib/dashboard/types";
import type { WinRecord } from "@/app/lib/dashboard/win";
import { PodCtx, type PodContextValue } from "./PodProvider";

// Extends the shared context rather than restating it: if PodProvider grows a
// member, this stops compiling instead of silently diverging on one route.
interface LivePodValue extends PodContextValue {
  overview: PodOverview;
  members: PodMember[];
  /** True while any pod write is in flight — the screen disables what it must. */
  busy: boolean;
  matching: boolean;
  joinWithCode: (input: string) => Promise<JoinResult>;
  logDay: (apps: number) => void;
}

const LivePodCtx = createContext<LivePodValue | null>(null);

/** Maps an API refusal onto the refusal vocabulary the join dialog renders. */
function refusalOf(message: string): Exclude<JoinResult, "joined"> {
  const text = message.toLowerCase();
  if (text.includes("full")) return "full";
  if (text.includes("closed")) return "pod-closed";
  if (text.includes("already in a pod")) return "already-in-pod";
  return "invalid";
}

export const LivePodProvider: FC<{ initial: PodOverview; children: ReactNode }> = ({ initial, children }) => {
  const { data } = usePodQuery(initial);

  const match = useMatchPod();
  const create = useCreatePod();
  const rename = useRenamePod();
  const mute = useToggleMute();
  const join = useJoinPod();
  const leave = useLeavePod();
  const share = useSharePost();
  const fire = useToggleFire();
  const suggest = useSuggestGoal();
  const removal = useSuggestRemoval();
  const vote = useCastVote();
  const log = useLogDay();
  const win = useRecordWin();

  const pod = data.pod;
  const busy = [match, create, rename, mute, join, leave, share, suggest, removal, vote, log, win].some((m) => m.isPending);

  const value: LivePodValue = {
    overview: data,
    members: data.members,
    inPod: pod !== null,
    capacity: pod?.capacity ?? 10,
    memberCount: pod?.memberCount ?? 0,
    seatsLeft: pod?.seatsLeft ?? 0,
    inviteCode: pod?.inviteCode ?? "",
    podName: pod?.name ?? "",
    isOwner: pod?.isOwner ?? false,
    soleMember: pod?.soleMember ?? false,
    muted: pod?.muted ?? false,
    invitePath: (origin) => `${origin}${JOIN_PATH}?${JOIN_PARAM}=${pod?.inviteCode ?? ""}`,
    goals: data.goals,
    moving: data.moving,
    voteMajority: pod?.voteMajority ?? 1,
    busy,
    matching: match.isPending,
    joinByMatching: () => match.mutate(),
    createPod: (name) => create.mutate(name),
    renamePod: (name) => rename.mutate(name),
    toggleMute: () => mute.mutate(),
    // Resolves rather than rejects: the dialog renders the refusal inline, and
    // an unhandled rejection here would surface as a console error instead.
    joinWithCode: (input) =>
      join
        .mutateAsync(input)
        .then<JoinResult>(() => "joined")
        .catch((error: unknown) => refusalOf(error instanceof Error ? error.message : String(error))),
    leavePod: () => leave.mutate(),
    shareToPod: (text, opts) => share.mutate({ text, hot: opts?.hot }),
    toggleFire: (id) => fire.mutate(id),
    suggestGoal: (input) =>
      suggest.mutate({
        kind: input.kind as PodGoalKind,
        label: input.label,
        target: input.target,
        unit: input.unit,
        // Applications are counted per day; everything else accumulates.
        resetPeriod: input.kind === "applications" ? "daily" : "none",
      }),
    suggestRemoval: (goalId) => removal.mutate(goalId),
    castVote: (goalId, choice) => vote.mutate({ goalId, choice }),
    logDay: (apps) => log.mutate(apps),
    // The role and company ARE the identity of the win, so a double submit or a
    // retry lands on the same key and the pod goal moves once.
    recordJobWin: (record: WinRecord) =>
      win.mutate({
        text: `Landed ${record.facts.role} at ${record.facts.company} 🎉`,
        ref: `${record.facts.company}:${record.facts.role}`.toLowerCase().replace(/\s+/g, "-"),
      }),
  };

  // Both contexts: `PodCtx` is what the shared dialogs read, `LivePodCtx` adds
  // the members, the raw overview and the in-flight flag only this page needs.
  return (
    <PodCtx.Provider value={value}>
      <LivePodCtx.Provider value={value}>{children}</LivePodCtx.Provider>
    </PodCtx.Provider>
  );
};

export function useLivePod(): LivePodValue {
  const ctx = useContext(LivePodCtx);
  if (!ctx) throw new Error("useLivePod must be used within LivePodProvider");
  return ctx;
}
