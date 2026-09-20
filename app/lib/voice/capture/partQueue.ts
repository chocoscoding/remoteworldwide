// The recording's way to storage: MediaRecorder chunks, cut into numbered
// parts, each sent to storage by its own presigned PUT.
//
// Pure: no DOM, no fetch, no timers of its own beyond the injectable sleep.
// Blob and Web Crypto are the only platform pieces, and Node has both, which
// is how the AI service's contract suite runs this file as written
// (tests/contracts/frontend-voice-capture.test.ts).
//
// Why parts rather than one upload at the end: an interview runs up to 40
// minutes on whatever connection the user has, and a tab can close at any
// moment. Every part that reaches S3 is audio the report can use, so the queue
// sends as it goes. The AI service concatenates parts 0..n byte for byte and
// stops at the first gap, which is why the order matters and why a part is a
// plain byte range: cutting a WebM cluster in half is fine, because the halves
// are joined again before anything reads them.
//
// What it guarantees:
//  - `seq` is assigned when a part is cut, from 0, and never changes, however
//    often the part is retried. So does its sha256, which goes in the manifest
//    the finish call sends, so the server can tell a whole part from a torn one.
//  - At most `concurrency` parts are in flight, started lowest `seq` first.
//  - A failure is retried with exponential backoff and jitter. A part that
//    fails for good is reported and skipped; it never holds up later parts,
//    since the server can still use everything before the gap, and a later
//    `retry` may fill it.
//  - URLs are refilled from the server when the queue runs out or one expires.
//    Nothing past `maxParts` is cut: the server would refuse it, and the
//    recording cap is what the user is billed against.

import type { PartManifestEntry, PartUrl, PartUrlsResult } from "@/app/lib/voice/types";

/** Audio in one part. Matches the AI service's `VOICE_PART_SECONDS` default. */
export const PART_SECONDS = 5;
/** A part is also cut once this much is buffered, whatever its length. */
export const PART_FLUSH_BYTES = 256 * 1024;
/** The presigned policy's upper bound when the server names none. */
export const PART_MAX_BYTES = 1024 * 1024;
export const UPLOAD_CONCURRENCY = 2;
/**
 * Tries per part before it counts as failed. With the backoff below that is
 * about a minute and a half of waiting, which rides out a dropped connection
 * or a train tunnel without giving up on the audio.
 */
export const UPLOAD_MAX_ATTEMPTS = 8;
export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_MAX_MS = 20_000;
/** A URL this close to its expiry is not used: the upload itself takes time. */
export const URL_EXPIRY_MARGIN_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * How an upload failed, as `upload` reports it (see s3Upload.ts):
 *  - `expired`: the URL is no good any more; fetch a fresh one and try again.
 *  - `retryable`: the network or S3 had a moment; back off and try again.
 *  - `fatal`: S3 refused this part and will again; stop.
 */
export type PartUploadErrorKind = "expired" | "retryable" | "fatal";

/** The shape `upload` should throw. Anything else is read as `retryable`. */
export interface PartUploadFailure {
  kind: PartUploadErrorKind;
  /** A short machine code (S3's error code, or "network"); never a URL. */
  code: string;
}

/**
 * - `cap`: a part past `maxParts` was refused; the recording has reached its cap.
 * - `upload`: a part failed to upload (retrying, or for good).
 * - `urls`: fresh part URLs could not be had.
 * - `hash`: a part's sha256 could not be computed, so it cannot be verified.
 */
export type PartQueueErrorCode = "cap" | "upload" | "urls" | "hash";

export interface PartQueueError {
  code: PartQueueErrorCode;
  seq: number;
  /** Short and machine-ish (S3's error code, an HTTP status); for logs and support, not for display. */
  detail: string;
}

export interface PartQueueState {
  /** Parts stored. */
  sent: number;
  /** Parts cut and still waiting or uploading. "Saving your recording (n parts left)". */
  pending: number;
  /** Parts that failed for good. `retry()` puts them back. */
  failed: number;
  lastError: PartQueueError | null;
  /** A part was refused for being past `maxParts`; nothing more is cut. */
  capped: boolean;
}

