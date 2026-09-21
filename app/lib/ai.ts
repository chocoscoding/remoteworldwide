// Server-side calls to the AI service (resume scoring, resume building, cover
// letters, suggestions, autofill).
//
// Deliberately NOT a rewrite in next.config.mjs. The existing `/api/*` rewrites
// work because those backend routes authenticate by forwarding the browser's
// own first-party session cookie, and a rewrite passes the request through
// untouched. This service authenticates with a service token, and a rewrite
// cannot inject a header — so routing it that way would force the token into
// the browser, which is the NEXT_PUBLIC_BACKEND_TOKEN mistake repeated.
//
// Callers:
//   server components / actions -> this file
//   browser                     -> app/api/ai/[...path]/route.ts, which calls
//                                  auth() and proxies here with the token
//   Express backend             -> talks to 4200 directly

import { BackendError, unwrapResponse } from "@/app/lib/api/core";

export { BackendError };

const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:4200";
const AI_TOKEN = process.env.AI_SERVICE_TOKEN ?? "";

export interface AiInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Generation can take seconds; a scan's deterministic phase should not. */
  timeoutMs?: number;
  /**
   * The signed-in user, for the service's user-scoped routes.
   *
   * Sent as `x-user-id`, which is the ONLY identity the AI service reads — see
   * the note in its `middleware/userIdentity.ts`. Callers must resolve it from
   * the session themselves (`auth()`), never from anything a client sent;
   * `app/api/ai/[...path]/route.ts` does exactly this for browser traffic.
   * Omitting it is correct only for routes that need no user, and any
   * `requireUser` route answers 401 without it.
   */
  userId?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function ai<T>(path: string, init: AiInit = {}): Promise<T> {
  if (!AI_TOKEN) {
    // Failing loudly beats sending an unauthenticated request and reading a 401
    // as "the AI service is down".
    throw new BackendError(500, "AI_SERVICE_TOKEN is not configured");
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    "x-service-token": AI_TOKEN,
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.userId) headers["x-user-id"] = init.userId;

  // The service bounds its own provider calls, but a hung socket here would
  // hold a Next render open, so this side gets its own ceiling too.
  const timeout = AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

  const res = await fetch(`${AI_URL}/api/ai${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal,
  });

  return unwrapResponse<T>(res);
}

export async function aiOrNull<T>(path: string, init: AiInit = {}): Promise<T | null> {
  try {
    return await ai<T>(path, init);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}
