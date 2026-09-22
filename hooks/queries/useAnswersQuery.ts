"use client";

// The saved-answer library and its use log, read through React Query.
//
// Both live in the AI service (`ai_answers`, `ai_answer_uses`) behind the
// session proxy. The library is the same store autofill reads first, so what
// this list shows is exactly what the next form gets.
//
// Not persisted to disk (see PERSISTED_DOMAINS in app/lib/query/keys.ts): the
// library holds salary, work authorisation and self-identified demographics,
// and the history names every company applied to.

import { useQuery } from "@tanstack/react-query";
import { listAnswerHistory, listAnswers } from "@/app/lib/answers/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

/** Every saved answer, newest first. Mounted app-wide by AnswersProvider. */
export function useAnswersQuery() {
  return useQuery({
    queryKey: qk.answers.list(),
    queryFn: ({ signal }) => listAnswers(signal),
    staleTime: STALE_TIME.answers,
  });
}

interface ReadOptions {
  /** Off until the "By application" tab is actually opened. */
  enabled?: boolean;
}

/** Every application answers were filled on, latest first, each with what went out. */
export function useAnswerHistory({ enabled = true }: ReadOptions = {}) {
  return useQuery({
    queryKey: qk.answers.history(),
    queryFn: ({ signal }) => listAnswerHistory(signal),
    staleTime: STALE_TIME.answers,
    enabled,
  });
}
