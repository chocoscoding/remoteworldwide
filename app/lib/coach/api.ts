// Browser-side calls for the career coach: sessions, one streamed turn, and the
// coach's plan proposals.
//
// Every route lives in the AI service and goes through the session proxy at
// `app/api/ai/[...path]/route.ts`, never a rewrite: the proxy sets `x-user-id`
// from the verified session and adds the service token, so the browser never
// says who it is and never holds a secret. Paths are relative for the same
// reason as in `app/lib/api/client.ts`: the session cookie rides along
// first-party.
//
// A turn is not an ordinary JSON call. The reply streams back as server-sent
// events on the POST's own response, and EventSource can only GET, so
// `streamCoachMessage` reads the body itself. Refusals made before anything is
// generated (400, 402, 404, 429, 503) are plain JSON responses, not events, and
// reject like any other failed call.

import { apiGet, apiPost } from "@/app/lib/api/client";
import { BackendError, apiMessage, revive } from "@/app/lib/api/core";
import type {
  AcceptProposalInput,
  AcceptProposalResult,
  CoachErrorCode,
  CoachMessageCard,
  CoachMessageItem,
  CoachProposalItem,
  CoachSessionDetail,
  CoachSessionItem,
  CoachSessionList,
  CoachStreamEvent,
  CoachUsage,
  CreateCoachSessionResult,
  DismissProposalResult,
  SendCoachMessageInput,
} from "./types";

export const COACH_PATH = "/api/ai/coach";
const SESSIONS_PATH = `${COACH_PATH}/sessions`;
const PROPOSALS_PATH = `${COACH_PATH}/proposals`;

/** Where a 402 sends someone to top up. */
export const COACH_BILLING_HREF = "/dashboard/settings/billing";

// Ids go into the path, so they are encoded, as in `app/lib/jobs/api.ts`.
const at = (base: string, id: string) => `${base}/${encodeURIComponent(id)}`;

/** This user's conversations, newest first, with today's free-reply allowance. */
export function listCoachSessions(signal?: AbortSignal) {
  return apiGet<CoachSessionList>(SESSIONS_PATH, signal);
}

/** One conversation and its newest messages, oldest first. Another user's id is a 404. */
export function getCoachSession(id: string, signal?: AbortSignal) {
  return apiGet<CoachSessionDetail>(at(SESSIONS_PATH, id), signal);
}

/**
 * A new, untitled conversation. Called only when a new chat's first message is
 * sent, never by "+", so a chat nobody writes in costs no row and no request.
 */
export function createCoachSession() {
  return apiPost<CreateCoachSessionResult>(SESSIONS_PATH);
}

/**
 * Add the chosen tasks to the plan. The service keys each task on
 * `coach:{proposalId}:{index}`, so accepting twice adds each task once. A plan
 * past its open-task cap comes back as rejections inside a 2xx, not as a throw.
 */
export function acceptCoachProposal(id: string, input: AcceptProposalInput) {
  return apiPost<AcceptProposalResult>(`${at(PROPOSALS_PATH, id)}/accept`, input);
}

/**
 * "Not now". Resolves with the dismissed proposal, or null when a 2xx carried
 * none that can be read. Dismissing an accepted proposal is a 409.
 */
export async function dismissCoachProposal(id: string): Promise<DismissProposalResult | null> {
  const data = await apiPost<DismissProposalResult | null>(`${at(PROPOSALS_PATH, id)}/dismiss`);
  return isProposal(data) ? data : null;
}

// ---------------------------------------------------------------------------
// Server-sent events
// ---------------------------------------------------------------------------

export interface SseFrame {
  /** "message" when the frame named none, as the spec says. */
  event: string;
  data: string;
}

export interface SseParser {
  /** Decoded text, in pieces of any size: a frame, a line or a CRLF may be split across calls. */
  push: (text: string) => void;
  /** The stream ended. An event with no blank line after it is dropped, as the spec says. */
  end: () => void;
}

/**
 * An incremental `text/event-stream` parser, per the WHATWG HTML event-stream
 * rules: lines end in CRLF, LF or CR; a blank line dispatches the event; `data`
 * lines join with "\n"; a line starting with ":" is a comment; one space after
 * the colon is dropped. Nothing is assumed about where the network cuts the
 * body, which is the whole reason this is not a split on "\n\n".
 */
