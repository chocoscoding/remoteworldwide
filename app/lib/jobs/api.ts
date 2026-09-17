// Browser-side calls for the job picker: Remote Worldwide listings, the user's
// saved jobs, and job imports.
//
// Every path is relative and goes through the rewrites in `next.config.mjs`
// (`/api/platform-jobs/*`, `/api/saved-jobs/*`, `/api/job-imports/*`), so the
// Auth.js cookie rides along first-party and the backend's session guard sees
// the user. Nothing here reads the session or sends a token. That also makes
// this module browser-only, exactly like `app/lib/api/client.ts` beneath it.
//
// Plain functions rather than hooks, so the picker can run a multi-step flow
// (save, then enrich, then re-read) without threading three mutation objects
// through it. `hooks/queries/useJobQueries.ts` and
// `hooks/mutations/useJobMutations.ts` wrap them for caching.

import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/lib/api/client";
import {
  JOB_IMPORT_STATUSES,
  TERMINAL_IMPORT_STATUSES,
  type JobImportItem,
  type JobImportStatus,
  type PlatformJobSearchItem,
  type SaveJobInput,
  type SavedJobItem,
  type StartJobImportInput,
  type UpdateSavedJobInput,
} from "./types";

export const PLATFORM_JOBS_PATH = "/api/platform-jobs";
export const SAVED_JOBS_PATH = "/api/saved-jobs";
export const JOB_IMPORTS_PATH = "/api/job-imports";

/** Listings per search. The picker shows them in a 320px list; past twenty is scrolling nobody does. */
export const PLATFORM_SEARCH_LIMIT = 20;

// Ids go into the path, so they are encoded. An id is only ever an ObjectId
// from our own responses, but a "../" reaching here through a bad caller would
// otherwise address a different route behind the same rewrite.
const at = (base: string, id: string) => `${base}/${encodeURIComponent(id)}`;

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

// ---------------------------------------------------------------------------
// Remote Worldwide listings
// ---------------------------------------------------------------------------

/** Active listings, newest first. An empty `q` is the newest listings, which is what the picker opens on. */
export function searchPlatformJobs(q: string, limit = PLATFORM_SEARCH_LIMIT, signal?: AbortSignal) {
  return apiGet<PlatformJobSearchItem[]>(withQuery(`${PLATFORM_JOBS_PATH}/search`, { q: q.trim(), limit }), signal);
}

// ---------------------------------------------------------------------------
// Saved jobs
// ---------------------------------------------------------------------------

/** "Your jobs", most recently used first. */
export function listSavedJobs(q = "", signal?: AbortSignal) {
  return apiGet<SavedJobItem[]>(withQuery(SAVED_JOBS_PATH, { q: q.trim() }), signal);
}

/** Another user's id is a 404, never a 403, so ids cannot be probed. */
export function getSavedJob(id: string, signal?: AbortSignal) {
  return apiGet<SavedJobItem>(at(SAVED_JOBS_PATH, id), signal);
}

/**
 * Save a listing by id, or a draft the user checked. Saving something already
 * saved answers 200 "Already in your jobs" with the existing row, never a 409,
 * so the caller treats every 2xx the same way: this is the job.
 */
export function saveJob(input: SaveJobInput) {
  return apiPost<SavedJobItem>(SAVED_JOBS_PATH, input);
}

export function updateSavedJob(id: string, input: UpdateSavedJobInput) {
  return apiPatch<SavedJobItem>(at(SAVED_JOBS_PATH, id), input);
}

export function deleteSavedJob(id: string) {
  return apiDelete<unknown>(at(SAVED_JOBS_PATH, id));
}

// ---------------------------------------------------------------------------
// Imports — start with POST, then poll GET until the status is terminal
// ---------------------------------------------------------------------------

export interface StartedJobImport {
  importId: string;
  status: JobImportStatus;
}

const STATUS_SET: ReadonlySet<string> = new Set(JOB_IMPORT_STATUSES);
const TERMINAL_SET: ReadonlySet<JobImportStatus> = new Set(TERMINAL_IMPORT_STATUSES);

/** Whether polling should stop: `done`, `failed` or `abandoned`. */
export function isTerminalImportStatus(status: JobImportStatus | null | undefined): boolean {
  return status !== null && status !== undefined && TERMINAL_SET.has(status);
}

// Poll timing. Shared by the picker's watch (`hooks/queries/useJobImport.ts`)
// and the log and apply flows (`app/lib/dashboard/parse-jd.ts`), so both ask on
// the same cadence. It sits beside the call it paces, so nothing under app/lib
// reaches up into hooks/ for it.

/**
 * The first gap between polls. Cached and public-ATS imports are usually done
 * inside a second, so the first answer should land about then.
 */
export const IMPORT_POLL_START_MS = 800;
/** Each gap after that grows by this factor... */
export const IMPORT_POLL_BACKOFF = 1.3;
/**
 * ...up to this. A rendered crawl plus extraction runs 10–30 s; asking every
 * 3 s costs about ten GETs for the slowest one, against a limiter whose
 * per-IP budget every user of the site shares.
 */
export const IMPORT_POLL_MAX_MS = 3_000;

/** The wait before the next poll, after `pollsSoFar` answers. */
export function importPollDelay(pollsSoFar: number): number {
  return Math.min(IMPORT_POLL_MAX_MS, Math.round(IMPORT_POLL_START_MS * IMPORT_POLL_BACKOFF ** pollsSoFar));
}

/**
 * Start an import and return its id.
 *
 * The plan documents the 202 body as `{ importId, status }`, while the contract
 * names no type for it and the import's own wire shape (`JobImportItem`) calls
 * the id `id`. Both readings are accepted, because the cost of guessing wrong
 * is a spinner polling `undefined` until someone closes the dialog. A missing
 * status is read as `queued`: the first poll replaces it within a second.
 */
export async function startJobImport(input: StartJobImportInput): Promise<StartedJobImport> {
  const data = await apiPost<{ importId?: unknown; id?: unknown; status?: unknown } | null>(JOB_IMPORTS_PATH, input);
  const importId = typeof data?.importId === "string" ? data.importId : typeof data?.id === "string" ? data.id : null;
  if (!importId) throw new Error("That didn't start. Try again.");
  const status = data?.status;
  return { importId, status: typeof status === "string" && STATUS_SET.has(status) ? (status as JobImportStatus) : "queued" };
}

/** Another user's import is a 404. A row in flight past the backend's stale window reads as `failed` with `timeout`. */
export function getJobImport(id: string, signal?: AbortSignal) {
  return apiGet<JobImportItem>(at(JOB_IMPORTS_PATH, id), signal);
}

/** Marks the import abandoned. If its result still arrives, the backend caches it for the next person. */
export function abandonJobImport(id: string) {
  return apiDelete<unknown>(at(JOB_IMPORTS_PATH, id));
}