export interface PartQueueResult {
  /** Every part cut and hashed, in `seq` order: what the finish call sends. */
  manifest: PartManifestEntry[];
  /** Parts cut that are not known to be stored, in `seq` order. */
  missing: number[];
}

export interface PartQueueOptions {
  /** Parts past this `seq` are refused (the create result's `maxParts`); refills may move it. */
  maxParts: number;
  /** The create result's `partMaxBytes`; a larger cut is split. Defaults to 1 MB. */
  partMaxBytes?: number;
  /** The URLs the create call handed out. */
  urls?: readonly PartUrl[];
  /** More URLs from `from` (`POST …/parts/urls`). Rejections with a 4xx `status` are final for the part that asked. */
  getUrls: (from: number) => Promise<PartUrlsResult>;
  /** Sends one part. Throws a `PartUploadFailure`-shaped error on failure; see s3Upload.ts. */
  upload: (url: PartUrl, part: Blob, signal: AbortSignal) => Promise<void>;
  /** Lowercase hex sha256 of a part. Defaults to Web Crypto. */
  hash?: (part: Blob) => Promise<string>;
  partSeconds?: number;
  flushBytes?: number;
  concurrency?: number;
  maxAttempts?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  /** Injected for tests; default Math.random. */
  random?: () => number;
  /** Injected for tests; resolves after `ms`, or rejects once `signal` aborts. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Wall-clock milliseconds, for URL expiry. Default Date.now. */
  now?: () => number;
  onState?: (state: PartQueueState) => void;
}

