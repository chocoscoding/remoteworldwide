// Live captions over the voice gateway: PCM frames up, caption results down.
//
// The browser never talks to AWS. The gateway (the AI service's ROLE=gateway)
// holds the AWS credentials, checks a one-time ticket, enforces the session's
// cap and one stream per user, and relays results. This is its client.
//
// The protocol (contract: app/lib/voice/types.ts, `Stream*`):
//  - The ticket rides as the `ticket.<ticket>` subprotocol, never in the URL.
//  - The first message is `{type: "start", sampleRate: 16000, t0OffsetMs}`,
//    then binary frames. `t0OffsetMs` is the session-clock time of the first
//    frame this socket carries. AWS times results from the stream's first
//    sample and the gateway adds the offset, so captions arrive already on the
//    session clock and are passed on untouched. That is why `start` waits for
//    the first frame rather than going out when the socket opens: only then is
//    its time known.
//  - `{type: "stop"}` asks for the last finals; the gateway answers `end`.
//
// Failure is expected and cheap: captions are a convenience, the recording is
// the record. So the rules are simple:
//  - Frames sent while the socket is still opening are held, up to 5 s of
//    audio; past that the oldest go (the stream then starts later, which the
//    offset accounts for) and `dropped-audio` is reported once per socket.
//  - A socket that closes unexpectedly is replaced once, with a fresh ticket
//    from `getTicket` (tickets are single use, and the first may have expired
//    while the user answered the mic prompt, so a bad-ticket close gets this
//    retry too). The second failure reports `unavailable` as fatal: the caller
//    switches to Web Speech.
//  - A refusal that a new socket would meet again (the cap, a bad origin,
//    another stream already open, a protocol or size violation) and every
//    error the gateway names (`limited`, `unavailable`, `bad-audio`,
//    `internal`, `cap`) is fatal at once, with no reconnect.
//
// Nothing here logs; the ticket in particular goes nowhere but the handshake.

import { streamUrlFor, subprotocolsFor } from "@/app/lib/voice/gateway";
import {
  LIVE_STT_PROVIDERS,
  PCM,
  STREAM_CLOSE,
  STREAM_ERROR_CODES,
  type LiveSttProvider,
  type StreamClientMessage,
  type StreamErrorCode,
} from "@/app/lib/voice/types";

/** Audio held while a socket opens. */
export const RELAY_BUFFER_MS = 5_000;
/** How long `stop()` waits for the gateway's `end`: longer than the gateway's own 5 s wait for AWS's last finals. */
export const RELAY_STOP_TIMEOUT_MS = 6_000;
/** A socket still opening after this counts as failed. */
export const RELAY_CONNECT_TIMEOUT_MS = 10_000;
/**
 * Unsent bytes past which the uplink counts as stalled: 30 s of audio.
 * Captions that far behind are no use, and the browser would buffer without
 * limit; the socket is replaced instead (once, like any other failure).
 */
export const RELAY_MAX_BUFFERED_BYTES = PCM.bytesPerSecond * 30;

/**
 * - The gateway's own codes (`StreamErrorCode`).
 * - `busy`, `bad-ticket`, `bad-origin`, `protocol`, `too-large`: the close codes
 *   of the same names.
 * - `dropped-audio`: held frames were discarded while a socket opened (not fatal).
 */
export type RelayErrorCode = StreamErrorCode | "busy" | "bad-ticket" | "bad-origin" | "protocol" | "too-large" | "dropped-audio";

export interface RelayError {
  code: RelayErrorCode;
  /** For logs and support, not for display. */
  message: string;
  /**
   * The relay has ended. For `cap` the session has reached its recording cap;
   * for everything else, captions should continue on Web Speech.
   */
  fatal: boolean;
}

