// The browser half of activity tracking (owner, 2026-10-28: "track everything the user does").
// Page views, presses and form sends are queued here and posted in batches to /api/track, which
// the backend stores for the admin's users and activity screens (remoteworldwidebackend
// src/types/tracking.ts). The backend adds every change made through its API on its own side.
//
// What is never sent: anything typed into a field, a field's value, or a query string. A press is
// named by what the control says (its data-track, aria-label or visible text), cut short.
//
// Browser-only: `ActivityTracker` starts and stops it.

import type { TrackKind } from "./types";

const ENDPOINT = "/api/track";
const FLUSH_MS = 5000;
const FLUSH_AT = 20;
const LABEL_MAX = 80;
const SESSION_KEY = "rww_track_session";
const ANON_KEY = "rww_track_anon";

interface QueuedEvent {
  kind: TrackKind;
  name: string;
  path: string;
  at: string;
  props?: Record<string, string | number | boolean>;
}

let queue: QueuedEvent[] = [];
let timer: number | null = null;
let anonId: string | null = null;

const randomId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

/** One id per tab visit, so the timeline reads as sittings. */
function sessionId(): string {
  try {
    const found = sessionStorage.getItem(SESSION_KEY);
    if (found) return found;
    const fresh = randomId();
    sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return "no-storage";
  }
}

/** A random id this browser keeps, sent only for a signed-out visitor who accepted analytics cookies. */
function storedAnonId(): string | null {
  try {
    const found = localStorage.getItem(ANON_KEY);
    if (found) return found;
    const fresh = randomId();
    localStorage.setItem(ANON_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** True once per tab: the first call starts the visit's id, so only the first page is marked as a new visit. */
export function startVisit(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    sessionId();
    return true;
  } catch {
    return false;
  }
}

/** Who the batches are for: signed in (the session cookie says), or a consenting visitor, or nobody (nothing is sent). */
export function setIdentity(mode: "user" | "anon" | "none"): void {
  anonId = mode === "anon" ? storedAnonId() : null;
  if (mode === "none") queue = [];
}

export function flush(useBeacon = false): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue;
  queue = [];
  const body = JSON.stringify({ sessionId: sessionId(), ...(anonId ? { anonId } : {}), events });
  try {
    if (useBeacon && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    void fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {});
  } catch {
    /* Tracking must never get in the way of the page. */
  }
}

export function track(kind: TrackKind, name: string, props?: QueuedEvent["props"]): void {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, LABEL_MAX);
  if (!clean) return;
  queue.push({ kind, name: clean, path: window.location.pathname, at: new Date().toISOString(), ...(props && Object.keys(props).length ? { props } : {}) });
  if (queue.length >= FLUSH_AT) flush();
  else if (timer === null) timer = window.setTimeout(() => flush(), FLUSH_MS);
}

const CONTROL = 'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], [role="option"], [data-track], summary, input[type="checkbox"], input[type="radio"], select';

/** What a control says, never what was typed into one. */
export function labelOf(el: Element): string {
  const own = el.getAttribute("data-track") || el.getAttribute("aria-label") || el.getAttribute("title");
  if (own) return own;
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    const id = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    return (id instanceof HTMLElement ? id.innerText : "") || el.getAttribute("name") || el.type || "field";
  }
  const text = el instanceof HTMLElement ? el.innerText : el.textContent ?? "";
  if (text.trim()) return text;
  const img = el.querySelector("img[alt], svg[aria-label]");
  return img?.getAttribute("alt") || img?.getAttribute("aria-label") || el.tagName.toLowerCase();
}

/** A link's target: the path for this site, the origin and path for anywhere else. */
function hrefOf(el: Element): string | null {
  if (!(el instanceof HTMLAnchorElement) || !el.href) return null;
  try {
    const url = new URL(el.href);
    return url.origin === window.location.origin ? url.pathname : `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function onClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target.closest(CONTROL) : null;
  if (!target || target.closest("[data-track-ignore]")) return;
  const href = hrefOf(target);
  const props: Record<string, string | number | boolean> = { tag: target.tagName.toLowerCase() };
  if (href) props.href = href.slice(0, 200);
  if (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) props.checked = target.checked;
  const region = target.closest("[data-track-region], [aria-label][role='dialog'], dialog, nav, header, aside, main");
  const regionName = region?.getAttribute("data-track-region") || (region?.getAttribute("role") === "dialog" ? region.getAttribute("aria-label") : null) || region?.tagName.toLowerCase();
  if (regionName) props.region = regionName.slice(0, 60);
  track("click", labelOf(target), props);
  // A link to another page may unload this one before the timer fires.
  if (href) flush(true);
}

export function onSubmit(event: SubmitEvent): void {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || form.closest("[data-track-ignore]")) return;
  const submitter = event.submitter ? labelOf(event.submitter) : null;
  const name = form.getAttribute("data-track") || form.getAttribute("aria-label") || form.getAttribute("name") || form.id || submitter || "Form";
  track("submit", name, { fields: form.elements.length, ...(submitter ? { button: submitter.slice(0, 60) } : {}) });
}
