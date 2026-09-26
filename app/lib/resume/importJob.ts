// Waiting for a resume import to finish.
//
// `POST /api/ai/resume/imports` no longer reads the file while the request
// waits. The AI service parks the upload in object storage, queues the parse
// for its worker, and answers 202 with a job; `GET .../imports/:jobId` is where
// the parsed resume turns up. This is the one loop that waits for it, shared by
// the browser (`./api.ts`) and the server-side bridge
// (`app/api/ats/resume-for-doc/route.ts`) — two loops is how one of them ends
// up treating a failed import as "still going" until it times out.
//
// It lives here rather than in `./api.ts` for the reason `./mime.ts` does:
// `./api.ts` is built on the browser fetch client, which a route handler cannot
// load. So this imports nothing but the isomorphic error type, and the caller
// hands in how to read a job — the session proxy from the browser, `ai()` with
// the service token from the server.
//
// The shapes mirror `ResumeImportJob` and `ResumeImportView` in the AI
// service's `src/services/resumeImportService.ts`, and
// `tests/contracts/frontend-resume-import.test.ts` there compiles this file and
// runs it, so a drift on either side fails a build rather than a spinner.

import { BackendError } from "@/app/lib/api/core";

export type ResumeImportStatus = "queued" | "running" | "done" | "failed";

export interface ResumeImportJob {
  id: string;
  status: ResumeImportStatus;
  /** The sentence to show once `status` is "failed"; null before that. */
  error: string | null;
  /** What the import was refused with once failed — 415 or 422 for a file to fix, 429 or 503 for a busy moment. */
  code: number | null;
}

/** What `POST .../imports` answers with. */
export interface ResumeImportAccepted {
  job: ResumeImportJob;
}

/** What `GET .../imports/:jobId` answers with. `resume` arrives with "done": what the import route itself used to answer. */
export interface ResumeImportView<R> {
  job: ResumeImportJob;
  resume: R | null;
}

/** Between asks. A text file is back in about a second and a long PDF in a few, so a second keeps the wait feeling immediate without chattering. */
export const IMPORT_POLL_MS = 1_000;

/**
 * How long a person is kept waiting before being told. Long enough to outlast
 * the worker's own retries — three attempts, 2s, 4s and 8s apart, each allowed
 * a 15s parse — and short enough that a stuck queue is not a spinner forever.
 */
export const IMPORT_WAIT_MS = 90_000;

export const IMPORT_TIMED_OUT = "Reading that file is taking longer than usual. Try again in a minute — it may be ready by then.";

const IMPORT_FAILED = "That resume could not be read. Please try again.";

export interface WaitForImportOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A failed import as the error every caller already shows: the service's sentence, with the status it was refused with. */
const refused = (job: ResumeImportJob) => new BackendError(job.code ?? 422, job.error || IMPORT_FAILED);

/**
 * Resolves with the imported resume once the job is done. Throws `BackendError`
 * with the service's own sentence when the import failed, and a 504 when it
 * outlasted `timeoutMs`.
 *
 * A read refused with a 4xx is an answer — signed out, no such import — and is
 * thrown at once. Anything else (the proxy briefly unreachable, the AI service
 * restarting, one read timing out) is waited out like a slow parse: the job
 * lives in the service's queue, not in this request, and is still running.
 */
export async function waitForImport<R>(
  accepted: ResumeImportJob,
  read: (jobId: string) => Promise<ResumeImportView<R>>,
  options: WaitForImportOptions = {},
): Promise<R> {
  const interval = options.intervalMs ?? IMPORT_POLL_MS;
  const deadline = Date.now() + (options.timeoutMs ?? IMPORT_WAIT_MS);
  if (accepted.status === "failed") throw refused(accepted);

  // A file imported before comes back "done" at once and is read straight
  // away; anything else was only just queued, and gets one interval first.
  if (accepted.status !== "done") await pause(interval);

  for (;;) {
    let view: ResumeImportView<R> | null = null;
    try {
      view = await read(accepted.id);
    } catch (error) {
      if (error instanceof BackendError && error.status >= 400 && error.status < 500) throw error;
    }
    if (view) {
      if (view.job.status === "failed") throw refused(view.job);
      if (view.job.status === "done" && view.resume) return view.resume;
    }
    if (Date.now() + interval > deadline) throw new BackendError(504, IMPORT_TIMED_OUT);
    await pause(interval);
  }
}
