export const DEFAULT_NEXT = "/";

/**
 * Where a new account goes first: the profile setup the extension reads before it fills anything.
 * Inside the dashboard (owner, 2026-09-27) — the sidebar stays, no sidebar item points at it — and
 * non-blocking: the dashboard's banner only nudges.
 */
export const ONBOARDING_PATH = "/dashboard/onboarding";

/** Where setup lands once every checklist item is in. */
export const ONBOARDING_DONE_PATH = "/dashboard/onboarding/done";

/**
 * Where setup used to live. It only redirects now, to `ONBOARDING_PATH` with its query (the
 * `#fragment` rides the redirect by itself), so the links the extension and old emails carry still
 * land on the right field.
 */
export const LEGACY_ONBOARDING_PATH = "/onboarding";

export function safeNext(value: string | string[] | null | undefined, fallback: string = DEFAULT_NEXT): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return fallback;
  return raw;
}

export function requiresSession(path: string): boolean {
  return path.startsWith("/dashboard") || path === LEGACY_ONBOARDING_PATH || path.startsWith(`${LEGACY_ONBOARDING_PATH}/`);
}

export function loginWithNext(next: string): string {
  return next === DEFAULT_NEXT ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}

export function signupWithNext(next: string): string {
  return next === DEFAULT_NEXT ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;
}

const AUTH_PAGES = ["/login", "/signup"];

/** On the sign-in page: a session just ended, so the tab finishes signing out and says so. */
export const SESSION_ENDED_PARAM = "ended";

/** Sign-in after a session the backend ended, coming back to `next`. */
export function loginAfterSessionEnded(next: string): string {
  const login = loginWithNext(next);
  return `${login}${login.includes("?") ? "&" : "?"}${SESSION_ENDED_PARAM}=1`;
}

/**
 * Where a server action sends someone whose session the backend has refused, or null to leave the
 * refusal as it is (a failed call, as before):
 *  - only inside a server action: a page render is redirected by its own layout, and a route
 *    handler's 401 reaches the browser, which signs itself out (app/lib/auth/sessionEnded.ts);
 *  - only when a session cookie was sent: a signed-out visitor whose action is refused (something
 *    run in the background on a public page) keeps the quiet failure, never a jump to sign-in;
 *  - never from the sign-in or sign-up page itself, so a refused action there cannot loop. The
 *    sign-in page also clears the cookie at once, after which the rule above stops it too.
 * Back to the page the action ran on (the Referer, same-origin so the full URL), or home.
 */
export function sessionEndedRedirect({
  action,
  sessionCookie,
  referer,
}: {
  action: boolean;
  sessionCookie: boolean;
  referer: string | null | undefined;
}): string | null {
  if (!action || !sessionCookie) return null;
  let page = DEFAULT_NEXT;
  let pathname = DEFAULT_NEXT;
  if (referer) {
    try {
      const url = new URL(referer);
      pathname = url.pathname;
      page = safeNext(`${url.pathname}${url.search}`);
    } catch {
      // Not a URL: back home.
    }
  }
  if (AUTH_PAGES.includes(pathname)) return null;
  return loginAfterSessionEnded(page);
}

/**
 * Where signing in from this page should come back to: the page itself, query included. On the
 * login or signup page, the `next` it already carries, so switching between the two keeps it.
 */
export function returnTo(pathname: string, search: string): string {
  if (AUTH_PAGES.includes(pathname)) return safeNext(new URLSearchParams(search).get("next"));
  return safeNext(pathname + search);
}
