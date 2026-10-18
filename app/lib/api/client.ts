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

import { unwrapEnvelope, unwrapResponse } from "./core";

interface RequestInit_ {
  /** A FormData body is passed through untouched — see the note in `request`. */
  /** Passed through from React Query so a superseded query aborts its fetch. */
  signal?: AbortSignal;
  body?: unknown;
  /**
   * Lets the request outlive the page — for a save fired as the tab closes.
   * Not a default: the browser caps keepalive bodies at 64KB in flight across
   * the whole page and rejects the fetch outright past it.
   */
  keepalive?: boolean;
}

function send(method: string, path: string, init: RequestInit_ = {}): Promise<Response> {
  const multipart = init.body instanceof FormData;
  const headers: Record<string, string> = { accept: "application/json" };
  // No content-type for multipart: only the browser knows the boundary it is
  // about to write, and setting the header by hand omits it.
  if (init.body !== undefined && !multipart) headers["content-type"] = "application/json";

  return fetch(path, {
    method,
    headers,
    body: init.body === undefined ? undefined : multipart ? (init.body as FormData) : JSON.stringify(init.body),
    // The whole point of the rewrites — send the session cookie.
    credentials: "same-origin",
    cache: "no-store",
    signal: init.signal,
    keepalive: init.keepalive,
  });
}

async function request<T>(method: string, path: string, init: RequestInit_ = {}): Promise<T> {
  return unwrapResponse<T>(await send(method, path, init));
}

export const apiGet = <T,>(path: string, signal?: AbortSignal) => request<T>("GET", path, { signal });
export const apiPost = <T,>(path: string, body?: unknown) => request<T>("POST", path, { body });
export const apiPut = <T,>(path: string, body?: unknown) => request<T>("PUT", path, { body });
export const apiPatch = <T,>(path: string, body?: unknown, options: { keepalive?: boolean } = {}) =>
  request<T>("PATCH", path, { body, keepalive: options.keepalive });
export const apiDelete = <T,>(path: string) => request<T>("DELETE", path);

/**
 * A multipart POST that reports how much of the body has gone out, 0 to 1.
 *
 * XHR rather than fetch: fetch has no upload progress. The answer is wrapped in
 * a Response so it unwraps (and fails) exactly like every other call. A network
 * fault rejects with a TypeError and an abort with an AbortError, as fetch does.
 */
export function apiUpload<T>(path: string, body: FormData, options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<T> {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    if (options.signal?.aborted) return reject(new DOMException("Upload cancelled", "AbortError"));
    options.signal?.addEventListener("abort", abort, { once: true });
    const done = () => options.signal?.removeEventListener("abort", abort);

    xhr.open("POST", path);
    xhr.withCredentials = true;
    xhr.setRequestHeader("accept", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) options.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      done();
      resolve(new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText, headers: { "content-type": "application/json" } }));
    };
    xhr.onerror = () => {
      done();
      reject(new TypeError("Network request failed"));
    };
    xhr.onabort = () => {
      done();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    xhr.send(body);
  }).then((res) => unwrapResponse<T>(res));
}

/** A POST whose answer's `message` matters too — see `unwrapEnvelope`. */
export const apiPostWithMessage = async <T,>(path: string, body?: unknown) => unwrapEnvelope<T>(await send("POST", path, { body }));
