// When the site asks the backend who a request belongs to (auth.ts), and how often.
//
// Every server render, every /api/ai call and every server action calls auth(), and auth() asked
// the backend's GET /api/auth/session each time. React's cache() only folds the calls inside one
// request, so one person working through Apply (a scan, a few saves, the sidebar's prefetches, the
// extension beside it) asked hundreds of times in a few minutes. The backend gives each visitor
// 1,000 of those per 15 minutes; past that every lookup came back 429, auth() read that as signed
// out, and everything behind a session failed at once ("[auth] session fetch failed: 429", local
// dev, 2026-11-25).
//
// So the backend is asked only when the answer can actually be new:
//  - No Auth.js session cookie on the request: nobody is signed in, and nothing is asked. Other
//    cookies (analytics, preferences) used to be enough to send a lookup for every signed-out page.
//  - The same session cookie within SESSION_TTL_MS: the answer already in hand is reused, and
//    lookups for it that start while one is in flight wait for that one.
//
// What is never reused: a failed lookup (429, 5xx, network), so the next request asks again; and a
// session still waiting on something that changes it (an unverified address, a deletion pending),
// so verifying an address or cancelling a deletion shows on the very next request. Signing out
// changes the cookie, so it shows at once too.
//
// The backend stays the authority. A session revoked from another device is refused by the
// backend's own routes at once, and the first of those refusals (a 401 to a call made with this
// cookie, app/lib/backend.ts) forgets the answer held here, so this server's own gates close on the
// next request rather than after SESSION_TTL_MS. The browser signs itself out on the same refusal
// (app/lib/auth/sessionEnded.ts).
//
// Pure on purpose (no next/headers, no fetch), so tests/session-lookup.test.mjs can run it.

import { createHash } from "node:crypto";

/** How long one answer from the backend is reused for the same session cookie. */
export const SESSION_TTL_MS = 30_000;

/** Answers held at once on one server instance. The oldest go first. */
export const MAX_CACHED_SESSIONS = 5_000;

/**
 * The Auth.js session cookie names the backend sets (its auth/linkingAuthority.ts): `__Secure-`
 * on https. A large token is split into numbered chunks (`.0`, `.1`, ...), joined in order.
 */
const SESSION_COOKIE = /^(?:__Secure-)?authjs\.session-token(?:\.(\d+))?$/;

/**
 * The session token on a Cookie header, its chunks joined in order, or null when there is none.
 * Only what is needed to tell one session from another: the whole header is still what is sent.
 */
export function sessionCookieOf(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const parts: Array<{ index: number; value: string }> = [];
  for (const pair of cookieHeader.split(";")) {
    const at = pair.indexOf("=");
    if (at < 0) continue;
    const name = pair.slice(0, at).trim();
    const match = SESSION_COOKIE.exec(name);
    if (!match) continue;
    const value = pair.slice(at + 1).trim();
    if (value) parts.push({ index: match[1] === undefined ? -1 : Number(match[1]), value });
  }
  if (parts.length === 0) return null;
  return parts
    .sort((a, b) => a.index - b.index)
    .map((part) => part.value)
    .join("");
}

/** One lookup's outcome: the session (null when signed out), and whether it may be reused. */
export interface LookupResult<S> {
  session: S | null;
  reusable: boolean;
  /**
   * The backend could not be asked (429, 5xx, unreachable). The null session then says nothing
   * about whether anyone is signed in, so nothing may sign the person out on it.
   */
  failed?: boolean;
}

/** The fields of a session that decide whether its answer may be reused. */
interface SessionLike {
  user?: { verified?: boolean | null; deletionDueAt?: unknown } | null;
}

/**
 * Whether an answer may be held for SESSION_TTL_MS: signed out (the cookie is spent; a new sign-in
 * brings a new one), or signed in with nothing pending that the person is about to change.
 */
export function reusableSession(session: SessionLike | null): boolean {
  if (!session) return true;
  const user = session.user;
  if (!user) return true;
  return user.verified !== false && !user.deletionDueAt;
}

interface Entry<S> {
  /** Settles with the answer; shared by every lookup that starts while it is in flight. */
  promise: Promise<LookupResult<S>>;
  /** When the answer stops being reused; Infinity while still in flight. */
  until: number;
}

export interface SessionLookups<S> {
  /** The answer for this token: a held one, the one in flight, or `ask()` for a new one. */
  lookup(token: string, ask: () => Promise<LookupResult<S>>): Promise<LookupResult<S>>;
  /**
   * Drops what is held for this token, in flight or settled, so the next lookup asks the backend.
   * For when the backend has refused the session since the answer was held.
   */
  forget(token: string): void;
  /** How many answers are held right now (tests). */
  size(): number;
}

export function createSessionLookups<S>({
  ttlMs = SESSION_TTL_MS,
  maxEntries = MAX_CACHED_SESSIONS,
  now = Date.now,
}: { ttlMs?: number; maxEntries?: number; now?: () => number } = {}): SessionLookups<S> {
  const entries = new Map<string, Entry<S>>();

  // Tokens are bearer credentials: the map is keyed on a digest, never on the token itself.
  const keyOf = (token: string): string => createHash("sha256").update(token).digest("base64url");

  const hold = (key: string, entry: Entry<S>): void => {
    entries.delete(key);
    if (entries.size >= maxEntries) {
      // Maps iterate in insertion order, so the first key is the oldest answer.
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    entries.set(key, entry);
  };

  return {
    lookup(token, ask) {
      const key = keyOf(token);
      const held = entries.get(key);
      if (held && held.until > now()) return held.promise;

      const entry: Entry<S> = { promise: Promise.resolve({ session: null, reusable: false }), until: Number.POSITIVE_INFINITY };
      entry.promise = ask().then(
        (result) => {
          // A failed lookup is never held, whatever it says about reuse.
          if (result.reusable && !result.failed && entries.get(key) === entry) entry.until = now() + ttlMs;
          else if (entries.get(key) === entry) entries.delete(key);
          return result;
        },
        (error: unknown) => {
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        },
      );
      hold(key, entry);
      return entry.promise;
    },

    // A lookup still in flight settles without coming back: it checks it is still the held entry.
    forget(token) {
      entries.delete(keyOf(token));
    },

    size() {
      return entries.size;
    },
  };
}