/** One caption result. Times are on the session clock. */
export interface RelayCaption {
  resultId: string;
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * - `stopped`: `stop()` finished (with or without the gateway's `end`).
 * - `failed`: a fatal error ended it; `onError` said which.
 * - `closed`: `close()` was called.
 */
export type RelayEndReason = "stopped" | "failed" | "closed";

export interface RelayEnd {
  reason: RelayEndReason;
  /** Audio the gateway says it forwarded on the last socket; null without its `end`. */
  audioSeconds: number | null;
}

/** A fresh ticket for the one reconnect: a ticket with the gateway to use, a bare ticket, or null when none can be had. */
export type RelayTicket = { gatewayUrl: string | null; streamTicket: string | null } | string | null;
export type RelayTicketSource = () => Promise<RelayTicket>;

/** The parts of WebSocket the relay uses, so tests can stand in for it. */
export interface RelaySocket {
  binaryType: string;
  readonly readyState: number;
  readonly bufferedAmount: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
}
export type RelaySocketCtor = new (url: string, protocols: string[]) => RelaySocket;

export interface RelayOptions {
  /** `LabRunCreateResult.gatewayUrl`. */
  gatewayUrl: string;
  /** The single-use ticket for the first socket. */
  ticket: string;
  /** Called at most once, for the reconnect. Without it a failed socket is final. */
  getTicket?: RelayTicketSource;
  onReady?: (provider: LiveSttProvider) => void;
  onPartial?: (caption: RelayCaption) => void;
  onFinal?: (caption: RelayCaption) => void;
  onError?: (error: RelayError) => void;
  /** Once, however the relay ended. */
  onEnd?: (end: RelayEnd) => void;
  /**
   * The first socket failed and a second is being opened. Results still
   * partial on the first socket will never be finalised; treat them as final.
   */
  onReconnect?: () => void;
  maxBufferMs?: number;
  stopTimeoutMs?: number;
  connectTimeoutMs?: number;
  /** For tests; defaults to the browser's WebSocket. */
  WebSocketImpl?: RelaySocketCtor;
}

/**
 * - `connecting` / `reconnecting`: a socket is opening (or a ticket is being fetched); frames are held.
 * - `open`: frames go straight out.
 * - `stopping`: `stop` was sent; waiting for `end`.
 * - `ended`: over for good.
 */
export type RelayState = "connecting" | "open" | "reconnecting" | "stopping" | "ended";

export interface Relay {
  readonly state: RelayState;
  /** One PCM frame; `atMs` is its first sample on the session clock. Ignored once stopping or ended. */
  send(frame: ArrayBuffer, atMs: number): void;
  /** Asks for the last finals and resolves when they are in, the gateway went quiet, or there was no stream to stop. */
  stop(): Promise<RelayEnd>;
  /** Ends at once, without waiting for finals. */
  close(): void;
}

// WebSocket.readyState, spelled out so a stand-in class needs no statics.
const CONNECTING = 0;
const OPEN = 1;

const SERVER_CODES: ReadonlySet<string> = new Set(STREAM_ERROR_CODES);
const PROVIDERS: ReadonlySet<string> = new Set(LIVE_STT_PROVIDERS);

/** Close codes a new socket would only meet again. */
const FINAL_CLOSES: ReadonlyMap<number, RelayErrorCode> = new Map<number, RelayErrorCode>([
  [STREAM_CLOSE.cap, "cap"],
  [STREAM_CLOSE.badOrigin, "bad-origin"],
  [STREAM_CLOSE.busy, "busy"],
  [STREAM_CLOSE.protocol, "protocol"],
  [STREAM_CLOSE.tooLarge, "too-large"],
]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

interface Held {
  frame: ArrayBuffer;
  atMs: number;
}

export function connectRelay(options: RelayOptions): Relay {
  const Impl = options.WebSocketImpl ?? (typeof WebSocket !== "undefined" ? (WebSocket as unknown as RelaySocketCtor) : null);
  const maxHeldBytes = Math.max(PCM.frameBytes, ((options.maxBufferMs ?? RELAY_BUFFER_MS) / 1000) * PCM.bytesPerSecond);
  const stopTimeoutMs = options.stopTimeoutMs ?? RELAY_STOP_TIMEOUT_MS;
  const connectTimeoutMs = options.connectTimeoutMs ?? RELAY_CONNECT_TIMEOUT_MS;

  let state: RelayState = "connecting";
  let socket: RelaySocket | null = null;
  let gatewayUrl = options.gatewayUrl;
  let reconnectUsed = false;
  /** `start` has gone out on the current socket. */
  let started = false;
  let held: Held[] = [];
  let heldBytes = 0;
  let droppedReported = false;
  let audioSeconds: number | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let ended: RelayEnd | null = null;
  let stopWaiters: Array<(end: RelayEnd) => void> = [];

  // A caller's callback that throws must not leave the relay half-updated.
  const call = <T>(fn: ((value: T) => void) | undefined, value: T) => {
    if (!fn) return;
    try {
      fn(value);
    } catch {
      // Theirs to report.
    }
  };

  const clearTimers = () => {
    if (connectTimer !== null) clearTimeout(connectTimer);
    if (stopTimer !== null) clearTimeout(stopTimer);
    connectTimer = null;
    stopTimer = null;
  };

  function finish(reason: RelayEndReason) {
    if (state === "ended") return;
    state = "ended";
    clearTimers();
    const current = socket;
    socket = null;
    if (current && (current.readyState === CONNECTING || current.readyState === OPEN)) {
      try {
        current.close(1000);
      } catch {
        // Already closing.
      }
    }
    held = [];
    heldBytes = 0;
    const end: RelayEnd = { reason, audioSeconds };
    ended = end;
    call(options.onEnd, end);
    const waiters = stopWaiters;
    stopWaiters = [];
    waiters.forEach((resolve) => resolve(end));
  }

  function fail(code: RelayErrorCode, message: string) {
    if (state === "ended") return;
    call(options.onError, { code, message, fatal: true });
    finish("failed");
  }

  function sendStart(atMs: number) {
    if (!socket) return;
    const message: StreamClientMessage = { type: "start", sampleRate: PCM.sampleRate, t0OffsetMs: Math.max(0, Math.round(atMs)) };
    socket.send(JSON.stringify(message));
    started = true;
  }

  function flushHeld() {
    if (!socket || socket.readyState !== OPEN || held.length === 0) return;
    const out = held;
    held = [];
    heldBytes = 0;
    if (!started) sendStart(out[0].atMs);
    for (const item of out) socket.send(item.frame);
  }

  function hold(frame: ArrayBuffer, atMs: number) {
    held.push({ frame, atMs });
    heldBytes += frame.byteLength;
    let dropped = false;
    while (heldBytes > maxHeldBytes && held.length > 1) {
      const oldest = held.shift() as Held;
      heldBytes -= oldest.frame.byteLength;
      dropped = true;
    }
    if (dropped && !droppedReported) {
      droppedReported = true;
      call(options.onError, { code: "dropped-audio", message: "Live-caption audio was dropped while the connection opened.", fatal: false });
    }
  }

  function open(ticket: string) {
    if (!Impl) {
      // Deferred, so the caller holds the relay before hearing it failed.
      queueMicrotask(() => fail("unavailable", "This browser has no WebSocket."));
      return;
    }
    let next: RelaySocket;
    try {
      next = new Impl(streamUrlFor(gatewayUrl), subprotocolsFor(ticket));
    } catch {
      // A bad URL or ticket, or a mixed-content refusal: a fresh ticket would not help.
      queueMicrotask(() => fail("unavailable", "The live-caption connection could not be opened."));
      return;
    }
    next.binaryType = "arraybuffer";
    socket = next;
    started = false;
    droppedReported = false;
    audioSeconds = null;

    connectTimer = setTimeout(() => {
      connectTimer = null;
      if (socket === next && next.readyState === CONNECTING) lost(next, 1006);
    }, connectTimeoutMs);

    next.onopen = () => {
      if (socket !== next) return;
      if (connectTimer !== null) clearTimeout(connectTimer);
      connectTimer = null;
      if (state === "connecting" || state === "reconnecting") state = "open";
      flushHeld();
    };
    next.onmessage = (event) => {
      if (socket === next) receive(event.data);
    };
    next.onclose = (event) => lost(next, event.code);
    // Every error is followed by a close, which is where it is handled.
    next.onerror = () => {};
  }

  function receive(data: unknown) {
    // The gateway sends only text; anything else is ignored.
    if (typeof data !== "string") return;
    let message: unknown;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (!isRecord(message)) return;

    switch (message.type) {
      case "ready":
        if (typeof message.provider === "string" && PROVIDERS.has(message.provider)) call(options.onReady, message.provider as LiveSttProvider);
        return;
      case "partial":
      case "final": {
        const { resultId, text, startMs, endMs } = message;
        if (typeof resultId !== "string" || typeof text !== "string" || !isTime(startMs) || !isTime(endMs)) return;
        call(message.type === "final" ? options.onFinal : options.onPartial, { resultId, text, startMs, endMs });
        return;
      }
      case "end":
        if (isTime(message.audioSeconds)) audioSeconds = message.audioSeconds;
        if (state === "stopping") finish("stopped");
        return;
      case "error": {
        const code = typeof message.code === "string" && SERVER_CODES.has(message.code) ? (message.code as StreamErrorCode) : "internal";
        const text = typeof message.message === "string" ? message.message : "";
        // Asked to come back on a new socket: the close that follows reconnects.
        // While stopping, the close that follows ends the relay as stopped.
        if (code === "reconnect" || state === "stopping") return;
        // Named errors end the relay here, so the close that follows is ignored.
        fail(code, text || `The gateway ended live captions (${code}).`);
        return;
      }
      default:
        return;
    }
  }

  /** The current socket is gone, however it went. */
  function lost(which: RelaySocket, code: number) {
    if (socket !== which) return;
    socket = null;
    if (connectTimer !== null) clearTimeout(connectTimer);
    connectTimer = null;
    if (which.readyState === CONNECTING || which.readyState === OPEN) {
      try {
        which.close(1000);
      } catch {
        // Already closing.
      }
    }
    if (state === "ended") return;
    if (state === "stopping") {
      finish("stopped");
      return;
    }
    const final = FINAL_CLOSES.get(code);
    if (final) {
      fail(final, `Live captions closed (${code}).`);
      return;
    }
    reconnect(code);
  }

  function reconnect(code: number) {
    const getTicket = options.getTicket;
    if (reconnectUsed || !getTicket) {
      const badTicket = code === STREAM_CLOSE.badTicket && !reconnectUsed;
      fail(badTicket ? "bad-ticket" : "unavailable", `Live captions closed (${code}).`);
      return;
    }
    reconnectUsed = true;
    state = "reconnecting";
    call(options.onReconnect, undefined);
    let pending: Promise<RelayTicket>;
    try {
      pending = Promise.resolve(getTicket());
    } catch {
      pending = Promise.resolve(null);
    }
    pending.then(
      (result) => {
        if (state !== "reconnecting") return;
        const ticket = typeof result === "string" ? result : (result?.streamTicket ?? null);
        if (isRecord(result) && typeof result.gatewayUrl === "string" && result.gatewayUrl) gatewayUrl = result.gatewayUrl;
        if (!ticket) {
          fail("unavailable", "No ticket for a new live-caption connection.");
          return;
        }
        open(ticket);
      },
      () => {
        if (state === "reconnecting") fail("unavailable", "No ticket for a new live-caption connection.");
      },
    );
  }

  open(options.ticket);

  return {
    get state() {
      return state;
    },
    send(frame, atMs) {
      if (state === "ended" || state === "stopping" || !(frame instanceof ArrayBuffer) || frame.byteLength === 0) return;
      const current = socket;
      if (state !== "open" || !current || current.readyState !== OPEN) {
        hold(frame, atMs);
        return;
      }
      if (current.bufferedAmount > RELAY_MAX_BUFFERED_BYTES) {
        // The uplink has stalled. This frame starts the next socket's stream.
        hold(frame, atMs);
        lost(current, 1006);
        return;
      }
      if (!started) sendStart(atMs);
      current.send(frame);
    },
    stop() {
      if (ended) return Promise.resolve(ended);
      const waiting = new Promise<RelayEnd>((resolve) => stopWaiters.push(resolve));
      if (state === "stopping") return waiting;
      const current = socket;
      if (state === "open" && current && current.readyState === OPEN) flushHeld();
      // Nothing was streamed on this socket (or none is open): no finals to wait for.
      if (state !== "open" || !current || current.readyState !== OPEN || !started) {
        finish("stopped");
        return waiting;
      }
      state = "stopping";
      const message: StreamClientMessage = { type: "stop" };
      try {
        current.send(JSON.stringify(message));
      } catch {
        finish("stopped");
        return waiting;
      }
      stopTimer = setTimeout(() => {
        stopTimer = null;
        finish("stopped");
      }, stopTimeoutMs);
      return waiting;
    },
    close() {
      finish("closed");
    },
  };
}
