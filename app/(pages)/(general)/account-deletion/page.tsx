import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AccountDeletionClient from "./Client";

export const metadata = { title: "Your account is scheduled for deletion" };

/**
 * The one screen an account locked for deletion can reach.
 *
 * Outside the dashboard group on purpose, exactly like /verify-email: its layout is where a locked
 * account is sent, and a page inside it would redirect to itself forever. Signing in still works
 * while the account is locked, because this — and the Cancel deletion on it — is what signing in is
 * for during the grace period.
 */
export default async function AccountDeletionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/account-deletion");
  // Not locked: nothing to see. Deleting the account is asked for in settings.
  if (!session.user.deletionDueAt) redirect("/dashboard/settings/account");

  return <AccountDeletionClient dueAt={session.user.deletionDueAt} email={session.user.email ?? null} />;
}
