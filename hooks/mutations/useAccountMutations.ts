"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";

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
