"use client";

// Every pod action, as one hook.
//
// Each endpoint answers with the whole overview, so success is `setQueryData`
// with the response — no refetch, no partial patching, and the cache is always
// exactly what the server stored.
//
// The fire reaction and the goal votes are optimistic: people tap them in quick
// runs and expect the screen to move with the tap. Everything else is a
// deliberate act where a moment of latency reads as the thing being saved.
// Optimism costs a rollback path, so it is spent where it buys something.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiPatch, apiPost } from "@/app/lib/api/client";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
import { PENDING_GOAL_PREFIX, applyRemovalSuggestion, applySuggestion, applyVote } from "@/app/lib/pod/goalVotes";
import type { PodGoalKind, PodOverview } from "@/app/lib/pod/types";

export interface SuggestGoalBody {
  kind: PodGoalKind;
  label: string;
  target: number;
  unit: string;
  /** "a day" has to mean a day — without this the counter ratchets and reads full forever. */
  resetPeriod?: "none" | "daily" | "weekly";
}

export interface WinBody {
  text?: string;
  /** Idempotency key, so a retried win cannot count twice. */
  ref?: string;
}

/** Shared shape: one POST, the overview back, the cache replaced. */
function usePodAction<V>(request: (vars: V) => Promise<PodOverview>, onDone?: (data: PodOverview, vars: V) => void) {
  const queryClient = useQueryClient();

  return useMutation<PodOverview, unknown, V>({
    mutationFn: request,
    onSuccess: (data, vars) => {
      queryClient.setQueryData(qk.pod.overview(), data);
      onDone?.(data, vars);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
}

export const useMatchPod = () =>
  usePodAction<void>(
    () => apiPost<PodOverview>("/api/pod/match"),
    // The server decides how it matched and says so in `criteria`, so the toast quotes it rather
    // than repeating a claim the matcher may not have been able to honour.
    (data) => toast.success("You're in a pod", { description: data.pod?.criteria ?? "Say hello. A pod notices a new name." }),
  );

export const useCreatePod = () =>
  usePodAction<string>(
    (name) => apiPost<PodOverview>("/api/pod/create", { name }),
    (data) => toast.success(`${data.pod?.name ?? "Your pod"} is open`, { description: "Invite someone. A pod of one is just a to-do list." }),
  );

export const useRenamePod = () => usePodAction<string>((name) => apiPatch<PodOverview>("/api/pod/name", { name }));

export const useToggleMute = () =>
  usePodAction<void>(
    () => apiPost<PodOverview>("/api/pod/mute"),
    (data) =>
      toast.success(data.pod?.muted ? "Pod muted" : "Pod unmuted", {
        description: data.pod?.muted ? "You'll still hear about your own membership." : "You'll hear about your pod again.",
      }),
  );

export const useJoinPod = () =>
  usePodAction<string>(
    (code) => apiPost<PodOverview>("/api/pod/join", { code }),
    () => toast.success("You're in", { description: "Say hello on What's moving. A pod notices a new name." }),
  );

export const useLeavePod = () =>
  usePodAction<void>(
    () => apiPost<PodOverview>("/api/pod/leave"),
    () => toast.success("You left your pod", { description: "You can join or start another whenever you want." }),
  );

export const useSharePost = () =>
  usePodAction<{ text: string; hot?: boolean }>(
    (body) => apiPost<PodOverview>("/api/pod/posts", body),
    () => toast.success("Shared with your pod", { description: "It's on What's moving, where they'll see it." }),
  );

const POD_GOAL_WRITES = ["pod", "goal-write"] as const;

/**
 * A goal write, shown before the round trip: `patch` applies it to the cached overview at the
 * click, and the server's overview replaces the guess when it answers.
 *
 * Goal writes share a scope, so they reach the server one at a time in click order: "upvote, then
 * downvote" can never be stored as "downvote, then upvote". And only the last write still in flight
 * stores the server's answer, because an earlier answer would briefly undo the clicks made since.
 */
function useOptimisticGoalWrite<V>(request: (vars: V) => Promise<PodOverview>, patch: (old: PodOverview, vars: V) => PodOverview, onDone?: () => void) {
  const queryClient = useQueryClient();
  const isLastWrite = () => queryClient.isMutating({ mutationKey: POD_GOAL_WRITES }) <= 1;

  return useMutation<PodOverview, unknown, V, { previous?: PodOverview }>({
    mutationKey: POD_GOAL_WRITES,
    scope: { id: "pod-goal-writes" },
    mutationFn: request,

    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: qk.pod.overview() });
      const previous = queryClient.getQueryData<PodOverview>(qk.pod.overview());
      queryClient.setQueryData<PodOverview>(qk.pod.overview(), (old) => (old ? patch(old, vars) : old));
      return { previous };
    },

    onSuccess: (data) => {
      if (isLastWrite()) queryClient.setQueryData(qk.pod.overview(), data);
      onDone?.();
    },

    // The rollback is the screen as it was before this click, and the refetch is the truth: someone
    // else may have voted, or the vote may have closed, in the meantime.
    onError: (error, _vars, context) => {
      toast.error(apiMessage(error));
      if (!isLastWrite()) return;
      if (context?.previous) queryClient.setQueryData(qk.pod.overview(), context.previous);
      void queryClient.invalidateQueries({ queryKey: qk.pod.overview() });
    },
  });
}

