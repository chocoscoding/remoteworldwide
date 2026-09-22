"use client";

// Run a referral search for a saved job (or, without `refresh`, get back the
// stored one for free).
//
// No toasts, as for Ask about a job: a failure is shown where the results would
// have been, with a way forward — a 402 links to billing, anything else retries.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BackendError } from "@/app/lib/api/core";
import { runReferralSearch } from "@/app/lib/referrals/api";
import type { ReferralSearchResult } from "@/app/lib/referrals/types";
import { qk } from "@/app/lib/query/keys";
import { storeBalance } from "./useAskJob";

export interface RunReferralSearchVariables {
  savedJobId: string;
  refresh?: boolean;
}

export function useRunReferralSearch() {
  const queryClient = useQueryClient();
  return useMutation<ReferralSearchResult, unknown, RunReferralSearchVariables>({
    mutationFn: ({ savedJobId, refresh }) => runReferralSearch(savedJobId, refresh === true),
    onSuccess: (result, { savedJobId }) => {
      queryClient.setQueryData(qk.referrals.forSavedJob(savedJobId), result.search);
      if (result.charged) storeBalance(queryClient, result.credits);
    },
    onError: (error) => {
      // A refusal means the balance the sidebar shows is out of date.
      if (error instanceof BackendError && error.status === 402) storeBalance(queryClient, null);
    },
  });
}
