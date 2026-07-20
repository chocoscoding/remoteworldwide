import { headers } from "next/headers";
import type { Session } from "next-auth";

/**
 * Authentication is owned by the Express backend (@auth/express) — see
 * docs/02-target-authentication.md. This helper keeps the same `auth()` API
 * the app already imports from "@/auth", but resolves the session by calling
 * the backend's Auth.js session endpoint (GET /api/auth/session) with the
 * cookies of the incoming request.
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export const auth = async (): Promise<Session | null> => {
  // Outside the try/catch on purpose: during prerendering headers() throws a
  // DynamicServerError that Next.js uses to mark the route dynamic (the same
  // behavior the previous NextAuth auth() had) — it must not be swallowed.
  const cookie = headers().get("cookie");
  if (!cookie) {
    console.debug("[auth] no cookies on request — treating as signed out");
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[auth] session fetch failed: ${response.status} ${response.statusText} from ${BACKEND_URL}/api/auth/session`);
      return null;
    }

    const session: Session | null = await response.json();
    if (!session || Object.keys(session).length === 0) {
      console.debug("[auth] backend returned empty session — signed out");
      return null;
    }
    console.debug(`[auth] session resolved for ${session.user?.email ?? "unknown user"}`);
    return session;
  } catch (error) {
    // Backend unreachable — treat as signed out rather than crashing the page.
    console.warn(`[auth] backend unreachable at ${BACKEND_URL} — treating as signed out:`, error);
    return null;
  }
};
