// The isomorphic core of every backend call.
//
// This used to live inside `app/lib/backend.ts`, which imports `next/headers`
// at module scope and therefore cannot be reached from a client component. The
// logic itself — the error type, the envelope shape, the date reviver — was
// never server-specific, so it moves here and both callers import it:
//
//   server  -> app/lib/backend.ts   (forwards cookies via next/headers)
//   browser -> app/lib/api/client.ts (cookies are first-party via the rewrites)
//
// Because both go through `unwrapResponse`, a React Query hook and a server
// prefetch of the same endpoint return byte-identical, date-revived data. That
// is what makes SSR hydration safe: the cache the server fills and the cache
// the browser fills hold the same shapes.

/** Keys the backend sends as ISO strings and the UI wants as real Dates. */
const DATE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "publishedAt",
  "consentAt",
  "unsubscribedAt",
  "periodStart",
  "periodEnd",
  "completedAt",
  "joinedAt",
  "subscribedAt",
]);

export class BackendError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/**
 * Walks a parsed JSON payload turning known date keys into `Date` objects.
 *
 * Exported because the query-cache persister has to run it again on restore:
 * `JSON.stringify` writes a Date as an ISO string, so a cache entry read back
 * from localStorage would hand components strings where they expect Dates and
 * every `date-fns` call downstream would throw.
 */
export function revive(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => revive(v));
  if (value && typeof value === "object") {
    if (value instanceof Date) return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, revive(v, k)]));
  }
  if (typeof value === "string" && key && DATE_KEYS.has(key)) return new Date(value);
  return value;
}

/**
 * The backend's response envelope is `{ data, message }`. Callers only ever
 * want `data`, so unwrapping happens here rather than at thirty call sites —
 * the storefront's one genuinely good API convention.
 */
export async function unwrapResponse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as { data?: unknown; message?: string } | null;
  if (!res.ok) throw new BackendError(res.status, json?.message ?? res.statusText);
  return revive(json?.data) as T;
}

/**
 * `unknown` -> a sentence a person can act on.
 *
 * Ported from the storefront's `handleApiError`, with one difference that
 * matters: there it is exported and then barely called, so users still see raw
 * error strings. Here every mutation's `onError` routes through it, so the
 * toast copy is decided in one place.
 */
export function apiMessage(error: unknown): string {
  if (error instanceof BackendError) {
    // A message the backend wrote is more specific than anything generic.
    if (error.message && error.message !== "Internal Server Error") return error.message;
    switch (error.status) {
      case 400:
        return "Something in that request wasn't right. Check the fields and try again.";
      case 401:
        return "Your session has expired. Sign in again to continue.";
      case 403:
        return "You don't have access to that.";
      case 404:
        return "We couldn't find that.";
      case 409:
        return "That conflicts with something that already exists.";
      case 429:
        return "Too many requests. Give it a moment.";
      default:
        return error.status >= 500 ? "Our server had a problem. Try again shortly." : "That didn't work.";
    }
  }
  // A fetch that never reached the server rejects with a TypeError.
  if (error instanceof TypeError) return "Can't reach the server. Check your connection.";
  if (error instanceof Error && error.name === "AbortError") return "That request was cancelled.";
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

/** Retry reads, but never a 4xx — the request is wrong, repeating won't fix it. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof BackendError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 3;
}
