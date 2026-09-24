// Browser-side calls for the ATS scorer.
//
// Every route lives in the AI service and goes through the session proxy at
// `app/api/ai/[...path]/route.ts`, never a rewrite: the proxy sets `x-user-id`
// from the verified session and adds the service token, so the browser never
// says who it is and never holds a secret. Paths are relative for the same
// reason as in `app/lib/api/client.ts`: the session cookie rides along
// first-party.
//
// A scan is not an ordinary JSON call. It answers in two frames on one
// response — the score as soon as it is computed, the written breakdown when
// the model returns — because the second is an order of magnitude slower than
// the first and the number is what the user is waiting for. Refusals made
// before anything is scored (401, 400, 402, 404) are plain JSON responses, not
// events, and reject like any other failed call.

import { apiGet, apiPost } from "@/app/lib/api/client";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { createSseParser } from "@/app/lib/api/sse";
import type { VaultDoc } from "@/app/lib/dashboard/types";
import type { BulletRewrite, ExtractedRequirements, IngestedResume, IngestedResumeDetail, ScanInput, ScanReport, StoredScan } from "./types";

export const ATS_PATH = "/api/ai/scan";
const RESUMES_PATH = "/api/ai/resume";

/** Not an AI-service path: this one is a Next route handler on this origin. */
const RESUME_FOR_DOC_PATH = "/api/ats/resume-for-doc";

/** Where a 402 sends someone to top up. */
export const ATS_BILLING_HREF = "/dashboard/settings/billing";

/** What one scan costs, for the copy that warns before spending it. */
export const SCAN_CREDITS = 1;

/**
 * The resumes a scan can name — parsed, chunked and embedded.
 *
 * Not the same list as My documents: a vault document is a file, and only a
 * resume that has been through `POST /api/ai/resume/imports` has the chunks a
 * scan scores against. `resolveResumeId` below is what bridges the two.
 */
export function listIngestedResumes(signal?: AbortSignal) {
  return apiGet<IngestedResume[]>(RESUMES_PATH, signal);
}

/**
 * One ingested resume, parsed content included — what the apply wizard sends to
 * the tailor and keyword tools, which work on content rather than on an id.
 * Another user's id is a 404.
 */
export function getIngestedResume(resumeId: string, signal?: AbortSignal) {
  return apiGet<IngestedResumeDetail>(`${RESUMES_PATH}/${encodeURIComponent(resumeId)}`, signal);
}

/** What a posting asks for, read on its own. Free: no resume, no credit. */
export function extractRequirements(jdText: string, jobId?: string | null) {
  return apiPost<ExtractedRequirements>(`${ATS_PATH}/requirements`, { jdText, jobId: jobId ?? null });
}

/**
 * The latest scan this user already ran against a posting — any of their
 * resumes — or null when it was never scanned. Free: it reads a stored score
 * back and never runs a scan, which is why the log-an-application payoff can
 * ask it as a side effect of logging without charging anyone.
 *
 * A POST with the description in the body, not a GET: a posting is tens of
 * kilobytes of text, and a query string is logged by every hop it crosses.
 */
export function lookupStoredScan(jdText: string) {
  return apiPost<StoredScan | null>(`${ATS_PATH}/lookup`, { jdText });
}

/**
 * A short, stable cache key for a posting's text (cyrb53), so the query key
 * never holds the description itself. Trimmed first, as the service trims it
 * before hashing, so the same paste is the same key.
 */
