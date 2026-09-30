"use client";

// Every action on a saved interview-prep session.
//
// The AI service owns the sessions, so the cache is refreshed rather than
// patched wherever the service decides what happens next (a finish queues an
// analysis, a retry starts one, a delete purges storage). The two exceptions
// answer with the new state themselves: a rating returns the rating, and an
// unlock returns the whole detail, so those are written straight in.
//
// Toasts follow the house default, except where the screen shows the failure
// in place: create (the live screen explains a 402, 409 or 429 with a way
// forward), finish (the capture retries and reports), and unlock (the locked
// report shows a 402 next to its top-up link).

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
import {
  createPrepSession,
  deletePrepSession,
  finishPrepSession,
  getPartUrls,
  insufficientCreditsOf,
  ratePrepSession,
  retryPrepSession,
  unlockPrepSession,
} from "@/app/lib/voice/api";
import type {
  CreatePrepSessionInput,
  CreatePrepSessionResult,
  DeletePrepSessionResult,
  FinishPrepSessionInput,
  FinishPrepSessionResult,
  PartUrlsResult,
  PrepRating,
  PrepSessionDetail,
  RetryPrepSessionResult,
  UnlockPrepSessionResult,
} from "@/app/lib/voice/types";

/** Every track's list, and the all-sessions list, at once. */
function refreshLists(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: qk.prep.sessionLists() });
}

function refreshSession(queryClient: QueryClient, id: string) {
  void queryClient.invalidateQueries({ queryKey: qk.prep.session(id) });
}

/** The sidebar's credit meter: a refusal or a charge means the balance it shows is out of date. */
function refreshBalance(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
}

export function useCreatePrepSession() {
  const queryClient = useQueryClient();
  return useMutation<CreatePrepSessionResult, unknown, CreatePrepSessionInput>({
    mutationFn: createPrepSession,
    onSuccess: () => refreshLists(queryClient),
    onError: (error) => {
      if (insufficientCreditsOf(error)) refreshBalance(queryClient);
    },
  });
}

export interface FinishPrepSessionVariables {
  id: string;
  body: FinishPrepSessionInput;
}

export function useFinishPrepSession() {
  const queryClient = useQueryClient();
  return useMutation<FinishPrepSessionResult, unknown, FinishPrepSessionVariables>({
    mutationFn: ({ id, body }) => finishPrepSession(id, body),
    // Settled, not only succeeded: a failed finish may still have landed.
    onSettled: (_result, _error, { id }) => {
      refreshLists(queryClient);
      refreshSession(queryClient, id);
    },
  });
}

export interface PrepPartUrlsVariables {
  id: string;
  from: number;
}

/** More presigned part URLs (also the session heartbeat). Nothing cached depends on it. */
export function usePrepPartUrls() {
  return useMutation<PartUrlsResult, unknown, PrepPartUrlsVariables>({
    mutationFn: ({ id, from }) => getPartUrls(id, from),
  });
}

export interface RatePrepSessionVariables {
  id: string;
  score: number;
}

export function useRatePrepSession() {
  const queryClient = useQueryClient();
  return useMutation<PrepRating, unknown, RatePrepSessionVariables>({
    mutationFn: ({ id, score }) => ratePrepSession(id, score),
    onSuccess: (rating, { id }) => {
      queryClient.setQueryData<PrepSessionDetail>(qk.prep.session(id), (detail) => (detail ? { ...detail, rating } : detail));
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
}

export function useUnlockPrepSession() {
  const queryClient = useQueryClient();
  return useMutation<UnlockPrepSessionResult, unknown, string>({
    mutationFn: unlockPrepSession,
    onSuccess: (detail, id) => {
      queryClient.setQueryData<PrepSessionDetail>(qk.prep.session(id), detail);
      refreshLists(queryClient);
      refreshBalance(queryClient);
    },
    onError: (error, id) => {
      refreshSession(queryClient, id);
      if (insufficientCreditsOf(error)) refreshBalance(queryClient);
    },
  });
}

export function useRetryPrepSession() {
  const queryClient = useQueryClient();
  return useMutation<RetryPrepSessionResult, unknown, string>({
    mutationFn: retryPrepSession,
    onSuccess: (_result, id) => {
      refreshSession(queryClient, id);
      refreshLists(queryClient);
    },
    onError: (error, id) => {
      // A 409 means the retries are spent or the state moved on; the detail says which.
      refreshSession(queryClient, id);
      toast.error(apiMessage(error));
    },
  });
}

export function useDeletePrepSession() {
  const queryClient = useQueryClient();
  const forget = (id: string) => {
    void queryClient.cancelQueries({ queryKey: qk.prep.session(id) });
    queryClient.removeQueries({ queryKey: qk.prep.session(id) });
    refreshLists(queryClient);
  };
  return useMutation<DeletePrepSessionResult, unknown, string>({
    mutationFn: deletePrepSession,
    onSuccess: (_result, id) => forget(id),
    onError: (error, id) => {
      // Already gone is what was asked for.
      if (error instanceof BackendError && error.status === 404) {
        forget(id);
        return;
      }
      toast.error(apiMessage(error));
    },
  });
}

/**
 * All of the above in one object, for screens that use several. `delete` is a
 * property name here, so `const { delete: remove } = usePrepSessionMutations()`.
 */
export function usePrepSessionMutations() {
  const create = useCreatePrepSession();
  const finish = useFinishPrepSession();
  const partUrls = usePrepPartUrls();
  const rating = useRatePrepSession();
  const unlock = useUnlockPrepSession();
  const retry = useRetryPrepSession();
  const remove = useDeletePrepSession();
  return { create, finish, partUrls, rating, unlock, retry, delete: remove };
}
