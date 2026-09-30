"use client";

// One coach turn: create the session if this is a new chat, send the message,
// and follow the streamed reply into the screen and the cache.
//
// Not a TanStack mutation, deliberately. A mutation's state lives with the
// observer that ran it, and TanStack runs per-call callbacks only for the latest
// `mutate`. A turn has to outlive both: it keeps writing into its own session
// while the user reads another one, starts a new chat, or leaves the screen and
// comes back. So turns live in one module-level store for the page, the same
// lifetime as the QueryClient singleton, and the screen reads it through
// useSyncExternalStore. Only the browser ever writes to it; the server snapshot
// is always empty.
//
// What a turn writes to the cache, and when:
//   - a new chat's session goes into the sessions list the moment it exists,
//     untitled, and its message list is seeded empty, so opening it asks nothing;
//   - `accepted` brings the title the first message gives the session, and
//     moves it to the top of the list;
//   - `done` appends the stored user message and reply to the session, updates
//     today's allowance, and updates the billing overview when a credit went.
// The screen shows a turn until its reply is among the session's cached
// messages, so the handover from the stream to the cache never flashes.
//
// Retrying sends the SAME clientMessageId. The AI service keys the reply and its
// charge on it, so a retry after a dropped stream replays the stored reply, or
// generates the one that never finished, and never charges twice.

import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { BackendError } from "@/app/lib/api/core";
import {
  CoachStreamError,
  createCoachSession,
  describeCoachFailure,
  streamCoachMessage,
  type CoachFailure,
  type CoachTurnDone,
} from "@/app/lib/coach/api";
import type {
  CoachMessageCard,
  CoachMessageItem,
  CoachProposalItem,
  CoachSessionDetail,
  CoachSessionItem,
  CoachSessionList,
  CoachUsage,
  CreateCoachSessionResult,
} from "@/app/lib/coach/types";
import type { BillingOverview } from "@/app/lib/settings/types";
import { qk } from "@/app/lib/query/keys";

export type CoachTurnStatus = "creating" | "sending" | "streaming" | "done" | "failed";

export interface CoachTurn {
  /** Stable for the turn's life, for React keys. */
  key: string;
  /** Set on a new chat's first message: what the screen shows until its session exists. */
  draftKey: string | null;
  /** Null until a new chat's session has been created. */
  sessionId: string | null;
  clientMessageId: string;
  text: string;
  status: CoachTurnStatus;
  /** The message as stored, once the service has `accepted` it. */
  userMessage: CoachMessageItem | null;
  /** The reply so far, from `delta`s. */
  reply: string;
  card: CoachMessageCard | null;
  proposal: CoachProposalItem | null;
  /** The stored reply, from `done`. It outranks `reply`, `card` and `proposal`: a replayed reply arrives with no deltas. */
  final: CoachMessageItem | null;
  /** From `done`: whether the reply spent credits, and today's allowance after it. */
  charged: boolean;
  usage: CoachUsage | null;
  failure: CoachFailure | null;
}

export const isTurnInFlight = (turn: Pick<CoachTurn, "status">) =>
  turn.status === "creating" || turn.status === "sending" || turn.status === "streaming";

const DRAFT_PREFIX = "draft-";

/** Whether a screen's key names a new chat's draft rather than a session id. */
export const isDraftKey = (key: string) => key.startsWith(DRAFT_PREFIX);

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

const NO_TURNS: readonly CoachTurn[] = [];
let turns: readonly CoachTurn[] = NO_TURNS;
const listeners = new Set<() => void>();
let notifyQueued = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => turns;
const getServerSnapshot = () => NO_TURNS;

// Several frames often arrive in one network read. One notification per
// microtask turns that burst into one render rather than one per delta.
function notify() {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    listeners.forEach((listener) => listener());
  });
}

const findTurn = (key: string) => turns.find((turn) => turn.key === key);

/** A new array only when a turn really changed, so the snapshot stays stable between writes. */
function patchTurn(key: string, patch: Partial<CoachTurn> | ((turn: CoachTurn) => Partial<CoachTurn>)) {
  const index = turns.findIndex((turn) => turn.key === key);
  if (index === -1) return;
  const turn = turns[index];
  const next = turns.slice();
  next[index] = { ...turn, ...(typeof patch === "function" ? patch(turn) : patch) };
  turns = next;
  notify();
}