export function storedScanKey(jdText: string): string {
  const text = jdText.trim();
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${text.length}:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Which resume is this document?
// ---------------------------------------------------------------------------

/** The filename a vault document was stored under — what an import records. */
export const fileNameOf = (doc: Pick<VaultDoc, "name" | "ext">): string => (doc.ext ? `${doc.name}.${doc.ext}` : doc.name);

/**
 * An already-ingested resume for this document: the one the document is linked
 * to (`aiResumeId`, written the first time the bridge imported it), else one
 * matched on the filename the import recorded.
 *
 * The filename is only a fallback for documents imported before the link
 * existed: two documents can share a name, a renamed document stops matching,
 * and a deduped import keeps the FIRST upload's filename, so the same CV under
 * another name never matches. All harmless because the fallback below is
 * idempotent — importing again returns the resume that already exists, and now
 * links it. What a match buys is skipping a download and an upload.
 *
 * A resume that failed to parse is not a match: it has no chunks, so a scan
 * naming it would 404. Re-importing it is the right answer, and it will fail
 * again with a message the user can act on.
 */
export function findIngested(doc: Pick<VaultDoc, "name" | "ext" | "aiResumeId">, ingested: readonly IngestedResume[]): IngestedResume | null {
  const ready = ingested.filter((resume) => resume.status === "ready");
  const linked = doc.aiResumeId ? ready.find((resume) => resume.resumeId === doc.aiResumeId) : undefined;
  if (linked) return linked;
  const wanted = fileNameOf(doc).toLowerCase();
  return ready.find((resume) => resume.fileName.toLowerCase() === wanted) ?? null;
}

/**
 * Parses, chunks and embeds a vault document so it can be scored, and answers
 * with its resume id.
 *
 * Runs entirely on the server — see `app/api/ats/resume-for-doc/route.ts` for
 * why the signed URL is never fetched from the browser. Idempotent: the AI
 * service dedupes on the extracted text, so calling this for a document that
 * has already been imported returns the same id without re-embedding.
 */
export function prepareResumeForDoc(documentId: string) {
  // `chunkCount` is absent when the bridge answered from the document's link rather than an import.
  return apiPost<IngestedResume & { chunkCount?: number; duplicate: boolean }>(RESUME_FOR_DOC_PATH, { documentId });
}

/**
 * The resume id to score for a document: the one already ingested, or a fresh
 * import when there is none.
 *
 * The link lives on the document itself (`aiResumeId`): the bridge writes it on
 * import and answers from it afterwards, so neither side keeps a mapping table
 * that renames or deduped imports could put out of step.
 */
export async function resolveResumeId(doc: Pick<VaultDoc, "id" | "name" | "ext" | "aiResumeId">, ingested: readonly IngestedResume[]): Promise<string> {
  const known = findIngested(doc, ingested);
  if (known) return known.resumeId;
  const prepared = await prepareResumeForDoc(doc.id);
  return prepared.resumeId;
}

// ---------------------------------------------------------------------------
// One scan
// ---------------------------------------------------------------------------

/** A refusal before anything was scored: an ordinary non-2xx JSON response. */
export class ScanRequestError extends BackendError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = "ScanRequestError";
  }
}

/** A scan that failed after the score was sent, or a stream that ended without one. */
export class ScanStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanStreamError";
  }
}

const DROPPED_MESSAGE = "The scan was cut off before it finished. Try again.";
const UNREADABLE_MESSAGE = "The scan's result couldn't be read. Try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * A `scored` frame as a report.
 *
 * Checked rather than cast: the fields below are what the screen draws, and a
 * silently-missing `metrics` renders as an empty panel that looks like a
 * finished scan with nothing to say.
 */
function toReport(data: unknown): ScanReport | null {
  if (!isRecord(data)) return null;
  if (typeof data.scanId !== "string" || !isNumber(data.score)) return null;
  if (!Array.isArray(data.metrics) || !Array.isArray(data.gaps) || !Array.isArray(data.verdicts)) return null;

  return {
    scanId: data.scanId,
    resumeVersion: isNumber(data.resumeVersion) ? data.resumeVersion : 0,
    score: data.score,
    metrics: data.metrics as ScanReport["metrics"],
    gaps: data.gaps as ScanReport["gaps"],
    verdicts: data.verdicts as ScanReport["verdicts"],
    degraded: data.degraded === true,
    degradedReason: typeof data.degradedReason === "string" ? data.degradedReason : null,
    explanation: typeof data.explanation === "string" ? data.explanation : null,
    rewrites: Array.isArray(data.rewrites) ? (data.rewrites as BulletRewrite[]) : [],
  };
}

/** An `explained` frame. Rewrites the service could not ground are already gone. */
function toExplanation(data: unknown): { explanation: string; rewrites: BulletRewrite[] } | null {
  if (!isRecord(data) || typeof data.explanation !== "string" || !data.explanation.trim()) return null;
  return { explanation: data.explanation, rewrites: Array.isArray(data.rewrites) ? (data.rewrites as BulletRewrite[]) : [] };
}