export interface PartQueue {
  /**
   * Adds one recorder chunk. `atMs` is when it was handed over, on the session
   * clock, which is also the end of the audio it holds. Ignored after `finish`
   * or once capped.
   */
  push(chunk: Blob, atMs: number): void;
  /** Cuts whatever is buffered into a part now, e.g. before the tab goes to the background. */
  flush(): void;
  /**
   * No more chunks: cuts the rest and resolves once every part is stored or
   * has failed for good. Await the recorder's `stop()` first, so its last
   * chunk is in. May be called again after `retry`.
   */
  finish(): Promise<PartQueueResult>;
  /**
   * Queues parts again, keeping their `seq` and sha256: by default every
   * failed part, or the given ones (the finish call's `missingParts`, which
   * may include parts this queue believes it sent).
   */
  retry(seqs?: readonly number[]): void;
  /** The manifest as it stands, for a `sendBeacon` finish that cannot wait. */
  manifest(): PartManifestEntry[];
  getState(): PartQueueState;
  /** For useSyncExternalStore: `getState` returns a new object only when something changed. */
  subscribe(listener: () => void): () => void;
  /**
   * Asks for URLs ahead of need. The parts/urls call is also the session's
   * heartbeat, so the capture hook calls this every few minutes even when the
   * queue holds enough. Never throws.
   */
  heartbeat(): Promise<void>;
  /** Stops everything; uploads in flight are cancelled and nothing more is sent. */
  abort(): void;
  /** The `seq` the next part will get. */
  readonly nextSeq: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lowercase hex sha256 of a Blob, with Web Crypto (browsers on https, and Node). */
export async function sha256Hex(part: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is not available");
  const digest = await subtle.digest("SHA-256", await part.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The wait before try `attempt + 1`, after `attempt` failures: exponential,
 * capped, with the upper half jittered, so two parts that failed together (the
 * usual case: the connection went) do not come back in lockstep, and no wait
 * shrinks to nothing.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random, baseMs = BACKOFF_BASE_MS, maxMs = BACKOFF_MAX_MS): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const r = Math.min(1, Math.max(0, random()));
  return Math.round(exp / 2 + (exp / 2) * r);
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function abortError(): Error {
  const error = new Error("The upload was stopped.");
  error.name = "AbortError";
  return error;
}

const KINDS: ReadonlySet<string> = new Set<PartUploadErrorKind>(["expired", "retryable", "fatal"]);

function failureOf(error: unknown): PartUploadFailure {
  if (typeof error === "object" && error !== null) {
    const { kind, code } = error as { kind?: unknown; code?: unknown };
    if (typeof kind === "string" && KINDS.has(kind)) {
      return { kind: kind as PartUploadErrorKind, code: typeof code === "string" && code ? code : kind };
    }
  }
  return { kind: "retryable", code: "unknown" };
}

/** A 4xx from the parts/urls call, other than a timeout or a rate limit, will not change on a retry. */
function isFinalStatus(error: unknown): number | null {
  const status = typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined;
  if (typeof status !== "number") return null;
  return status >= 400 && status < 500 && status !== 408 && status !== 429 ? status : null;
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

type PartStatus = "queued" | "uploading" | "sent" | "failed";

interface Part {
  seq: number;
  blob: Blob;
  bytes: number;
  sha256: string | null;
  hashing: Promise<void>;
  status: PartStatus;
  attempts: number;
}

interface HeldUrl {
  url: PartUrl;
  /** Local wall-clock time after which it is not used. Infinity when the server's clock and ours disagree too much to judge. */
  staleAt: number;
}

export function createPartQueue(options: PartQueueOptions): PartQueue {
  const partMs = (options.partSeconds ?? PART_SECONDS) * 1000;
  const flushBytes = options.flushBytes ?? PART_FLUSH_BYTES;
  const partMaxBytes = Math.max(1, options.partMaxBytes || PART_MAX_BYTES);
  const concurrency = Math.max(1, options.concurrency ?? UPLOAD_CONCURRENCY);
  const maxAttempts = Math.max(1, options.maxAttempts ?? UPLOAD_MAX_ATTEMPTS);
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const hash = options.hash ?? sha256Hex;
  const controller = new AbortController();

  let maxParts = options.maxParts;
  const parts = new Map<number, Part>();
  /** Seqs waiting for a slot, ascending. */
  const queue: number[] = [];
  const urls = new Map<number, HeldUrl>();
  let refill: Promise<void> | null = null;
  let inFlight = 0;

  let buffer: Blob[] = [];
  let bufferBytes = 0;
  let partStartMs = 0;
  let lastAtMs = 0;
  let nextSeq = 0;
  let closed = false;
  let capped = false;
  let lastError: PartQueueError | null = null;

  const listeners = new Set<() => void>();
  let snapshot: PartQueueState = { sent: 0, pending: 0, failed: 0, lastError: null, capped: false };
  let idleWaiters: Array<() => void> = [];

  function emit() {
    let sent = 0;
    let pending = 0;
    let failed = 0;
    for (const part of parts.values()) {
      if (part.status === "sent") sent++;
      else if (part.status === "failed") failed++;
      else pending++;
    }
    const s = snapshot;
    if (s.sent === sent && s.pending === pending && s.failed === failed && s.lastError === lastError && s.capped === capped) return;
    snapshot = { sent, pending, failed, lastError, capped };
    // A throwing subscriber must not unwind the upload loop that reported to it.
    const notify = (listener: () => void) => {
      try {
        listener();
      } catch {
        // The subscriber's own problem; the queue carries on.
      }
    };
    const state = snapshot;
    if (options.onState) notify(() => options.onState?.(state));
    listeners.forEach(notify);
  }

  function hold(list: readonly PartUrl[]) {
    const at = now();
    for (const url of list) {
      if (!url || !Number.isInteger(url.seq)) continue;
      const lifetime = Date.parse(url.expiresAt) - at;
      // A lifetime that is already under the margin at receipt says our clock
      // is off from the server's, not that the URL is useless; S3's own
      // expiry error is the judge then.
      const staleAt = Number.isFinite(lifetime) && lifetime > URL_EXPIRY_MARGIN_MS * 2 ? at + lifetime - URL_EXPIRY_MARGIN_MS : Number.POSITIVE_INFINITY;
      urls.set(url.seq, { url, staleAt });
    }
  }
  hold(options.urls ?? []);

  function freshUrl(seq: number): PartUrl | null {
    const held = urls.get(seq);
    if (!held) return null;
    if (now() >= held.staleAt) {
      urls.delete(seq);
      return null;
    }
    return held.url;
  }

  function refuse(seq: number) {
    capped = true;
    lastError = { code: "cap", seq, detail: `part ${seq} is past the recording cap (${maxParts})` };
  }

  async function refillFrom(from: number): Promise<void> {
    const res = await options.getUrls(from);
    if (typeof res?.maxParts === "number" && Number.isFinite(res.maxParts)) maxParts = res.maxParts;
    hold(Array.isArray(res?.partUrls) ? res.partUrls : []);
  }

  /** A usable URL for `seq`, refilling when needed; null when `seq` is past the cap. Throws when none can be had. */
  async function urlFor(seq: number): Promise<PartUrl | null> {
    const held = freshUrl(seq);
    if (held) return held;
    // One refill at a time. The one in flight may already cover this part.
    while (refill) {
      await refill.catch(() => {});
      const covered = freshUrl(seq);
      if (covered) return covered;
    }
    if (seq > maxParts) return null;
    refill = refillFrom(seq).finally(() => {
      refill = null;
    });
    await refill;
    // Used even when it looks stale: that only means our clock disagrees with
    // the server's, and S3 will say if it really has expired.
    const got = urls.get(seq)?.url ?? null;
    if (got) return got;
    if (seq > maxParts) return null;
    throw Object.assign(new Error("no URL for this part"), { status: undefined });
  }

  function settleIdle() {
    if (inFlight > 0 || queue.length > 0) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  function pump() {
    while (!controller.signal.aborted && inFlight < concurrency && queue.length > 0) {
      const seq = queue.shift() as number;
      const part = parts.get(seq);
      if (!part || part.status !== "queued") continue;
      inFlight++;
      part.status = "uploading";
      void send(part).finally(() => {
        inFlight--;
        emit();
        pump();
      });
    }
    emit();
    settleIdle();
  }

  async function send(part: Part): Promise<void> {
    const signal = controller.signal;
    let lastKind: PartUploadErrorKind | null = null;
    while (!signal.aborted) {
      part.attempts++;
      let url: PartUrl | null;
      try {
        url = await urlFor(part.seq);
      } catch (error) {
        const status = isFinalStatus(error);
        lastError = { code: "urls", seq: part.seq, detail: status === null ? "unavailable" : `HTTP ${status}` };
        if (status !== null || part.attempts >= maxAttempts) {
          part.status = "failed";
          return;
        }
        emit();
        if (!(await pause(part.attempts))) break;
        continue;
      }
      if (!url) {
        refuse(part.seq);
        part.status = "failed";
        return;
      }

      try {
        await options.upload(url, part.blob, signal);
        part.status = "sent";
        return;
      } catch (error) {
        if (signal.aborted) break;
        const failure = failureOf(error);
        lastError = { code: "upload", seq: part.seq, detail: failure.code };
        if (failure.kind === "expired") urls.delete(part.seq);
        if (failure.kind === "fatal" || part.attempts >= maxAttempts) {
          part.status = "failed";
          return;
        }
        emit();
        // A fresh URL is worth trying at once. Anything else waits, and so does
        // a second expiry in a row: fresh URLs that fail at once mean something
        // other than age is wrong, and asking again immediately would only
        // hammer the parts/urls route.
        const immediate = failure.kind === "expired" && lastKind !== "expired";
        lastKind = failure.kind;
        if (!immediate && !(await pause(part.attempts))) break;
      }
    }
    // Stopped by abort(): not stored, and nothing will retry it here.
    part.status = "failed";
  }

  async function pause(attempt: number): Promise<boolean> {
    try {
      await sleep(backoffDelay(attempt, random, options.backoffBaseMs ?? BACKOFF_BASE_MS, options.backoffMaxMs ?? BACKOFF_MAX_MS), controller.signal);
      return !controller.signal.aborted;
    } catch {
      return false;
    }
  }

  function addPart(blob: Blob) {
    const seq = nextSeq;
    if (seq > maxParts) {
      refuse(seq);
      return;
    }
    nextSeq++;
    const part: Part = { seq, blob, bytes: blob.size, sha256: null, hashing: Promise.resolve(), status: "queued", attempts: 0 };
    startHash(part);
    parts.set(seq, part);
    queue.push(seq);
  }

  /** Hashes once per part; a part keeps its digest for good, so a retry sends what the manifest says. */
  function startHash(part: Part) {
    if (part.sha256 !== null) return;
    part.hashing = Promise.resolve()
      .then(() => hash(part.blob))
      .then(
        (hex) => {
          part.sha256 = String(hex).toLowerCase();
        },
        () => {
          lastError = { code: "hash", seq: part.seq, detail: "sha256 unavailable" };
          emit();
        },
      );
  }

  function cut(atMs: number) {
    partStartMs = atMs;
    if (buffer.length === 0) return;
    const joined = new Blob(buffer, { type: buffer[0].type });
    buffer = [];
    bufferBytes = 0;
    // The presigned policy caps a part's size. One oversized chunk (Safari has
    // handed over a whole recording at once) is split rather than refused;
    // the server joins the pieces back byte for byte.
    for (let offset = 0; offset < joined.size && !capped; offset += partMaxBytes) {
      addPart(joined.slice(offset, Math.min(joined.size, offset + partMaxBytes), joined.type));
    }
    pump();
  }

  function waitIdle(): Promise<void> {
    if (controller.signal.aborted || (inFlight === 0 && queue.length === 0)) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.push(resolve));
  }

  function manifest(): PartManifestEntry[] {
    return [...parts.values()]
      .filter((part) => part.sha256 !== null)
      .sort((a, b) => a.seq - b.seq)
      .map((part) => ({ seq: part.seq, bytes: part.bytes, sha256: part.sha256 as string }));
  }

  return {
    push(chunk, atMs) {
      if (closed || capped || controller.signal.aborted || !chunk || chunk.size === 0) return;
      const at = Number.isFinite(atMs) ? Math.max(atMs, lastAtMs) : lastAtMs;
      buffer.push(chunk);
      bufferBytes += chunk.size;
      lastAtMs = at;
      if (at - partStartMs >= partMs || bufferBytes >= flushBytes) cut(at);
    },
    flush() {
      if (controller.signal.aborted) return;
      cut(lastAtMs);
    },
    async finish() {
      if (!closed) {
        closed = true;
        cut(lastAtMs);
      }
      await waitIdle();
      await Promise.all([...parts.values()].map((part) => part.hashing));
      const missing = [...parts.values()]
        .filter((part) => part.status !== "sent" || part.sha256 === null)
        .map((part) => part.seq)
        .sort((a, b) => a - b);
      return { manifest: manifest(), missing };
    },
    retry(seqs) {
      if (controller.signal.aborted) return;
      const wanted = seqs ?? [...parts.values()].filter((part) => part.status === "failed").map((part) => part.seq);
      for (const seq of wanted) {
        const part = parts.get(seq);
        if (!part || part.status === "queued" || part.status === "uploading") continue;
        part.status = "queued";
        part.attempts = 0;
        // Only a part whose digest could not be computed is hashed again.
        startHash(part);
        // Kept ascending, so a retried part goes ahead of later ones.
        const at = queue.findIndex((queued) => queued > seq);
        if (at === -1) queue.push(seq);
        else queue.splice(at, 0, seq);
      }
      pump();
    },
    manifest,
    getState: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async heartbeat() {
      if (controller.signal.aborted) return;
      let from = nextSeq;
      while (from <= maxParts && freshUrl(from)) from++;
      try {
        await refillFrom(Math.min(from, Math.max(0, maxParts)));
      } catch {
        // The next part's own refill will say whether this matters.
      }
    },
    abort() {
      if (controller.signal.aborted) return;
      controller.abort();
      queue.length = 0;
      for (const part of parts.values()) if (part.status === "queued") part.status = "failed";
      buffer = [];
      bufferBytes = 0;
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((resolve) => resolve());
      emit();
    },
    get nextSeq() {
      return nextSeq;
    },
  };
}