export const useSuggestGoal = () =>
  useOptimisticGoalWrite<SuggestGoalBody>(
    (body) => apiPost<PodOverview>("/api/pod/goals", body),
    (old, body) => applySuggestion(old, body, `${PENDING_GOAL_PREFIX}${Date.now()}`, new Date().toISOString()),
    () => toast.success("Suggested", { description: "Your pod votes on it. A majority of upvotes makes it live." }),
  );

export const useSuggestRemoval = () =>
  useOptimisticGoalWrite<string>(
    (goalId) => apiPost<PodOverview>(`/api/pod/goals/${goalId}/removal`),
    (old, goalId) => applyRemovalSuggestion(old, goalId, new Date().toISOString()),
    () => toast.success("Downvoted", { description: "Your pod is reviewing it. It goes if a majority of the pod downvotes it." }),
  );

/** An upvote, a downvote, or `choice: null` to take yours back. */
export const useCastVote = () =>
  useOptimisticGoalWrite<{ goalId: string; choice: "for" | "against" | null }>(
    ({ goalId, choice }) =>
      choice === null ? apiDelete<PodOverview>(`/api/pod/goals/${goalId}/vote`) : apiPost<PodOverview>(`/api/pod/goals/${goalId}/vote`, { choice }),
    (old, { goalId, choice }) => applyVote(old, goalId, choice),
  );

export const useLogDay = () => usePodAction<number>((apps) => apiPost<PodOverview>("/api/pod/log", { apps }));

export const useRecordWin = () =>
  usePodAction<WinBody>(
    (body) => apiPost<PodOverview>("/api/pod/wins", body),
    () => toast.success("Logged with your pod", { description: "It's on the feed and it moved the pod's goal." }),
  );

/**
 * The win log's pod post. Same endpoint as `useRecordWin`, but fired from the
 * dashboard shell: WinProvider sits above the pod screen's LivePodProvider, so
 * the `recordJobWin` it would read from `usePod()` is the walkthrough's mock,
 * which posts nowhere and toasts that it did.
 *
 * Being in no pod is not an error here — the win still happened, there is just
 * no pod to tell — so the server's 409 resolves to null and says nothing,
 * rather than landing a refusal on top of the celebration. The toast fires only
 * on the server's answer, so "on your pod's board" is never a guess.
 */
export function useRecordJobWin() {
  const queryClient = useQueryClient();

  return useMutation<PodOverview | null, unknown, WinBody>({
    mutationFn: async (body) => {
      try {
        return await apiPost<PodOverview>("/api/pod/wins", body);
      } catch (error) {
        if (error instanceof BackendError && error.status === 409) return null;
        throw error;
      }
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.setQueryData(qk.pod.overview(), data);
      toast.success("On your pod's board", { description: "Your win is on What's moving, where they'll see it." });
    },
    onError: (error) => toast.error("Your pod didn't get the news", { description: apiMessage(error) }),
  });
}

/**
 * The fire reaction, applied before the round trip. The server owns the real
 * count, so the optimistic write only flips the caller's own reaction and
 * nudges the number by one — never recomputes it.
 */
export function useToggleFire() {
  const queryClient = useQueryClient();

  return useMutation<PodOverview, unknown, string, { previous?: PodOverview }>({
    mutationFn: (postId) => apiPost<PodOverview>(`/api/pod/posts/${postId}/fire`),

    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: qk.pod.overview() });
      const previous = queryClient.getQueryData<PodOverview>(qk.pod.overview());

      queryClient.setQueryData<PodOverview>(qk.pod.overview(), (old) =>
        old
          ? {
              ...old,
              moving: old.moving.map((item) =>
                item.id === postId ? { ...item, firedByMe: !item.firedByMe, fires: item.fires + (item.firedByMe ? -1 : 1) } : item,
              ),
            }
          : old,
      );

      return { previous };
    },

    onError: (error, _postId, context) => {
      if (context?.previous) queryClient.setQueryData(qk.pod.overview(), context.previous);
      toast.error(apiMessage(error));
    },

    onSuccess: (data) => queryClient.setQueryData(qk.pod.overview(), data),
  });
}