const messageOf = (data: unknown): string => (isRecord(data) && typeof data.message === "string" ? data.message : "");

async function refusalFrom(res: Response): Promise<ScanRequestError> {
  const json = (await res.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof json?.message === "string" && json.message.trim() ? json.message : res.statusText;
  return new ScanRequestError(res.status, message);
}

export interface StreamScanOptions {
  /** Aborting stops reading and releases the connection. The scan itself is already paid for and stays cached. */
  signal?: AbortSignal;
  /** The score, the moment it lands — before the write-up is asked for. */
  onScored: (report: ScanReport) => void;
  /**
   * Why there is no written breakdown. Called instead of resolving with one:
   * a general score has nothing to explain, and a busy model is a missing
   * paragraph rather than a failed scan.
   */
  onUnexplained?: (message: string) => void;
}

/**
 * Score a resume, optionally against a posting. Resolves with the finished
 * report — the score, plus the explanation and rewrites if they arrived.
 *
 * Rejects with a `ScanRequestError` for a refusal before anything was scored
 * (no credits, unknown resume, signed out), a `ScanStreamError` for a stream
 * that ended without a score, a `TypeError` when the request never left, or an
 * `AbortError` once `signal` aborts.
 *
 * Re-scanning the same resume against the same posting is served from the
 * service's cache and is not charged again.
 */
export async function streamScan(input: ScanInput, { signal, onScored, onUnexplained }: StreamScanOptions): Promise<ScanReport> {
  const res = await fetch(ATS_PATH, {
    method: "POST",
    headers: { accept: "text/event-stream", "content-type": "application/json" },
    body: JSON.stringify({ resumeId: input.resumeId, jdText: input.jdText ?? null, jobId: input.jobId ?? null }),
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw await refusalFrom(res);

  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!res.body || type !== "text/event-stream") {
    await res.body?.cancel().catch(() => {});
    throw new ScanStreamError(UNREADABLE_MESSAGE);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  // `scored` is always first and `explained` / `unexplained` / `error` is
  // always terminal, so the read is done once one of the latter has arrived.
  const outcome: { report: ScanReport | null; settled: boolean } = { report: null, settled: false };

  const parser = createSseParser((frame) => {
    if (outcome.settled) return;

    switch (frame.event) {
      case "scored": {
        const report = toReport(parse(frame.data));
        if (!report) throw new ScanStreamError(UNREADABLE_MESSAGE);
        outcome.report = report;
        onScored(report);
        return;
      }
      case "explained": {
        const explained = toExplanation(parse(frame.data));
        // A score with no readable write-up is still the score; treat an
        // unreadable `explained` the way the service treats a declined one.
        if (outcome.report && explained) outcome.report = { ...outcome.report, ...explained };
        else onUnexplained?.("");
        outcome.settled = true;
        return;
      }
      case "unexplained": {
        onUnexplained?.(messageOf(parse(frame.data)));
        outcome.settled = true;
        return;
      }
      case "error": {
        // Only ever sent after `scored`, so the score survives it.
        onUnexplained?.(messageOf(parse(frame.data)));
        outcome.settled = true;
        return;
      }
      // An event a newer service added and this client does not know.
    }
  });

  let ended = false;
  try {
    while (!outcome.settled) {
      const { value, done } = await reader.read();
      if (done) {
        ended = true;
        parser.push(decoder.decode());
        parser.end();
        break;
      }
      parser.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    // Stopping early (settled, or on a frame that could not be read) cancels
    // the body, so the connection is not left open behind us.
    if (!ended) void reader.cancel().catch(() => {});
  }

  if (!outcome.report) throw new ScanStreamError(DROPPED_MESSAGE);
  return outcome.report;
}

/** A frame's data as JSON, or a throw the caller turns into "couldn't be read". */
function parse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    throw new ScanStreamError(UNREADABLE_MESSAGE);
  }
}

// ---------------------------------------------------------------------------
// Failures: what the report panel shows in place of a score
// ---------------------------------------------------------------------------

export type ScanFailureKind =
  /** Too few credits. Nothing was scored or charged. */
  | "credits"
  /** The resume is not one the scorer can read — never ingested, or parsing failed. */
  | "resume"
  | "failed";

export interface ScanFailure {
  kind: ScanFailureKind;
  message: string;
  /** False when running the same scan again cannot work, so no Retry is offered. */
  retryable: boolean;
}

// A retry cannot fix what the request itself got wrong.
const FINAL_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 413, 422]);

