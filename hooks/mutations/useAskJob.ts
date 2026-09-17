"use client";

// Ask a question about a job.
//
// No toasts, unlike the house default. Every failure is shown inline, in the
// transcript where the answer would have been, with a way forward: a 402 is a
// card linking to billing, a 429 says when to try again, anything else offers a
// retry. A toast would repeat the same message somewhere else on the screen.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { BackendError } from "@/app/lib/api/core";
import { askAboutJob, isStaleThreadError, isUnstoredAnswer } from "@/app/lib/jobs/ask";
import type { AskJobInput, AskJobResult, JobThreadItem } from "@/app/lib/jobs/types";
import type { BillingOverview } from "@/app/lib/settings/types";
import { qk } from "@/app/lib/query/keys";

export interface AskJobVariables {
  /** Names the thread's cache entry, which is keyed by saved job rather than by thread. */
  savedJobId: string;
  threadId: string;
  input: AskJobInput;
}

/**
 * Writes an answer into its thread.
 *
 * A charged answer was generated and stored by this very request, so it is
 * appended as returned and its quick question is marked answered, without a
 * refetch. A repeat is already on the thread, so nothing changes.
 *
 * That leaves an uncharged answer the thread does not hold yet. It is either
 * one a concurrent request generated and stored, which a refetch brings in, or
 * the "upload a resume" reply to "Am I a fit?", which is never stored. That
 * reply is recognised by its id (`isUnstoredAnswer`) and left alone: a refetch
 * could never find it, and each one spends a rate-limited open, once per click
 * of a chip that stays enabled because the reply is never stored.
 */
function storeAnswer(queryClient: QueryClient, { savedJobId, threadId }: AskJobVariables, result: AskJobResult) {
  const key = qk.jobThreads.forSavedJob(savedJobId);
  const thread = queryClient.getQueryData<JobThreadItem>(key);
  // The thread was reopened while this ask was out, so the answer belongs to a
  // thread that is no longer on screen.
  if (!thread || thread.id !== threadId) return;
  if (thread.entries.some((entry) => entry.id === result.entry.id)) return;

  if (!result.charged) {
    if (!isUnstoredAnswer(result.entry)) void queryClient.invalidateQueries({ queryKey: key });
    return;
  }

  const { questionId } = result.entry;
  queryClient.setQueryData<JobThreadItem>(key, {
    ...thread,
    entries: [...thread.entries, result.entry],
    answeredQuestionIds:
      questionId && !thread.answeredQuestionIds.includes(questionId) ? [...thread.answeredQuestionIds, questionId] : thread.answeredQuestionIds,
  });
}

/**
 * The sidebar's credit meter reads the billing overview. When the spend
 * reported a balance, it goes in immediately so the meter moves with the
 * answer. The overview is refetched either way, because its ledger changed too.
 */
function storeBalance(queryClient: QueryClient, credits: number | null) {
  if (credits !== null) {
    queryClient.setQueryData<BillingOverview>(qk.billing.overview(), (overview) =>
      overview ? { ...overview, subscription: { ...overview.subscription, creditBalance: credits } } : overview,
    );
  }
  void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
}

export function useAskJob() {
  const queryClient = useQueryClient();
  return useMutation<AskJobResult, unknown, AskJobVariables>({
    mutationFn: ({ threadId, input }) => askAboutJob(threadId, input),
    onSuccess: (result, vars) => {
      storeAnswer(queryClient, vars, result);
      if (result.charged) storeBalance(queryClient, result.credits);
    },
    onError: (error, vars) => {
      if (isStaleThreadError(error)) {
        // 409: the saved job's text changed after the thread opened. 404: the
        // thread is gone. Either way, opening again gets the right thread, and
        // a retry then asks on that one.
        void queryClient.invalidateQueries({ queryKey: qk.jobThreads.forSavedJob(vars.savedJobId) });
      } else if (error instanceof BackendError && error.status === 402) {
        // A refusal means the balance the sidebar shows is out of date.
        storeBalance(queryClient, null);
      }
    },
  });
}
