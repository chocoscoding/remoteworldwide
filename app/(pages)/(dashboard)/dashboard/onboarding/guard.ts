import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loginWithNext, safeNext } from "@/app/lib/next-url";

/**
 * The onboarding pages' own copy of the dashboard layout's three checks, because only a page sees
 * its query string, and a signed-out visit has to come back to this exact address (`?next=`
 * included) after signing in — the layout's bare `/login` would drop it.
 *
 *   signed out            -> /login?next=<here>
 *   deletion scheduled    -> /account-deletion (the only screen a locked account may open)
 *   email not confirmed   -> /verify-email, which sends a confirmed account back to onboarding
 */
export async function onboardingSession(path: string, next: string) {
  const session = await auth();
  if (!session?.user) redirect(loginWithNext(withNext(path, next)));
  if (session.user.deletionDueAt) redirect("/account-deletion");
  if (session.user.verified === false) redirect("/verify-email");
  return session.user;
}

/** `?next=` as asked, when it is a safe same-site path; "" when there is none (or it was not safe). */
export const askedNext = (value: string | string[] | undefined): string => safeNext(value, "");

/** `path`, carrying `next` when there is one. */
export const withNext = (path: string, next: string): string => (next ? `${path}?next=${encodeURIComponent(next)}` : path);
