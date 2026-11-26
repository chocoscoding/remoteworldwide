// The server-action half of "the backend is the authority on who is signed in".
//
// A server action never hands the browser a 401: it either throws (and production hides the
// message) or returns an error for the form to show, so the tab's own watch (SessionWatch) never
// hears of a refused session there. The person saw "something went wrong", clicked again, and only
// their next page load found them signed out. So when an action learns the backend has ended its
// session, it sends the person to sign in on the spot, and the sign-in page signs the tab out.
//
// Called from the two places every signed-in action already passes through: backend() on a 401
// (app/lib/backend.ts) and requireUserAction() when the backend says nobody is signed in
// (app/lib/auth/action-guards.ts). It costs nothing on any other request: a header read inside a
// call that is already running. Which requests it acts on, and why, is sessionEndedRedirect's
// comment (app/lib/next-url.ts).
//
// redirect() works by throwing. Action catch blocks let it through: the ones that answer a
// BackendError rethrow anything else, and libs/query.ts calls unstable_rethrow first.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieOf } from "@/app/lib/auth/sessionLookup";
import { sessionEndedRedirect } from "@/app/lib/next-url";

/** Inside a server action whose session the backend ended: off to sign in. Anywhere else: nothing. */
export async function redirectEndedSession(): Promise<void> {
  const incoming = await headers();
  const target = sessionEndedRedirect({
    // Next marks every server action request with this header (its action id).
    action: incoming.has("next-action"),
    sessionCookie: sessionCookieOf(incoming.get("cookie")) !== null,
    referer: incoming.get("referer"),
  });
  if (!target) return;
  console.info(`[auth] the backend ended this session during a server action, sending them to ${target}`);
  redirect(target);
}