export function describeScanFailure(error: unknown): ScanFailure {
  if (error instanceof ScanRequestError) {
    // Retryable: people top up in another tab and come back to the same resume.
    if (error.status === 402) return { kind: "credits", message: error.message, retryable: true };
    if (error.status === 404) return { kind: "resume", message: error.message, retryable: false };
    return { kind: "failed", message: error.message, retryable: !FINAL_STATUSES.has(error.status) };
  }
  if (error instanceof ScanStreamError) return { kind: "failed", message: error.message, retryable: true };
  if (error instanceof Error && error.name === "AbortError") return { kind: "failed", message: DROPPED_MESSAGE, retryable: true };
  return { kind: "failed", message: apiMessage(error), retryable: true };
}

// ---------------------------------------------------------------------------
// Reading a score
// ---------------------------------------------------------------------------

/**
 * The banding the whole dashboard shares.
 *
 * Kept identical to `scoreTier` in `app/lib/dashboard/ats-stub.ts`, which the
 * job-fit estimate (`fit.ts`) still bands with — the AI service's contract test
 * asserts the two agree, so a band changed in one place and not the other is a
 * red build rather than two screens disagreeing about the same number.
 */
export function scanTier(score: number): { label: string; tone: "positive" | "neutral" | "urgent" } {
  if (score >= 85) return { label: "Strong match", tone: "positive" };
  if (score >= 65) return { label: "Good, not yet great", tone: "neutral" };
  return { label: "Needs work", tone: "urgent" };
}

/** Missing keywords, highest impact first — what the gap list draws. */
export const missingGaps = (report: ScanReport) => report.gaps.filter((gap) => !gap.present);

/**
 * A requirement as a chip.
 *
 * Mirrors `gapLabel` in the AI service's `scoringService.ts`, which is what
 * trimmed the labels on `report.gaps`. The covered chips are built here from
 * the verdicts — the report carries only what is missing — so without the same
 * trim one half of the keyword panel would read "Proven experience with
 * Kubernetes in production" beside the other half's "Kubernetes in
 * production". Mirrored rather than shared because the two projects have no
 * shared build, the same way `scanTier` is; the service's contract test keeps
 * the two spellings honest.
 */
const LABEL_PREAMBLE =
  /^(?:(?:proven|demonstrated|strong|solid|excellent|deep|hands[-\s]?on|extensive|prior|relevant|working)\s+)*(?:experience|expertise|proficiency|proficient|knowledge|familiarity|background|ability|understanding)\s+(?:with|in|of|using|across|building|developing|to)\s+/i;

const MAX_LABEL_CHARS = 60;

export function keywordLabel(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const trimmed = normalized.replace(LABEL_PREAMBLE, "").replace(/[.;:,]+$/, "");
  const label = trimmed.length > 0 ? trimmed : normalized;
  if (label.length <= MAX_LABEL_CHARS) return label;
  // Cut on a word boundary when there is one, as the service does.
  const hard = label.slice(0, MAX_LABEL_CHARS);
  const boundary = hard.lastIndexOf(" ");
  return boundary > 0 ? hard.slice(0, boundary) : hard;
}

/** The requirements the resume covered, as chips — the other half of the keyword panel. */
export const coveredKeywords = (report: ScanReport) =>
  report.verdicts.filter((v) => v.state === "satisfied").map((v) => ({ id: v.requirement.id, label: keywordLabel(v.requirement.text) }));

/** Requirements the resume did not cover, worst first, for the fix list. */
export function unmetRequirements(report: ScanReport) {
  const rank: Record<string, number> = { missing: 0, partial: 1, undetermined: 2, satisfied: 3 };
  return report.verdicts
    .filter((verdict) => verdict.state === "missing" || verdict.state === "partial")
    .sort((a, b) => rank[a.state] - rank[b.state] || b.requirement.weight - a.requirement.weight);
}
