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
  const h: Record<string, string> = { accept: "application/json" };
  if (init.body !== undefined) h["content-type"] = "application/json";
  const incoming = await headers();
  // The visitor's address, for the backend's per-IP limiters and logs (`trust proxy` 1
  // makes req.ip its last entry). Only as honest as the edge in front of this server:
  // Next keeps a header the client sent, and the /api rewrites in next.config.mjs pass
  // it on verbatim, so dropping it here would close nothing. The edge has to set or
  // append X-Forwarded-For itself. Identity never rides on it; that is the cookie alone.
  const forwarded = incoming.get("x-forwarded-for");
  if (forwarded) h["x-forwarded-for"] = forwarded;
  if (init.session) {
    const cookie = incoming.get("cookie");
    if (cookie) h.cookie = cookie;
  }
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    method: init.method ?? "GET",
    headers: h,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  return unwrapResponse<T>(res);
}

export async function backendOrNull<T>(path: string, init: BackendInit = {}): Promise<T | null> {
  try {
    return await backend<T>(path, init);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}
