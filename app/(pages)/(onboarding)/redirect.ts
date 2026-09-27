import { auth } from "@/auth";
import { loginWithNext } from "@/app/lib/next-url";

// Setup moved into the dashboard (owner, 2026-09-27). `/onboarding` and `/onboarding/done` stay for
// the links already out there — the extension's "Finish your profile" (`/onboarding#<id>`), old
// emails, bookmarks — and send each one on with its query (`?next=`) intact. The `#fragment` never
// reaches a server; a browser carries it across a redirect whose Location has none, so `#skills`
// still lands on Skills.
//
// Signed out, the redirect goes to sign-in first with the whole new address as `next`, as the old
// page's guard did: the dashboard layout's own sign-in redirect cannot see which page it was on.
//
// A relative Location (RFC 9110 allows one), so the redirect never names a host a proxy rewrote.

/** A 307 to `path` plus the request's query — by way of sign-in when there is no session. */
export async function redirectInto(request: Request, path: string): Promise<Response> {
  const { search } = new URL(request.url);
  const target = `${path}${search}`;
  const session = await auth().catch(() => null);
  const location = session?.user ? target : loginWithNext(target);
  return new Response(null, { status: 307, headers: { Location: location, "Cache-Control": "no-store" } });
}