export function createSseParser(onFrame: (frame: SseFrame) => void): SseParser {
  let pending = "";
  let event = "";
  let data: string[] = [];
  // The last piece ended on a CR. If the next begins with LF, that LF is the
  // same line ending, not an empty line that would dispatch an event early.
  let afterCR = false;

  const dispatch = () => {
    const frame = data.length > 0 ? { event: event || "message", data: data.join("\n") } : null;
    event = "";
    data = [];
    if (frame) onFrame(frame);
  };

  const readLine = (line: string) => {
    if (line === "") return dispatch();
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    // `id` and `retry` mean nothing to one POST's response, and unknown fields are ignored.
  };

  return {
    push(text) {
      let chunk = text;
      if (afterCR && chunk.startsWith("\n")) chunk = chunk.slice(1);
      afterCR = false;
      const buffer = pending + chunk;
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i];
        if (ch !== "\n" && ch !== "\r") continue;
        const line = buffer.slice(start, i);
        if (ch === "\r") {
          if (i + 1 === buffer.length) afterCR = true;
          else if (buffer[i + 1] === "\n") i++;
        }
        start = i + 1;
        // Last, because dispatching can throw (a frame this client cannot read),
        // and the cursor above must already be past the line when it does.
        readLine(line);
      }
      pending = buffer.slice(start);
    },
    end() {
      pending = "";
      event = "";
      data = [];
      afterCR = false;
    },
  };
}

// ---------------------------------------------------------------------------
// One turn
// ---------------------------------------------------------------------------

/** What `done` carries: the stored reply, today's allowance, and whether this reply spent a credit. */
export type CoachTurnDone = Extract<CoachStreamEvent, { event: "done" }>["data"];

/** Every event a caller is handed. `error` is thrown as a CoachStreamError instead. */
export type CoachTurnEvent = Exclude<CoachStreamEvent, { event: "error" }>;

/** A refusal before anything was generated: an ordinary non-2xx JSON response. Keeps `retryAfterMs`, which BackendError drops. */
export class CoachRequestError extends BackendError {
  constructor(
    status: number,
    message: string,
    public readonly retryAfterMs: number | null,
  ) {
    super(status, message);
    this.name = "CoachRequestError";
  }
}

/** A turn that failed after the stream began: an `error` event, a frame that could not be read, or a stream that ended without `done`. */
export class CoachStreamError extends Error {
  constructor(
    public readonly code: CoachErrorCode | "dropped",
    message: string,
    public readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = "CoachStreamError";
  }
}

const DROPPED_MESSAGE = "The reply was cut off before it finished. Try again.";
const UNREADABLE_MESSAGE = "The coach's reply couldn't be read. Try again.";
const FAILED_MESSAGE = "The coach couldn't finish that reply. Try again.";

// Mirrors COACH_ERROR_CODES in remoteworldwideai/src/types/coach.ts.
const ERROR_CODES: ReadonlySet<string> = new Set<CoachErrorCode>(["insufficient-credits", "limited", "unavailable", "failed", "too-long"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isMessage = (value: unknown): value is CoachMessageItem =>
  isRecord(value) && typeof value.id === "string" && typeof value.text === "string" && (value.from === "coach" || value.from === "user");

const isSession = (value: unknown): value is CoachSessionItem =>
  isRecord(value) && typeof value.id === "string" && (value.title === null || typeof value.title === "string");

const isCard = (value: unknown): value is CoachMessageCard =>
  isRecord(value) && typeof value.title === "string" && typeof value.cta === "string" && typeof value.href === "string";

function isProposal(value: unknown): value is CoachProposalItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.status === "string" &&
    Array.isArray(value.tasks) &&
    Array.isArray(value.acceptedTaskIds)
  );
}

const isUsage = (value: unknown): value is CoachUsage =>
  isRecord(value) && typeof value.freeRepliesLeft === "number" && typeof value.creditsPerReply === "number" && typeof value.day === "string";

function retryAfterFrom(value: unknown): number | null {
  if (!isRecord(value)) return null;
  const ms = value.retryAfterMs;
  return typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? ms : null;
}

const KNOWN_EVENTS: ReadonlySet<string> = new Set<CoachStreamEvent["event"]>(["accepted", "delta", "card", "proposal", "done", "error"]);

/**
 * A frame as one of the turn's events, with dates revived as every other read
 * revives them. Null for an event name this client does not know, which a newer
 * service is free to add. A known event whose data does not have its shape
 * throws: skipping a `delta` would silently lose words from the reply.
 */
