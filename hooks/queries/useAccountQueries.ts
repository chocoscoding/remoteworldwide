"use client";

// The account's own reads: how it signs in, and whether a deletion is scheduled.
//
// Kept out of `SettingsProvider`, which is a draft-over-server adapter for the sections you edit and
// then save. Neither of these is drafted: connecting a provider leaves the page entirely, and a
// deletion is a decision, not a field.

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/app/lib/api/client";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import type { AccountDeletionStatus, SignInMethods } from "@/app/lib/account/types";

export const SIGN_IN_PATH = "/api/account/sign-in";
export const DELETION_PATH = "/api/account/deletion";

export function useSignInMethods() {
  return useQuery({
    queryKey: qk.account.signIn(),
    queryFn: ({ signal }) => apiGet<SignInMethods>(SIGN_IN_PATH, signal),
    staleTime: STALE_TIME.account,
  });
}

/**
 * Null when nothing is scheduled. `enabled` is for the locked screen, which asks on its own and
 * should not poll from anywhere else.
 */
export function useDeletionStatus(enabled = true) {
  return useQuery({
    queryKey: qk.account.deletion(),
    queryFn: ({ signal }) => apiGet<AccountDeletionStatus | null>(DELETION_PATH, signal),
    staleTime: STALE_TIME.account,
    enabled,
  });
}
