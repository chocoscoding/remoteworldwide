import { headers } from "next/headers";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
const DATE_KEYS = new Set(["createdAt", "updatedAt", "publishedAt", "consentAt", "unsubscribedAt", "periodStart", "periodEnd", "completedAt", "joinedAt", "subscribedAt"]);

export class BackendError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface BackendInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  session?: boolean;
}

function revive(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => revive(v));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, revive(v, k)]));
  }
  if (typeof value === "string" && key && DATE_KEYS.has(key)) return new Date(value);
  return value;
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
  const json = (await res.json().catch(() => null)) as { data?: unknown; message?: string } | null;
  if (!res.ok) throw new BackendError(res.status, json?.message ?? res.statusText);
  return revive(json?.data) as T;
}

export async function backendOrNull<T>(path: string, init: BackendInit = {}): Promise<T | null> {
  try {
    return await backend<T>(path, init);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}
