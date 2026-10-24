import { safeNext } from "@/app/lib/next-url";

// The plan a signed-out visitor picked on /pricing, kept in this browser across signup.
//
// `?next=` carries it through signup itself, but an email signup then has to confirm its address,
// and the confirmation link lands on /verify-email with no `next` (it may even open in a new tab).
// That page asks here before sending a confirmed account on to setup. A day old and it is dropped:
// someone confirming next week did not come back to pay.

const KEY = "rww:pending-checkout";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function rememberCheckout(path: string): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Storage refused: the visitor picks the plan again on Billing.
  }
}

/** The Billing address to go to instead of setup, once; null when there is none (or it went stale). */
export function takeCheckout(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number" || Date.now() - at > MAX_AGE_MS) return null;
    const safe = safeNext(path, "");
    return safe.startsWith("/dashboard/settings/billing") ? safe : null;
  } catch {
    return null;
  }
}
