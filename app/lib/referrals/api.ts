// Browser-side calls for referral search.
//
// Both routes live in the AI service behind the session proxy
// (`app/api/ai/[...path]/route.ts`), like Ask about a job: the proxy sets
// `x-user-id` from the session, so the browser never says who it is. Only the
// saved job's id is ever sent — the AI service reads the company and role from
// the backend itself, so nobody can spend searches on names of their choosing.

import { apiGet, apiPost } from "@/app/lib/api/client";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import type { ReferralSearchItem, ReferralSearchResult } from "./types";

export const REFERRALS_PATH = "/api/ai/jobs/referrals";

/** The stored search for a saved job, or null when it has never been searched. Free. */
export function getReferralSearch(savedJobId: string, signal?: AbortSignal) {
  return apiGet<ReferralSearchItem | null>(`${REFERRALS_PATH}/${encodeURIComponent(savedJobId)}`, signal);
}

/**
 * Search the web for people at the job's company. Costs a credit when it finds
 * someone; without `refresh` a stored search comes back instead, free.
 */
export function runReferralSearch(savedJobId: string, refresh = false) {
  return apiPost<ReferralSearchResult>(REFERRALS_PATH, { savedJobId, refresh });
}

export type ReferralFailureKind = "credits" | "limited" | "failed";

export interface ReferralFailure {
  kind: ReferralFailureKind;
  message: string;
}

export function describeReferralFailure(error: unknown): ReferralFailure {
  const message = apiMessage(error);
  if (error instanceof BackendError && error.status === 402) return { kind: "credits", message };
  if (error instanceof BackendError && error.status === 429) return { kind: "limited", message };
  return { kind: "failed", message };
}

/** "jdoe@wikimedia.org" as people say it: "first initial + last name". */
export const EMAIL_PATTERN_LABELS: Record<string, string> = {
  "first.last": "first.last",
  flast: "first initial + last name",
  first: "first name",
  firstlast: "firstlast",
  last: "last name",
  first_last: "first_last",
  "first-last": "first-last",
  firstl: "first name + last initial",
  "f.last": "first initial.last name",
  "last.first": "last.first",
  lastf: "last name + first initial",
  "first.l": "first.last initial",
};
