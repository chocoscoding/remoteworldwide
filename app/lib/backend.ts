// Server-side backend calls.
//
// The error type, envelope unwrapping and date reviving now live in
// `app/lib/api/core.ts` so the browser can use them too — this file is only
// the server-specific half: reading the incoming request's cookies and
// forwarded IP out of `next/headers` and passing them along. `BackendError` is
// re-exported so the many `libs/*.ts` callers that import it from here keep
// working unchanged.

import { headers } from "next/headers";
import { BackendError, unwrapResponse } from "@/app/lib/api/core";
import { clientIpHeaders } from "@/app/lib/api/clientIp";

export { BackendError };

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

/** A backend (Mongo) id: 24 hex characters, the only shape any `:id` route takes (isMongoId). */
export const isObjectId = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

/**
 * An id as one path segment of a backend call.
 *
 * A server action's arguments are whatever its caller sends, and an id pasted
 * raw into `/lead-magnets/${id}` is a path: fetch's URL parser collapses `..`
 * and `%2e%2e`, so `../../../account/sign-in/google` turned "delete this lead
 * magnet" into DELETE /api/account/sign-in/google under the caller's cookie.
 * encodeURIComponent alone is not enough — it leaves a bare `..` intact — so
 * the shape check is what closes it. Refused as a 400, like the backend would.
 */
export function idSegment(id: unknown): string {
  if (!isObjectId(id)) throw new BackendError(400, "That id is not valid");
  return encodeURIComponent(id);
}

export interface BackendInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  session?: boolean;
}

export async function backend<T>(path: string, init: BackendInit = {}): Promise<T> {
  return unwrapResponse<T>(await send(path, init));
}

/**
 * The same, for the few lists that send their total beside `data` rather than inside it (the
 * board's `GET /jobs` search and `GET /companies`), as the Prisma routes they replaced did.
 */
export async function backendWithCount<T>(path: string, init: BackendInit = {}): Promise<{ data: T; count: number }> {
  const res = await send(path, init);
  const count = res.ok ? Number((await res.clone().json().catch(() => null))?.count ?? 0) : 0;
  return { data: await unwrapResponse<T>(res), count };
}

/** The job board's cache tags. An admin write expires its tag (libs/query.ts), so the next render reads fresh. */
export const BOARD_TAGS = { jobs: "board:jobs", companies: "board:companies", filters: "board:filters" } as const;

/**
 * A public read that stays in Next's data cache, for pages that are cached themselves (the home
 * page, the waitlist page) or read the same thing on every render (a job page, a company page).
 * `backend()` reads the incoming request's headers, which makes a page render per request; this
 * names no visitor and sends no cookie, so the backend counts it as this server speaking for itself.
 */
export async function backendCached<T>(path: string, cache: { revalidate: number; tags: string[] }): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    headers: { accept: "application/json", ...clientIpHeaders(new Headers()) },
    next: cache,
  });
  return unwrapResponse<T>(res);
}

export async function backendCachedOrNull<T>(path: string, cache: { revalidate: number; tags: string[] }): Promise<T | null> {
  try {
    return await backendCached<T>(path, cache);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}

async function send(path: string, init: BackendInit): Promise<Response> {
  const h: Record<string, string> = { accept: "application/json" };
  // A FormData body (an upload made on the user's behalf, e.g. onboarding's
  // "save a built resume to My documents") goes as multipart, untouched: no
  // content-type by hand, because only fetch knows the boundary it writes —
  // the same rule as the browser's `app/lib/api/client.ts`.
  const multipart = init.body instanceof FormData;
  if (init.body !== undefined && !multipart) h["content-type"] = "application/json";
  const incoming = await headers();
  // The visitor's address, for the backend's per-IP limiters and logs (`trust proxy` 1
  // makes req.ip its last entry). Only as honest as the edge in front of this server:
  // Next keeps a header the client sent, and the /api rewrites in next.config.mjs pass
  // it on verbatim, so dropping it here would close nothing. The edge has to set or
  // append X-Forwarded-For itself. Identity never rides on it; that is the cookie alone.
  const forwarded = incoming.get("x-forwarded-for");
  if (forwarded) h["x-forwarded-for"] = forwarded;
  // What the backend's limiters actually count by: X-Forwarded-For above never gets past the
  // backend's own proxy intact, so the visitor is named in a header only this server can vouch for.
  Object.assign(h, clientIpHeaders(incoming));
  if (init.session) {
    const cookie = incoming.get("cookie");
    if (cookie) h.cookie = cookie;
  }
  return fetch(`${BACKEND_URL}/api${path}`, {
    method: init.method ?? "GET",
    headers: h,
    body: init.body === undefined ? undefined : multipart ? (init.body as FormData) : JSON.stringify(init.body),
    cache: "no-store",
  });
}

export async function backendOrNull<T>(path: string, init: BackendInit = {}): Promise<T | null> {
  try {
    return await backend<T>(path, init);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}
