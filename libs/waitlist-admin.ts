"use server";

// The waitlist screen (/heroshima/waitlist) talks to the backend through these
// server actions — the recommendations-admin pattern (libs/recommendations-admin.ts).
//
// Every call forwards the admin's own Auth.js session cookie (`session: true`)
// and the backend's isAdmin guard on /api/waitlist/admin is the boundary: a
// server action is reachable by a direct POST from anyone, and no token is
// involved anywhere. Each export also refuses a non-admin itself
// (requireAdminAction), so such a call fails here instead of on the backend's
// word alone. These go server to backend directly (app/lib/backend.ts), so no
// /api/waitlist/admin rewrite exists in next.config.mjs, and none is needed.
//
// The grant is Pro for one month with a 100-credit allowance for that month;
// the backend applies it (now, or when they sign up) and emails each person.

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/app/lib/auth/action-guards";
import { backend, BackendError, type BackendInit } from "@/app/lib/backend";
import { grantBody } from "@/app/lib/waitlist/admin";
import {
  WAITLIST_ADMIN_FILTERS,
  WAITLIST_ADMIN_PAGE_MAX,
  WAITLIST_ADMIN_PAGE_SIZE,
  type WaitlistAdminFilter,
  type WaitlistAdminList,
  type WaitlistGrantRequest,
  type WaitlistGrantResult,
} from "@/app/lib/waitlist/types";

const SCREEN = "/heroshima/waitlist";

const admin = <T>(path: string, init: BackendInit = {}) => backend<T>(`/waitlist/admin${path}`, { ...init, session: true });

/** A 4xx comes back as a message the screen can show; anything else is a real failure and throws. */
async function attempt<T>(run: () => Promise<T>): Promise<{ data: T; error?: never } | { error: string; data?: never }> {
  try {
    const data = await run();
    revalidatePath(SCREEN);
    return { data };
  } catch (error) {
    if (error instanceof BackendError && error.status < 500) return { error: error.message };
    throw error;
  }
}

export interface WaitlistAdminQuery {
  /** Part of an email. */
  q?: string;
  status?: WaitlistAdminFilter;
  page?: number;
  limit?: number;
}

/** One page of the waitlist, first in line first, with every tab's count. */
export const listWaitlist = async ({ q = "", status = "all", page = 1, limit = WAITLIST_ADMIN_PAGE_SIZE }: WaitlistAdminQuery = {}) => {
  await requireAdminAction();
  // The arguments are the caller's: only a known filter and sane numbers go on the URL.
  const filter: WaitlistAdminFilter = (WAITLIST_ADMIN_FILTERS as readonly string[]).includes(status) ? status : "all";
  const params = new URLSearchParams({
    status: filter,
    page: String(Math.max(1, Math.floor(Number(page)) || 1)),
    limit: String(Math.min(WAITLIST_ADMIN_PAGE_MAX, Math.max(1, Math.floor(Number(limit)) || WAITLIST_ADMIN_PAGE_SIZE))),
  });
  const search = typeof q === "string" ? q.trim() : "";
  if (search) params.set("q", search);
  return admin<WaitlistAdminList>(`?${params.toString()}`);
};

/**
 * Pro for a month with 100 credits, to the rows picked (`{ ids }`, at most 500) or to every
 * WAITING signup matching the search (`{ all: true, q }`). Anyone granted before is left alone and
 * counted in `alreadyGranted`; anyone already paying is skipped. A refusal (400) comes back as
 * `{ error }`.
 */
export const grantWaitlist = async (request: WaitlistGrantRequest) => {
  await requireAdminAction();
  return attempt(() => {
    const body = grantBody(request);
    if (typeof body === "string") throw new BackendError(400, body);
    return admin<WaitlistGrantResult>("/grant", { method: "POST", body });
  });
};
