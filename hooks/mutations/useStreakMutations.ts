"use client";

// Every streak write: redeeming a gift, repairing a break, dismissing the
// repair offer, acknowledging a celebration or a freeze, retiring the streak,
// and reporting a follow-up.
//
// None is optimistic except "seen". The server decides whether a freeze fits
// under the cap, whether a break is still repairable, whether the credits are
// there — and a streak that jumped and then fell back would be worse than one
// that moves a moment later. Each answer IS the new state, so it replaces the
// cache rather than triggering a refetch.

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import type { GiftKind } from "@/app/lib/dashboard/gifts";
import { dismissRepair, markStreakSeen, redeemGift, repairStreak, reportFollowUp, retireStreak } from "@/app/lib/streak/api";
import type { RepairMethod, StreakItem, StreakWithGifts } from "@/app/lib/streak/types";
import { qk } from "@/app/lib/query/keys";

/**
 * Refetches the streak and the gifts — after any write that may have recorded
 * an action on the server — and the pod board, which moves from the same
 * actions. Only what is on screen refetches now; the rest is marked stale.
 */
export function refreshStreak(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: qk.activity.streak() });
  void queryClient.invalidateQueries({ queryKey: qk.activity.gifts() });
  void queryClient.invalidateQueries({ queryKey: qk.pod.overview() });
}

function storeBoth(queryClient: QueryClient, data: StreakWithGifts) {
  queryClient.setQueryData(qk.activity.streak(), data.streak);
  queryClient.setQueryData(qk.activity.gifts(), data);
}

function storeStreak(queryClient: QueryClient, streak: StreakItem) {
  queryClient.setQueryData(qk.activity.streak(), streak);
  // The gift count may have moved with it; the list catches up on its next showing.
  void queryClient.invalidateQueries({ queryKey: qk.activity.gifts() });
}

/** Uses the oldest waiting gift of a kind. A refusal (the freeze cap, nothing to backfill) toasts the server's reason. */
export function useRedeemGift() {
  const queryClient = useQueryClient();
  return useMutation<StreakWithGifts, unknown, GiftKind>({
    mutationFn: redeemGift,
    onSuccess: (data) => storeBoth(queryClient, data),
    onError: (error) => toast.error(apiMessage(error), { id: "streak-gift-failed" }),
  });
}

/**
 * Buys the current break back. Out of credits is its own toast with a way to
 * top up, since it is the one refusal the user can fix on the spot.
 */
export function useRepairStreak() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation<StreakWithGifts, unknown, RepairMethod>({
    mutationFn: repairStreak,
    onSuccess: (data, method) => {
      storeBoth(queryClient, data);
      // A credit repair spent from the balance the sidebar meter shows.
      if (method === "credits") void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
    },
    onError: (error) => {
      if (error instanceof BackendError && error.status === 402) {
        toast.error(apiMessage(error), {
          id: "streak-repair-failed",
          action: { label: "Top up", onClick: () => router.push("/dashboard/settings/billing") },
        });
        return;
      }
      toast.error(apiMessage(error), { id: "streak-repair-failed" });
    },
  });
}

export function useDismissRepair() {
  const queryClient = useQueryClient();
  return useMutation<StreakItem, unknown, void>({
    mutationFn: () => dismissRepair(),
    onSuccess: (streak) => storeStreak(queryClient, streak),
    onError: (error) => toast.error(apiMessage(error), { id: "streak-dismiss-failed" }),
  });
}

/**
 * Marks celebrations shown and freeze notices told. Optimistic, and silent on
 * failure: the worst case is seeing one of them again.
 */
export function useMarkStreakSeen() {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, { milestones?: number[]; freezes?: string[] }>({
    mutationFn: markStreakSeen,
    onMutate: ({ milestones = [], freezes = [] }) => {
      queryClient.setQueryData<StreakItem>(qk.activity.streak(), (streak) =>
        streak
          ? {
              ...streak,
              milestones: streak.milestones.map((m) => (milestones.includes(m.days) ? { ...m, seen: true } : m)),
              notices: streak.notices.filter((notice) => !freezes.includes(notice.day)),
            }
          : streak,
      );
    },
  });
}

/** Hired: the streak retires at its count and the search pauses, so goals change too. */
export function useRetireStreak() {
  const queryClient = useQueryClient();
  return useMutation<StreakItem, unknown, void>({
    mutationFn: () => retireStreak(),
    onSuccess: (streak) => {
      storeStreak(queryClient, streak);
      void queryClient.invalidateQueries({ queryKey: qk.activity.goals() });
      void queryClient.invalidateQueries({ queryKey: qk.activity.summary() });
    },
    onError: (error) => toast.error(apiMessage(error), { id: "streak-retire-failed" }),
  });
}

/**
 * A follow-up on one of the user's applications — the one action the server
 * cannot see for itself. Refused quietly for a row the server does not know
 * yet: its create is still in flight, and the tracker's touch records the
 * same follow-up under the same key once it lands.
 */
export function useReportFollowUp() {
  const queryClient = useQueryClient();
  return useMutation<StreakItem, unknown, string>({
    mutationFn: reportFollowUp,
    onSuccess: (streak) => storeStreak(queryClient, streak),
  });
}
