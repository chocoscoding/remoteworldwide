export const DEFAULT_NEXT = "/";

/**
 * Where a new account goes first: the profile setup the extension reads before it fills anything.
 * Inside the dashboard (owner, 2026-09-27) — the sidebar stays, no sidebar item points at it — and
 * non-blocking: the dashboard's banner only nudges.
 */
export const ONBOARDING_PATH = "/dashboard/onboarding";

/** Where setup lands once every checklist item is in. */
export const ONBOARDING_DONE_PATH = "/dashboard/onboarding/done";

/**
 * Where setup used to live. It only redirects now, to `ONBOARDING_PATH` with its query (the
 * `#fragment` rides the redirect by itself), so the links the extension and old emails carry still
 * land on the right field.
 */
export const LEGACY_ONBOARDING_PATH = "/onboarding";

export function safeNext(value: string | string[] | null | undefined, fallback: string = DEFAULT_NEXT): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return fallback;
  return raw;
}

export function requiresSession(path: string): boolean {
  return path.startsWith("/dashboard") || path === LEGACY_ONBOARDING_PATH || path.startsWith(`${LEGACY_ONBOARDING_PATH}/`);
}

export function loginWithNext(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
