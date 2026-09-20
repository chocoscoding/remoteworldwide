// Browser-side calls for the admin speech-to-text lab.
//
// Every route lives in the AI service under /api/ai/voice/lab and goes through
// the session proxy (`app/api/ai/[...path]/route.ts`), which sets `x-user-id`
// and `x-user-role` from the verified session: the AI service answers 403 to
// anyone whose session is not ADMIN, whatever the page shows.
//
// No audio comes through here. The clip goes straight to S3 on the presigned
// POST `createLabRun` hands out (capture/s3Upload.ts), and live audio goes to
// the voice gateway on the `lab` ticket that comes with it.
//
// Like app/lib/voice/api.ts, dates stay ISO strings: the shared client revives
// `createdAt` into a Date, and the contract says string.

import { apiGet, apiPost } from "@/app/lib/api/client";
import type { LabRun, LabRunCreateInput, LabRunCreateResult, LabRunFinishInput, LabRunList, LabStats } from "./types";

export const LAB_PATH = "/api/ai/voice/lab";
const RUNS_PATH = `${LAB_PATH}/runs`;

// Ids go into the path, so they are encoded, as in `app/lib/voice/api.ts`.
const runPath = (id: string) => `${RUNS_PATH}/${encodeURIComponent(id)}`;

export type { LabRunCreateInput };

const isoOf = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value ?? ""));

const runOf = (run: LabRun): LabRun => ({ ...run, createdAt: isoOf(run.createdAt as unknown) });

/**
 * Starts a run (201): a single-use `lab` ticket for live AWS captions (null
 * when no gateway is configured), one presigned PUT for the whole clip, the
 * longest clip the day's lab minutes allow, and what is left today. 429 when
 * the lab's minutes are used up.
 */
export function createLabRun(input: LabRunCreateInput = {}) {
  return apiPost<LabRunCreateResult>(RUNS_PATH, input);
}

/**
 * The clip is uploaded: scores both live engines and finishes the run, 200 with
 * it `ready`. Nothing is started and nothing is polled — the engines captioned
 * the clip while it was recording. 409 while storage does not have the clip
 * yet; a repeat answers with the run as it stands.
 */
export async function finishLabRun(id: string, body: LabRunFinishInput): Promise<LabRun> {
  return runOf(await apiPost<LabRun>(`${runPath(id)}/finish`, body));
}

/** This admin's latest 50 runs, newest first. */
export async function listLabRuns(signal?: AbortSignal): Promise<LabRunList> {
  const list = await apiGet<LabRunList>(RUNS_PATH, signal);
  return { runs: (list?.runs ?? []).map(runOf) };
}

/** The last 30 days of real voice interviews: ratings, live-versus-batch agreement and fallbacks. */
export function getLabStats(signal?: AbortSignal) {
  return apiGet<LabStats>(`${LAB_PATH}/stats`, signal);
}