export function toCoachStreamEvent(frame: SseFrame): CoachStreamEvent | null {
  if (!KNOWN_EVENTS.has(frame.event)) return null;
  let data: unknown;
  try {
    data = revive(JSON.parse(frame.data));
  } catch {
    throw new CoachStreamError("failed", UNREADABLE_MESSAGE, null);
  }

  switch (frame.event) {
    case "accepted":
      if (isRecord(data) && isMessage(data.userMessage) && isSession(data.session)) {
        return { event: "accepted", data: { userMessage: data.userMessage, session: data.session } };
      }
      break;
    case "delta":
      if (isRecord(data) && typeof data.text === "string") return { event: "delta", data: { text: data.text } };
      break;
    case "card":
      if (isCard(data)) return { event: "card", data };
      break;
    case "proposal":
      if (isProposal(data)) return { event: "proposal", data };
      break;
    case "done":
      if (isRecord(data) && isMessage(data.message) && isUsage(data.usage)) {
        return {
          event: "done",
          data: {
            message: data.message,
            usage: data.usage,
            charged: data.charged === true,
            balance: typeof data.balance === "number" && Number.isFinite(data.balance) ? data.balance : null,
          },
        };
      }
      break;
    case "error":
      if (isRecord(data)) {
        return {
          event: "error",
          data: {
            code: typeof data.code === "string" && ERROR_CODES.has(data.code) ? (data.code as CoachErrorCode) : "failed",
            message: typeof data.message === "string" && data.message.trim() ? data.message : FAILED_MESSAGE,
            retryAfterMs: retryAfterFrom(data),
          },
        };
      }
      break;
  }
  throw new CoachStreamError("failed", UNREADABLE_MESSAGE, null);
}

async function refusalFrom(res: Response): Promise<CoachRequestError> {
  const json = (await res.json().catch(() => null)) as { message?: unknown; data?: unknown } | null;
  // An empty message falls through to apiMessage's wording for the status.
  const message = typeof json?.message === "string" ? json.message : res.statusText;
  // Only the body can say when to retry: the proxy passes no response headers on.
  return new CoachRequestError(res.status, message, retryAfterFrom(json?.data));
}

export interface StreamCoachMessageOptions {
  /** Aborting stops reading and releases the connection. The AI service then never stores or charges the unfinished reply. */
  signal?: AbortSignal;
  /** `accepted`, the `delta`s, any `card` and `proposal`, then `done`, in order. */
  onEvent: (event: CoachTurnEvent) => void;
}

/**
 * Send one message and follow its reply. Resolves with `done`'s data once the
 * reply is stored. Rejects with a CoachRequestError for a refusal before
 * anything was generated, a CoachStreamError for an `error` event or a stream
 * that ended without `done`, a TypeError when the request never left, or an
 * AbortError once `signal` aborts.
 *
 * Send the same `clientMessageId` to retry. The service replays a stored reply
 * for it (as `accepted` then `done`, with no deltas) rather than generating, or
 * charging for, a second one.
 */
