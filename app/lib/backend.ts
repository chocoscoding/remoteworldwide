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

export interface BackendInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  session?: boolean;
}

export async function backend<T>(path: string, init: BackendInit = {}): Promise<T> {
  const h: Record<string, string> = { accept: "application/json" };
  if (init.body !== undefined) h["content-type"] = "application/json";
  const incoming = await headers();
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
