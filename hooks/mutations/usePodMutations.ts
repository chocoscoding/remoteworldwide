"use client";

// Every pod action, as one hook.
//
// Each endpoint answers with the whole overview, so success is `setQueryData`
// with the response — no refetch, no partial patching, and the cache is always
// exactly what the server stored.
//
// Only the fire reaction is optimistic. It is the one action people fire off
// repeatedly and expect to feel instant; everything else is a deliberate act
// where a moment of latency reads as the thing being saved. Optimism costs a
// rollback path, so it is spent where it buys something.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPatch, apiPost } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
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
    (data) => toast.success("You're in a pod", { description: data.pod?.criteria ?? "Say hello — a pod notices a new name." }),
  );

export const useCreatePod = () =>
  usePodAction<string>(
    (name) => apiPost<PodOverview>("/api/pod/create", { name }),
    (data) => toast.success(`${data.pod?.name ?? "Your pod"} is open`, { description: "Invite someone — a pod of one is just a to-do list." }),
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
    () => toast.success("You're in", { description: "Say hello on What's moving — a pod notices a new name." }),
  );

export const useLeavePod = () =>
  usePodAction<void>(
    () => apiPost<PodOverview>("/api/pod/leave"),
    () => toast.success("You left your pod", { description: "You can join or start another whenever you want." }),
  );

export const useSharePost = () =>
  usePodAction<{ text: string; hot?: boolean }>(
    (body) => apiPost<PodOverview>("/api/pod/posts", body),
    () => toast.success("Shared with your pod", { description: "It's on What's moving — they'll see it." }),
  );

export const useSuggestGoal = () =>
  usePodAction<SuggestGoalBody>(
    (body) => apiPost<PodOverview>("/api/pod/goals", body),
    () => toast.success("Suggested", { description: "Your pod votes on it — a majority makes it live." }),
  );

export const useSuggestRemoval = () =>
  usePodAction<string>(
    (goalId) => apiPost<PodOverview>(`/api/pod/goals/${goalId}/removal`),
    () => toast.success("Vote opened", { description: "A majority retires the goal." }),
  );

export const useCastVote = () => usePodAction<{ goalId: string; choice: "for" | "against" }>(({ goalId, choice }) => apiPost<PodOverview>(`/api/pod/goals/${goalId}/vote`, { choice }));

export const useLogDay = () => usePodAction<number>((apps) => apiPost<PodOverview>("/api/pod/log", { apps }));

export const useRecordWin = () =>
  usePodAction<WinBody>(
    (body) => apiPost<PodOverview>("/api/pod/wins", body),
    () => toast.success("Logged with your pod", { description: "It's on the feed and it moved the pod's goal." }),
  );

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
