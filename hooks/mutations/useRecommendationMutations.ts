"use client";

// The candidate's one write on a recommendation: answering the company's
// questions.
//
// The server does everything that used to happen here in the browser: it
// stores the answers, moves the stage to Interview, pays the credits into
// credit_ledger (once per recommendation, by reference), grants the
// answered-questions gift and logs the streak action. So this only puts the
// answered row into the cache and refreshes whatever those payouts moved.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BackendError } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
import { answerRecommendation } from "@/app/lib/recommendations/api";
import type { AnswerRecommendationInput, AnswerRecommendationResult, RecommendationItem } from "@/app/lib/recommendations/types";

export interface AnswerRecommendationVariables {
  id: string;
  answers: AnswerRecommendationInput["answers"];
}

export function useAnswerRecommendation() {
  const queryClient = useQueryClient();
  return useMutation<AnswerRecommendationResult, unknown, AnswerRecommendationVariables>({
    mutationFn: ({ id, answers }) => answerRecommendation(id, { answers }),
    onSuccess: ({ recommendation }) => {
      // Straight into both reads, so the card flips to "What you told them"
      // without waiting on a refetch.
      queryClient.setQueryData(qk.recommendations.detail(recommendation.id), recommendation);
      queryClient.setQueryData<RecommendationItem[]>(qk.recommendations.list(), (prev) =>
        prev?.map((r) => (r.id === recommendation.id ? recommendation : r)),
      );
      // The credits, the gift and the streak day all moved server-side.
      void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
      void queryClient.invalidateQueries({ queryKey: qk.activity.streak() });
      void queryClient.invalidateQueries({ queryKey: qk.activity.gifts() });
    },
    onError: (error) => {
      // 404 gone, 409 closed or the questions changed, 410 the deadline passed:
      // the screen is showing a stale recommendation, so read it again.
      if (error instanceof BackendError && [404, 409, 410].includes(error.status)) {
        void queryClient.invalidateQueries({ queryKey: qk.recommendations.all });
      }
    },
  });
}
