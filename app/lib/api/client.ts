"use client";

// Browser-side backend calls, for React Query hooks.
//
// Paths are relative (`/api/settings/me`), which matters: `next.config.mjs`
// rewrites `/api/settings/*`, `/api/billing/*`, `/api/users/*` and friends to
// the Express backend, so the request goes out on the frontend origin and the
// Auth.js session cookie rides along as a first-party cookie. That is why this
// needs no Authorization header and no session lookup.
//
// Worth stating, because the storefront gets this wrong: it awaits
// `getSession()` inside an axios request interceptor on every single call,
// which is an extra network round trip per request. Nothing here reads the
// session at all.

import { unwrapResponse } from "./core";

interface RequestInit_ {
  /** Passed through from React Query so a superseded query aborts its fetch. */
  signal?: AbortSignal;
  body?: unknown;
}

async function request<T>(method: string, path: string, init: RequestInit_ = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(path, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // The whole point of the rewrites — send the session cookie.
    credentials: "same-origin",
    cache: "no-store",
    signal: init.signal,
  });
  return unwrapResponse<T>(res);
}

export const apiGet = <T,>(path: string, signal?: AbortSignal) => request<T>("GET", path, { signal });
export const apiPost = <T,>(path: string, body?: unknown) => request<T>("POST", path, { body });
export const apiPut = <T,>(path: string, body?: unknown) => request<T>("PUT", path, { body });
export const apiPatch = <T,>(path: string, body?: unknown) => request<T>("PATCH", path, { body });
export const apiDelete = <T,>(path: string) => request<T>("DELETE", path);
