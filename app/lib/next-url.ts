export const DEFAULT_NEXT = "/";

/**
 * Where a new account goes first: the required setup (a resume and a profile) the extension checks
 * before it fills anything. Outside /dashboard, and non-blocking there — the dashboard only nudges.
 */
export const ONBOARDING_PATH = "/onboarding";

export function safeNext(value: string | string[] | null | undefined, fallback: string = DEFAULT_NEXT): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return fallback;
  return raw;
}

export function requiresSession(path: string): boolean {
  return path.startsWith("/dashboard") || path === ONBOARDING_PATH || path.startsWith(`${ONBOARDING_PATH}/`);
}

export function loginWithNext(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
