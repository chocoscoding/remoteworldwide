"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiPost, apiPut } from "@/app/lib/api/client";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
import { saveBlob } from "@/app/lib/export/save";
import { deletionDate, type AccountDeletionStatus, type OAuthProviderId, type SignInMethods } from "@/app/lib/account/types";

/**
 * Account actions, as distinct from account settings.
 *
 * Deliberately not part of `SettingsProvider`: that is a draft-over-server adapter for the four
 * sections you edit and then save, and a credential change is neither drafted nor optimistic. There
 * is nothing sensible to show while it is in flight except that it is in flight.
 */

type PasswordChange = { currentPassword: string; password: string };
type ChangeResult = { sessionsRevoked: number };

const devicesSignedOut = (count: number): string | undefined => {
  if (count === 0) return undefined;
  return count === 1 ? "One other device was signed out." : `${count} other devices were signed out.`;
};

export function useChangePassword(onDone?: () => void) {
  return useMutation<ChangeResult, unknown, PasswordChange>({
    mutationFn: (body) => apiPut<ChangeResult>("/api/users/password", body),
    onSuccess: (result) => {
      toast.success("Password changed", { description: devicesSignedOut(result.sessionsRevoked) });
      onDone?.();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
}

export function useResendVerification() {
  return useMutation<{ sent: boolean }, unknown, void>({
    mutationFn: () => apiPost<{ sent: boolean }>("/api/users/verification/resend", {}),
    onSuccess: (result) => {
      if (result?.sent === false) toast.info("That address is already verified");
      else toast.success("Sent", { description: "Check your inbox for the link." });
    },
    // Covers the cooldown too: the backend's message already says how long to wait.
    onError: (error) => toast.error(apiMessage(error)),
  });
}

/**
 * Unlinking a Google or GitHub account. The backend refuses when it is the last way in, and its
 * message says what to do about it — so there is nothing to decide here.
 *
 * Connecting has no mutation: it is Auth.js's own OAuth flow, started with `signIn(provider)` from
 * the settings screen, which leaves the page and comes back with the account linked.
 */
export function useDisconnectProvider() {
  const queryClient = useQueryClient();
  return useMutation<SignInMethods, unknown, OAuthProviderId>({
    mutationFn: (provider) => apiDelete<SignInMethods>(`/api/account/sign-in/${provider}`),
    onSuccess: (methods, provider) => {
      queryClient.setQueryData(qk.account.signIn(), methods);
      toast.success(`${provider === "github" ? "GitHub" : "Google"} disconnected`);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
}

/** `filename="…"` from the response, or a name of our own. */
const downloadName = (disposition: string | null): string => {
  const match = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
  return match?.[1] ?? `remoteworldwide-data-${new Date().toISOString().slice(0, 10)}.json`;
};

/**
 * The data export: one request, one file, saved straight away.
 *
 * Not `apiGet`: the answer is the file itself rather than the `{ data }` envelope, and it never
 * enters the query cache — it is someone's whole account, and a copy of it sitting in memory (or,
 * worse, in the disk persister) would be the opposite of what this button is for.
 */
export function useExportData() {
  return useMutation<void, unknown, void>({
    mutationFn: async () => {
      const response = await fetch("/api/account/export", {
        headers: { accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new BackendError(response.status, body?.message ?? response.statusText);
      }
      saveBlob(await response.blob(), downloadName(response.headers.get("content-disposition")));
    },
    onSuccess: () => toast.success("Export downloaded", { description: "Everything we hold about you, as JSON." }),
    onError: (error) => toast.error(apiMessage(error)),
  });
}

/**
 * Asking for the account to be deleted. On success every session is revoked, including this one, so
 * the caller signs the browser out — anything else would leave a page open that can do nothing.
 */
export function useScheduleDeletion(onScheduled: (status: AccountDeletionStatus) => void) {
  return useMutation<AccountDeletionStatus, unknown, string>({
    mutationFn: (confirm) => apiPost<AccountDeletionStatus>("/api/account/deletion", { confirm }),
    onSuccess: (status) => {
      toast.success(`Your account will be deleted on ${deletionDate(status.dueAt)}`, {
        description: "Sign in before then and choose Cancel deletion to keep it.",
      });
      onScheduled(status);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
}

/** Calling it off, from the locked screen. */
export function useCancelDeletion(onCancelled: () => void) {
  const queryClient = useQueryClient();
  return useMutation<null, unknown, void>({
    mutationFn: () => apiDelete<null>("/api/account/deletion"),
    onSuccess: () => {
      queryClient.setQueryData(qk.account.deletion(), null);
      toast.success("Deletion cancelled", { description: "Your account is active again." });
      onCancelled();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
}
