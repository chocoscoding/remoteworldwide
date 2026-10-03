// The apply wizard's saved progress — `/api/apply-sessions` on the backend
// (rewritten there by next.config.mjs, behind the session cookie).
//
// One session per application being prepared (owner, 2026-10-03): the job as
// it was read, the step it was left on, and the wizard's own state — the
// resume picked, the one draft resume tailoring keeps updating, the last
// score, the letter drafts, the answers. A refresh reloads it from
// `?session=<id>`, and starting the same posting again offers to continue the
// unfinished one. The backend keeps `state` opaque; its shape is the wizard's
// (`./state.ts`).
//
// Mirrors the backend's `src/types/applySessions.ts` by hand, as the other
// clients here mirror theirs. `createdAt`/`updatedAt` arrive as Dates
// (`revive`); `finishedAt` stays a string.

import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/lib/api/client";
import type { EmploymentType, RemoteType } from "@/app/lib/jobs/types";

export type ApplySessionStatus = "active" | "finished" | "discarded";
export type ApplyStartSource = "link" | "paste" | "saved" | "board";
export type ApplyStep = 1 | 2 | 3 | 4 | 5;

/** The job as the wizard read it — `StartedJob` without its client id, which the session keeps beside it. */
export interface ApplySessionJob {
  savedJobId: string | null;
  unsavedReason: string | null;
  company: string;
  role: string;
  description: string | null;
  summary: string | null;
  url: string | null;
  applyUrl: string | null;
  salary: string | null;
  location: string | null;
  remoteType: RemoteType | null;
  employmentType: EmploymentType | null;
  requirements: string[];
  platform: boolean;
  source: ApplyStartSource;
}

export interface ApplySessionItem {
  id: string;
  status: ApplySessionStatus;
  /** The posting's key, read from its link; null for a pasted job, which is never offered as "continue". */
  postingKey: string | null;
  clientId: string;
  job: ApplySessionJob;
  step: ApplyStep;
  visited: number[];
  state: Record<string, unknown>;
  applicationId: string | null;
  finishedAt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplySessionSummary {
  id: string;
  status: ApplySessionStatus;
  postingKey: string | null;
  company: string;
  role: string;
  source: ApplyStartSource;
  url: string | null;
  step: ApplyStep;
  createdAt: Date;
  updatedAt: Date;
}

const PATH = "/api/apply-sessions";

/** Unfinished applications that can be continued: only ones with a link, since a pasted job can't be recognised again. */
export const listResumableSessions = (signal?: AbortSignal): Promise<ApplySessionSummary[]> =>
  apiGet<ApplySessionSummary[]>(`${PATH}?status=active&resumable=1`, signal);

/** The unfinished application for this posting's link, if there is one. */
export const matchApplySession = (url: string, signal?: AbortSignal): Promise<ApplySessionSummary | null> =>
  apiGet<ApplySessionSummary | null>(`${PATH}/match?url=${encodeURIComponent(url)}`, signal);

/** Starts one. `discard` names an unfinished one for the same posting that "Start a new one" sets aside. */
export const createApplySession = (input: { job: ApplySessionJob; clientId: string; discard?: string }): Promise<ApplySessionItem> =>
  apiPost<ApplySessionItem>(PATH, input);

export const getApplySession = (id: string, signal?: AbortSignal): Promise<ApplySessionItem> =>
  apiGet<ApplySessionItem>(`${PATH}/${encodeURIComponent(id)}`, signal);

export interface ApplySessionPatch {
  step?: ApplyStep;
  visited?: number[];
  state?: Record<string, unknown>;
}

/** The browser's keepalive quota is 64KB across every such request in flight; a bigger save goes as an ordinary one. */
const KEEPALIVE_MAX_BYTES = 48_000;

/** The autosave. `state` replaces the stored one whole. */
export function saveApplySession(id: string, patch: ApplySessionPatch, options: { keepalive?: boolean } = {}): Promise<{ id: string; updatedAt: Date }> {
  const keepalive = options.keepalive === true && new Blob([JSON.stringify(patch)]).size <= KEEPALIVE_MAX_BYTES;
  return apiPatch<{ id: string; updatedAt: Date }>(`${PATH}/${encodeURIComponent(id)}`, patch, { keepalive });
}

/** "Track as applied" is done: the session closes, and a new application for the same job starts fresh. */
export const finishApplySession = (id: string, applicationId: string | null): Promise<ApplySessionSummary> =>
  apiPost<ApplySessionSummary>(`${PATH}/${encodeURIComponent(id)}/finish`, { applicationId });

/** Dismissed from the continue list, for good. */
export const deleteApplySession = (id: string): Promise<{ id: string }> => apiDelete<{ id: string }>(`${PATH}/${encodeURIComponent(id)}`);
