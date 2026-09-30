"use server";

// The coverage review queue (/heroshima/coverage) talks to the backend through
// these server actions — the recommendations-admin pattern
// (libs/recommendations-admin.ts).
//
// Every call forwards the admin's own Auth.js session cookie (`session: true`)
// and the backend's isAdmin guard on /api/coverage-requests/admin is the
// boundary: a server action is reachable by a direct POST from anyone, so no
// check here is load-bearing, and no token is involved anywhere. The status
// write still refuses a non-admin itself (requireAdminAction), as defense in depth.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/lib/auth/action-guards";
import { backend, BackendError, isObjectId, type BackendInit } from "@/app/lib/backend";
import {
  COVERAGE_REQUEST_STATUSES,
  type AdminCoverageFilter,
  type AdminCoverageRequestItem,
  type AdminCoverageRequestList,
} from "@/app/lib/coverage/types";

const QUEUE_PATH = "/heroshima/coverage";

const admin = <T>(path: string, init: BackendInit = {}) => backend<T>(`/coverage-requests/admin${path}`, { ...init, session: true });

export interface CoverageQueueQuery {
  page?: number;
  status?: AdminCoverageFilter;
  /** Only pages people added to the extension by hand. Off lists every request, not the others. */
  added?: boolean;
}

export const listCoverageRequests = async ({ page = 1, status = "open", added = false }: CoverageQueueQuery = {}) => {
  const params = new URLSearchParams({ page: String(page), status });
  if (added) params.set("added", "true");
  return admin<AdminCoverageRequestList>(`?${params.toString()}`);
};

/**
 * A row's Reviewed / Dismiss / Reopen button. A plain `<form action>` from the
 * server-rendered table, so it works before hydration and needs no client
 * component.
 *
 * Form actions return nothing to the page, so a refusal the admin should see
 * (a 409 when reopening a request whose page has a newer open one) comes back
 * as a `notice` on the URL the form was sent from. `back` is only ever this
 * screen's own address; anything else falls back to the queue.
 */
export async function setCoverageRequestStatus(formData: FormData): Promise<void> {
  // First, before anything else runs: without it a non-admin's call still
  // reached the backend and then revalidated the queue and redirected.
  await requireAdminAction();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const sentFrom = String(formData.get("back") ?? "");
  const back = sentFrom === QUEUE_PATH || sentFrom.startsWith(`${QUEUE_PATH}?`) ? sentFrom : QUEUE_PATH;
  // encodeURIComponent below leaves a bare ".." intact; only a real id may become a path segment.
  if (!isObjectId(id) || !(COVERAGE_REQUEST_STATUSES as readonly string[]).includes(status)) return;

  let notice: string | null = null;
  try {
    await admin<AdminCoverageRequestItem>(`/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } });
  } catch (error) {
    if (!(error instanceof BackendError && error.status < 500)) throw error;
    notice = error.message;
  }

  revalidatePath(QUEUE_PATH);
  // A notice belongs to the click that caused it: the next one clears it, whichever way it goes.
  const url = new URL(back, "http://queue.local");
  const hadNotice = url.searchParams.has("notice");
  url.searchParams.delete("notice");
  if (notice) url.searchParams.set("notice", notice);
  // Outside the try: `redirect` works by throwing.
  if (notice || hadNotice) redirect(`${url.pathname}${url.search}`);
}