/**
 * A v4 UUID. randomUUID exists only in secure contexts, and a dev server
 * reached over a LAN address is not one; getRandomValues works in both.
 */
function newClientMessageId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// The cache
// ---------------------------------------------------------------------------

/** `session` at the top of the list, in place of its old row: the list is most recent conversation first. */
function storeSession(queryClient: QueryClient, session: CoachSessionItem, usage?: CoachUsage) {
  queryClient.setQueryData<CoachSessionList>(qk.coach.sessions(), (list) =>
    list ? { sessions: [session, ...list.sessions.filter((other) => other.id !== session.id)], usage: usage ?? list.usage } : list,
  );
  queryClient.setQueryData<CoachSessionDetail>(qk.coach.session(session.id), (detail) => (detail ? { ...detail, session } : detail));
}

function storeCreated(queryClient: QueryClient, { session, usage }: CreateCoachSessionResult) {
  if (queryClient.getQueryData(qk.coach.sessions())) storeSession(queryClient, session, usage);
  // Still loading, or it failed: whatever comes back may not hold the new session, so it is asked for again.
  else void queryClient.invalidateQueries({ queryKey: qk.coach.sessions() });
  // A new session has no messages. Saying so means the screen asks for nothing,
  // and no read can land mid-turn holding half of it.
  if (!queryClient.getQueryData(qk.coach.session(session.id))) {
    queryClient.setQueryData<CoachSessionDetail>(qk.coach.session(session.id), { session, messages: [], usage });
  }
}

/**
 * The sidebar's credit meter reads the billing overview. A reported balance goes
 * in at once so the meter moves with the reply; the overview is refetched
 * either way, because its ledger changed too.
 */
function storeBalance(queryClient: QueryClient, credits: number | null) {
  if (credits !== null) {
    queryClient.setQueryData<BillingOverview>(qk.billing.overview(), (overview) =>
      overview ? { ...overview, subscription: { ...overview.subscription, creditBalance: credits } } : overview,
    );
  }
  void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
}

/**
 * Append every finished turn of this session the cached messages do not hold
 * yet, oldest turn first. Not just the one that finished: a read that started
 * before an earlier reply was stored can have replaced the list without it, and
 * that earlier turn belongs above this one.
 *
 * A session nobody has cached is left alone; its turns stay on screen until a
 * read brings the stored messages in.
 */
function storeReply(queryClient: QueryClient, sessionId: string, done: CoachTurnDone) {
  const finished = turns.filter((turn) => turn.sessionId === sessionId && turn.final !== null);
  queryClient.setQueryData<CoachSessionDetail>(qk.coach.session(sessionId), (detail) => {
    if (!detail) return detail;
    const held = new Set(detail.messages.map((message) => message.id));
    const added: CoachMessageItem[] = [];
    for (const turn of finished) {
      for (const message of [turn.userMessage, turn.final]) {
        if (message && !held.has(message.id)) {
          held.add(message.id);
          added.push(message);
        }
      }
    }
    return { ...detail, messages: added.length > 0 ? [...detail.messages, ...added] : detail.messages, usage: done.usage };
  });
  queryClient.setQueryData<CoachSessionList>(qk.coach.sessions(), (list) => (list ? { ...list, usage: done.usage } : list));
  if (done.charged) storeBalance(queryClient, done.balance);
}

// ---------------------------------------------------------------------------
// Running a turn
// ---------------------------------------------------------------------------

/**
 * With nothing arriving for this long, the turn is given up as dropped, so a
 * stalled connection offers Retry instead of typing forever. Longer than the
 * proxy's own 60-second limit, which normally ends a stuck turn first, and
 * than the tool rounds that run before the first word.
 */
const STALL_MS = 75_000;