export async function streamCoachMessage(
  sessionId: string,
  input: SendCoachMessageInput,
  { signal, onEvent }: StreamCoachMessageOptions,
): Promise<CoachTurnDone> {
  const res = await fetch(`${at(SESSIONS_PATH, sessionId)}/messages`, {
    method: "POST",
    headers: { accept: "text/event-stream", "content-type": "application/json" },
    body: JSON.stringify(input),
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw await refusalFrom(res);

  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!res.body || type !== "text/event-stream") {
    await res.body?.cancel().catch(() => {});
    throw new CoachStreamError("failed", UNREADABLE_MESSAGE, null);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const outcome: { done: CoachTurnDone | null } = { done: null };
  const parser = createSseParser((frame) => {
    // Nothing after `done` belongs to this turn.
    if (outcome.done) return;
    const event = toCoachStreamEvent(frame);
    if (!event) return;
    if (event.event === "error") throw new CoachStreamError(event.data.code, event.data.message, event.data.retryAfterMs);
    onEvent(event);
    if (event.event === "done") outcome.done = event.data;
  });

  let ended = false;
  try {
    while (!outcome.done) {
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
    // Stopping early (after `done`, on an `error`, or on a frame that could not
    // be read) cancels the body, so the connection is not left open behind us.
    if (!ended) void reader.cancel().catch(() => {});
  }

  const done = outcome.done;
  if (!done) throw new CoachStreamError("dropped", DROPPED_MESSAGE, null);
  return done;
}

// ---------------------------------------------------------------------------
// Failures: what the transcript shows in place of a reply
// ---------------------------------------------------------------------------

export type CoachFailureKind =
  /** Past today's free replies with too few credits. Nothing was generated or stored. */
  | "credits"
  /** Too many replies this hour. `retryAt` says when, if the service did. */
  | "limited"
  | "failed";

export interface CoachFailure {
  kind: CoachFailureKind;
  message: string;
  /** False when sending the same message again cannot work, so no Retry is offered. */
  retryable: boolean;
  /** When a retry should work (epoch ms), if the service said. */
  retryAt: number | null;
}

// A retry cannot fix what the request itself got wrong: a message the validator
// refuses, a signed-out session, a conversation that no longer exists.
const FINAL_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 404, 413, 422]);

/** `now` is passed in so the one clock read happens where the failure is caught, not during a render. */
export function describeCoachFailure(error: unknown, now: number): CoachFailure {
  const after = (ms: number | null) => (ms === null ? null : now + ms);

  if (error instanceof CoachStreamError) {
    switch (error.code) {
      case "insufficient-credits":
        return { kind: "credits", message: error.message, retryable: true, retryAt: null };
      case "limited":
        return { kind: "limited", message: error.message, retryable: true, retryAt: after(error.retryAfterMs) };
      case "too-long":
        return { kind: "failed", message: error.message, retryable: false, retryAt: null };
      default:
        return { kind: "failed", message: error.message, retryable: true, retryAt: after(error.retryAfterMs) };
    }
  }

  if (error instanceof BackendError) {
    const message = apiMessage(error);
    const wait = error instanceof CoachRequestError ? error.retryAfterMs : null;
    // Retryable: people top up in another tab and come back to the same message.
    if (error.status === 402) return { kind: "credits", message, retryable: true, retryAt: null };
    if (error.status === 429) return { kind: "limited", message, retryable: true, retryAt: after(wait) };
    return { kind: "failed", message, retryable: !FINAL_STATUSES.has(error.status), retryAt: after(wait) };
  }

  // Aborted: nothing arrived for too long (see useSendCoachMessage).
  if (error instanceof Error && error.name === "AbortError") return { kind: "failed", message: DROPPED_MESSAGE, retryable: true, retryAt: null };
  return { kind: "failed", message: apiMessage(error), retryable: true, retryAt: null };
}

// ---------------------------------------------------------------------------
// Reading what the service sent
// ---------------------------------------------------------------------------

// COACH_CARD_ROUTES in the AI service is the real allowlist, and the service
// refuses any other href. This is the second lock rather than the first: a card
// renders as a Next <Link>, and a `//host` or `javascript:` href there would be
// a navigation the user never chose.
const CARD_HREF_PATTERN = /^\/dashboard(\/[a-z0-9-]+)*$/;

/** The card's link when it is a dashboard path, and null otherwise, in which case the card is not shown. */
export function coachCardHref(card: Pick<CoachMessageCard, "href">): string | null {
  return CARD_HREF_PATTERN.test(card.href) ? card.href : null;
}

/**
 * The newer of two readings of today's allowance. The sessions list and an open
 * session each carry one, and whichever was fetched or written last is right: a
 * later UTC day, or more replies used on the same day.
 */
export function fresherUsage(a: CoachUsage | undefined, b: CoachUsage | undefined): CoachUsage | undefined {
  if (!a || !b) return a ?? b;
  if (a.day !== b.day) return a.day > b.day ? a : b;
  return a.freeRepliesUsed >= b.freeRepliesUsed ? a : b;
}

/**
 * What a screen reader hears when a reply has finished: that it arrived, what
 * it cost if it cost anything, and the allowance now. The reply itself is in
 * the transcript.
 */
export function describeReplyDone({ charged, usage }: { charged: boolean; usage: CoachUsage | null }): string {
  if (charged) {
    const credits = usage?.creditsPerReply ?? 1;
    return `Coach replied. ${credits} ${credits === 1 ? "credit" : "credits"} used.`;
  }
  // Uncharged: the free replies left, or, once they are gone, what the next reply costs.
  const left = describeUsage(usage ?? undefined);
  return left ? `Coach replied. ${left.charAt(0).toUpperCase()}${left.slice(1)}.` : "Coach replied.";
}

/** "12 free replies left today", then "1 credit per reply" once they are used. */
export function describeUsage(usage: CoachUsage | undefined): string {
  if (!usage) return "";
  const left = usage.freeRepliesLeft;
  if (left > 0) return `${left} free ${left === 1 ? "reply" : "replies"} left today`;
  const credits = usage.creditsPerReply;
  return credits > 0 ? `${credits} ${credits === 1 ? "credit" : "credits"} per reply` : "";
}
