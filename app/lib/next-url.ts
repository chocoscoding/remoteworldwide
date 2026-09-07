export const DEFAULT_NEXT = "/";

export function safeNext(value: string | string[] | null | undefined, fallback: string = DEFAULT_NEXT): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return fallback;
  return raw;
}

export function requiresSession(path: string): boolean {
  return path.startsWith("/dashboard");
}

export function loginWithNext(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
