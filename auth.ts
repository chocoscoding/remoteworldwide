import { cache } from "react";
import { headers } from "next/headers";
import type { Session } from "next-auth";
import { clientIpHeaders } from "@/app/lib/api/clientIp";
import { createSessionLookups, reusableSession, sessionCookieOf, type LookupResult } from "@/app/lib/auth/sessionLookup";

/**
 * Authentication is owned by the Express backend (@auth/express) — see
 * docs/02-target-authentication.md. This helper keeps the same `auth()` API
 * the app already imports from "@/auth", but resolves the session by calling
 * the backend's Auth.js session endpoint (GET /api/auth/session) with the
 * cookies of the incoming request.
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

/**
 * Answers held per session cookie on this server instance, so the backend is asked only when the
 * answer can be new (app/lib/auth/sessionLookup.ts says when that is, and what is never reused).
 */
const lookups = createSessionLookups<Session>();

/**
 * The backend refused this session (a 401 to a call that carried this Cookie header): forget the
 * answer held for it, so the next auth() asks again and finds the visitor signed out. Without it a
 * session revoked elsewhere kept opening this server's own gates until its held answer ran out.
 */
export function forgetSession(cookieHeader: string | null | undefined): void {
  const token = sessionCookieOf(cookieHeader);
  if (token) lookups.forget(token);
}

/** One question to the backend. Never throws: a failure is a signed-out answer that is not kept. */
async function askBackend(cookie: string, incoming: Headers): Promise<LookupResult<Session>> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
      // Named as the visitor, or every page render by anyone shares one auth budget on the backend.
      headers: { cookie, ...clientIpHeaders(incoming) },
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[auth] session fetch failed: ${response.status} ${response.statusText} from ${BACKEND_URL}/api/auth/session`);
      return { session: null, reusable: false, failed: true };
    }

    const session: Session | null = await response.json();
    if (!session || Object.keys(session).length === 0) {
      console.debug("[auth] backend returned empty session — signed out");
      return { session: null, reusable: true };
    }
    console.debug(`[auth] session resolved for ${session.user?.email ?? "unknown user"}`);
    return { session, reusable: reusableSession(session) };
  } catch (error) {
    // Backend unreachable — treat as signed out rather than crashing the page.
    console.warn(`[auth] backend unreachable at ${BACKEND_URL} — treating as signed out:`, error);
    return { session: null, reusable: false, failed: true };
  }
}

/** Who this request is, and whether that is the backend's answer or only a lookup that failed. */
export interface SessionAnswer {
  session: Session | null;
  /** The backend could not be asked: a null session here must never sign anyone out. */
  failed: boolean;
}

// cache(): one lookup per server request. The admin and dashboard layouts, the page,
// generateMetadata and the action guards each call auth(), so one render used to ask the
// backend up to five times for the same cookie (production logs, 2026-11-05). Across requests
// the answers held above do the same job; outside a render (route handlers) cache() simply
// calls through to them.
export const sessionAnswer = cache(async (): Promise<SessionAnswer> => {
  // Outside the try/catch on purpose: during prerendering headers() throws a
  // DynamicServerError that Next.js uses to mark the route dynamic (the same
  // behavior the previous NextAuth auth() had) — it must not be swallowed.
  const incoming = await headers();
  const cookie = incoming.get("cookie");
  // Only the Auth.js session cookie says anyone is signed in. Without it there is nothing to ask:
  // analytics and preference cookies alone used to send a lookup for every signed-out render.
  const token = sessionCookieOf(cookie);
  if (!cookie || !token) {
    console.debug("[auth] no session cookie on request — treating as signed out");
    return { session: null, failed: false };
  }

  const { session, failed } = await lookups.lookup(token, () => askBackend(cookie, incoming));
  return { session, failed: Boolean(failed) };
});

/** The session for this request, or null when signed out (or when the backend could not be asked). */
export const auth = cache(async (): Promise<Session | null> => (await sessionAnswer()).session);
