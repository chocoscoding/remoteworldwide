// Who sees ads: Free accounts and signed-out visitors. Pro and Ultra browse ad-free.
//
// Decided on the server, in the page, so a paying member never sees an ad render
// and then vanish once a client-side check catches up. Server-only: it reads the
// request's cookies through `backend()`.

import { headers } from "next/headers";
import { backend, BackendError } from "@/app/lib/backend";
import type { PlanTier } from "@/app/lib/settings/types";

/** Plans that never see ads. */
const AD_FREE_TIERS: readonly PlanTier[] = ["pro", "ultra"];

// The backend's Auth.js session cookie (default name; `__Secure-` over https, `.0`,
// `.1`… when chunked). Without it the visitor is signed out, so there is no plan to
// look up and the page skips the backend call entirely.
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?authjs\.session-token(?:\.\d+)?=/;

export async function showsAds(): Promise<boolean> {
  const cookie = (await headers()).get("cookie") ?? "";
  if (!SESSION_COOKIE.test(cookie)) return true;
  try {
    const { tier } = await backend<{ tier: PlanTier }>("/billing/credits", { session: true });
    return !AD_FREE_TIERS.includes(tier);
  } catch (error) {
    // 401: the cookie was stale, so they are signed out after all. Anything else
    // leaves the plan unknown, and a paying member seeing ads is the worse mistake,
    // so the page goes without — the same way the AI service's plan gates fail open.
    return error instanceof BackendError && error.status === 401;
  }
}
