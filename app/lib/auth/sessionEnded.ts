// What the browser does when the backend refuses its session (a 401), used by SessionWatch.
//
// The backend is the authority on who is signed in. When it refuses a call for want of a session
// while this tab still shows someone signed in, the tab is showing a session that no longer exists
// (revoked from Settings > Sessions on another device, expired, deleted) and should sign out rather
// than keep failing call by call.
//
// But a 401 alone does not prove that. The AI service answers 401 when the site's service token
// does not match, and a failed call is no place to guess. So the tab asks the backend once, fresh,
// whether the session is still there, and signs out only on a clear "nobody": a 429, a 5xx or a
// network fault proves nothing and keeps the person signed in. One question per burst of refusals,
// and none for a while after the answer was "still signed in", so a broken service cannot turn
// every failed call into a session lookup.
//
// Pure on purpose (no React, no next-auth), so tests/session-lookup.test.mjs can run it.

/** Fired on `window` by app/lib/api/core.ts for every 401 a backend call gets. */
export const SESSION_REFUSED_EVENT = "rww:session-refused";

/** After a check that found the session alive, refusals are not checked again for this long. */
export const RECHECK_AFTER_MS = 60_000;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * True only when the backend clearly says nobody is signed in on this browser: a 200 whose body has
 * no user (Auth.js answers `null`, or `{}`). Anything it cannot read is false.
 */
export async function sessionEnded(fetcher: Fetcher = fetch): Promise<boolean> {
  try {
    const res = await fetcher("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return false;
    const body: unknown = await res.json().catch(() => undefined);
    if (body === undefined) return false;
    if (!body || typeof body !== "object") return true;
    return !(body as { user?: unknown }).user;
  } catch {
    return false;
  }
}

export interface SessionWatchOptions {
  /** Whether this tab thinks someone is signed in right now. Refusals while signed out are ignored. */
  isSignedIn: () => boolean;
  /** Signs out and leaves the page. Called at most once. */
  onEnded: () => Promise<unknown> | void;
  ended?: () => Promise<boolean>;
  recheckAfterMs?: number;
  now?: () => number;
}

/** The handler for SESSION_REFUSED_EVENT: decides whether a refusal is worth a check, and acts on it. */
export function createSessionWatch({
  isSignedIn,
  onEnded,
  ended = () => sessionEnded(),
  recheckAfterMs = RECHECK_AFTER_MS,
  now = Date.now,
}: SessionWatchOptions): () => Promise<void> {
  let checking = false;
  let signedOut = false;
  let quietUntil = 0;

  return async function onRefused() {
    if (signedOut || checking || !isSignedIn() || now() < quietUntil) return;
    checking = true;
    try {
      if (await ended()) {
        signedOut = true;
        await onEnded();
        return;
      }
      quietUntil = now() + recheckAfterMs;
    } finally {
      checking = false;
    }
  };
}