async function runTurn(queryClient: QueryClient, key: string) {
  const start = findTurn(key);
  if (!start) return;
  const controller = new AbortController();
  let stall: ReturnType<typeof setTimeout> | undefined;
  const kick = () => {
    clearTimeout(stall);
    stall = setTimeout(() => controller.abort(), STALL_MS);
  };

  try {
    let sessionId = start.sessionId;
    if (sessionId === null) {
      const created = await createCoachSession();
      sessionId = created.session.id;
      storeCreated(queryClient, created);
      patchTurn(key, { sessionId, status: "sending" });
    }

    kick();
    const done = await streamCoachMessage(
      sessionId,
      { text: start.text, clientMessageId: start.clientMessageId },
      {
        signal: controller.signal,
        onEvent: (event) => {
          kick();
          switch (event.event) {
            case "accepted":
              patchTurn(key, { userMessage: event.data.userMessage, status: "streaming" });
              storeSession(queryClient, event.data.session);
              break;
            case "delta":
              patchTurn(key, (turn) => ({ reply: turn.reply + event.data.text, status: "streaming" }));
              break;
            case "card":
              patchTurn(key, { card: event.data });
              break;
            case "proposal":
              patchTurn(key, { proposal: event.data });
              break;
            case "done":
              // Settled below, once the stream has closed.
              break;
          }
        },
      },
    );

    // The turn first, so storeReply finds it finished; both land before the next render.
    patchTurn(key, { final: done.message, charged: done.charged, usage: done.usage, status: "done" });
    storeReply(queryClient, sessionId, done);
  } catch (error) {
    // A half-written reply is never stored by the service, so it is not left on screen as though it were the coach's answer.
    patchTurn(key, { status: "failed", failure: describeCoachFailure(error, Date.now()), reply: "", card: null, proposal: null });
    const outOfCredits =
      (error instanceof BackendError && error.status === 402) || (error instanceof CoachStreamError && error.code === "insufficient-credits");
    // A refusal for credits means the balance the sidebar shows is out of date.
    if (outOfCredits) storeBalance(queryClient, null);
    // The session is gone (deleted elsewhere), so the rail should stop offering it.
    if (error instanceof BackendError && error.status === 404) void queryClient.invalidateQueries({ queryKey: qk.coach.sessions() });
  } finally {
    clearTimeout(stall);
  }
}

/**
 * Start a turn. `sessionId` null starts a new chat, whose session is created
 * first; the returned turn's `draftKey` names it until then. Null when this
 * session already has a turn in flight: a second message mid-reply would reach
 * the model without the reply it follows.
 */
function sendTurn(queryClient: QueryClient, sessionId: string | null, text: string): CoachTurn | null {
  if (sessionId !== null && turns.some((turn) => turn.sessionId === sessionId && isTurnInFlight(turn))) return null;
  const clientMessageId = newClientMessageId();
  const turn: CoachTurn = {
    key: `turn-${clientMessageId}`,
    draftKey: sessionId === null ? `draft-${clientMessageId}` : null,
    sessionId,
    clientMessageId,
    text,
    status: sessionId === null ? "creating" : "sending",
    userMessage: null,
    reply: "",
    card: null,
    proposal: null,
    final: null,
    charged: false,
    usage: null,
    failure: null,
  };
  // Earlier failures in this conversation are dropped once the user moves on: left
  // in place they would render below the newer messages. So is a new chat that
  // never got a session, which nothing can show again.
  turns = [...turns.filter((other) => !(other.status === "failed" && (other.sessionId === null || other.sessionId === sessionId))), turn];
  notify();
  void runTurn(queryClient, turn.key);
  return turn;
}

/** Try a failed turn again with the same clientMessageId. */
function retryTurn(queryClient: QueryClient, key: string) {
  const turn = findTurn(key);
  if (!turn || turn.status !== "failed" || !turn.failure?.retryable) return;
  if (turn.sessionId !== null && turns.some((other) => other.sessionId === turn.sessionId && isTurnInFlight(other))) return;
  patchTurn(key, {
    status: turn.sessionId === null ? "creating" : "sending",
    failure: null,
    reply: "",
    card: null,
    proposal: null,
    final: null,
    charged: false,
    usage: null,
  });
  void runTurn(queryClient, key);
}

export interface SendCoachMessage {
  /** Every turn started on this page, oldest first. Filter by `sessionId` or `draftKey` for one conversation. */
  turns: readonly CoachTurn[];
  send: (sessionId: string | null, text: string) => CoachTurn | null;
  retry: (turnKey: string) => void;
}

export function useSendCoachMessage(): SendCoachMessage {
  const queryClient = useQueryClient();
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const send = useCallback((sessionId: string | null, text: string) => sendTurn(queryClient, sessionId, text), [queryClient]);
  const retry = useCallback((turnKey: string) => retryTurn(queryClient, turnKey), [queryClient]);
  return { turns: current, send, retry };
}
