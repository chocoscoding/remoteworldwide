"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/app/lib/authClient";
import AuthNotice from "@/app/components/auth/AuthNotice";
import { brutalistLink } from "@/app/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import { deletionDate } from "@/app/lib/account/types";
import { useCancelDeletion } from "@/hooks/mutations/useAccountMutations";
import { useDeletionStatus } from "@/hooks/queries/useAccountQueries";

/**
 * The locked screen: the date everything goes, and the one action that stops it.
 *
 * Cancelling clears the dates on the account. The session cookie still carries the old date, but the
 * backend re-reads it on every request while it is set (the jwt callback in auth/config.ts), so the
 * next server render already sees an account that is not locked and the dashboard opens.
 */
export default function AccountDeletionClient({ dueAt, email }: { dueAt: string; email: string | null }) {
  const router = useRouter();
  // The session carries the date, and this confirms it against the account itself — so a deletion
  // cancelled in another tab (or by support) shows up here rather than on the next sign-in.
  const status = useDeletionStatus();
  const cancel = useCancelDeletion(() => {
    router.push("/dashboard");
    router.refresh();
  });
  const due = status.data?.dueAt ?? dueAt;

  return (
    <AuthNotice
      title={`Your account is scheduled for deletion on ${deletionDate(due)}`}
      subtitle={
        <>
          {email ? (
            <>
              <span className="font-bold">{email}</span> is locked until then.{" "}
            </>
          ) : (
            "Your account is locked until then. "
          )}
          Nothing has been deleted yet. On that date your profile, applications, documents, resumes, saved answers and
          interview recordings are removed for good, and unused credits are forfeited.
        </>
      }
      footer={
        <p className="text-pretty text-center text-gray-600 text-sm">
          Not your account?{" "}
          <button className={brutalistLink} onClick={() => signOut({ callbackUrl: "/" })} type="button">
            Sign out
          </button>
        </p>
      }>
      <Button
        className="w-full rounded-md font-bold"
        disabled={cancel.isPending}
        onClick={() => cancel.mutate()}
        type="button"
        variant="brutalist-accent">
        {cancel.isPending ? "Cancelling…" : "Cancel deletion"}
      </Button>
      <p className="text-center text-gray-600 text-sm">Cancelling brings everything back exactly as you left it.</p>
    </AuthNotice>
  );
}
