// One spoken conversation with the ElevenLabs Speech Engine, from the browser.
//
// `@elevenlabs/client` owns the socket, the mic and the agent's audio. This
// module turns its callbacks into the events the talk UI and the interview
// capture need, on the session clock, and fixes the two things the raw
// callbacks get wrong for us:
//
//  - `onModeChange` is not a turn boundary. The client sets "speaking" when
//    audio ARRIVES and "listening" whenever its playback worklet runs dry for a
//    quantum, so a raw "listening" fires mid-sentence on every network hiccup.
//    The agent's turn ends only after AGENT_DRAIN_SETTLE_MS of "listening" with
//    no "speaking" in between; it is timed from the first "listening". A user
//    transcript inside that window ends it there at once.
//  - Errors arrive as bare strings or DOMExceptions. They are classified here
//    (`classifyEngineError`), and `fatal` is decided per error, never always true.
//
// The signed URL is a single-use bearer credential: it goes to the client and
// nowhere else.

import type { SessionClock } from "./clock";

export type EngineErrorCode = "auth" | "unavailable" | "mic" | "internal";

export interface EngineOptions {
  signedUrl: string;
  clock: SessionClock;
  /** From OUR track's getSettings(), so both captures share one device. */
  inputDeviceId?: string;
  /** The mint's `firstMessage`, spoken by the engine as the opening line; null when the user speaks first. */
  firstMessage?: string | null;
  onAgentSpeakStart: (atMs: number) => void;
  /** Debounced: see AGENT_DRAIN_SETTLE_MS. */
  onAgentSpeakEnd: (atMs: number) => void;
  onAgentText: (text: string, atMs: number) => void;
  /** `eventId`: the transcript's event_id when the client gives one; a redelivery repeats it. */
  onUserText: (text: string, atMs: number, eventId?: number) => void;
  onInterrupted: (atMs: number) => void;
  onStatus: (s: "connecting" | "connected" | "disconnected") => void;
  /** `unsupported`: the browser itself cannot run the client's mic setup (P16), whatever `code` says. */
  onError: (e: { code: EngineErrorCode; fatal: boolean; unsupported?: boolean }) => void;
}

export interface EngineSession {
  readonly conversationId: string;
  /** Hangs up. Closes an agent turn still open. Idempotent. */
  end(): Promise<void>;
  /** 0-1; 0 once the session is gone. */
  getInputVolume(): number;
  getOutputVolume(): number;
  /** The client's byte spectrum (0-255, 100-8000 Hz), a buffer it reuses per read; null once the session is gone. */
  getInputByteFrequencyData(): Uint8Array | null;
  getOutputByteFrequencyData(): Uint8Array | null;
  /**
   * The engine hears silence: the client zero-fills its worklet's chunks and
   * keeps streaming them, and its input level and spectrum read 0 (client
   * 1.25, platform/web/input.js). Dropped while the call is not open, and the
   * client's setup starts unmuted, so a mute wanted from before the call is
   * the caller's to keep and apply once connected (useInterviewCapture).
   */
  setMicMuted(muted: boolean): void;
  /** A typed turn, sent as the user's words. False once the call is over. */
  sendUserMessage(text: string): boolean;
  /** The user is busy (typing, or muted): the agent holds off speaking for a moment, so a longer hold repeats it. */
  sendUserActivity(): void;
  isOpen(): boolean;
  /**
   * The agent's audio as the client played it, for the playback-only mix
   * (playbackMix.ts); null once the call is over, or where this client does
   * not have the shape `tapPlayedAudio` reads.
   */
  playedAudio(): MediaStream | null;
}

/**
 * How long "listening" must hold before the agent's turn counts as over. The
 * client reports a worklet underrun as "listening" (VoiceConversation.js:49),
 * so anything shorter ends turns in the middle of a sentence.
 */
export const AGENT_DRAIN_SETTLE_MS = 600;

/** The engine's client waits for the server's first frame forever; a call not connected by now never will be. */
export const ENGINE_CONNECT_TIMEOUT_MS = 40_000;

/**
 * The `@elevenlabs/client` version whose private playback path
 * `tapPlayedAudio` was read from (platform/web/output.js). The AI repo's
 * contract suite fails when the installed client is any other version, so an
 * upgrade re-checks the tap instead of silently losing the interviewer from
 * the playback. At run time the shape is all that is trusted.
 */
export const TAPPED_CLIENT_VERSION = "1.25.0";

/**
 * The audio the client actually PLAYED, as a MediaStream, or null.
 *
 * The public `onAudio` callback is not it: it fires per chunk as the chunk
 * ARRIVES, and an interruption then flushes chunks that were queued but never
 * heard (output.js interrupt()), so a mix built from it would have the
 * interviewer talking on over the candidate who cut them off. What is heard
 * goes gain -> analyser -> a MediaStreamDestination whose stream is the
 * `srcObject` of a hidden <audio> element (output.js create()), held on the
 * conversation's private `output`. This reads that stream, by shape only and
 * without touching the client's graph: anything else (another version, the
 * WebRTC path, a stand-in in a test) is null, and the playback stays the
 * candidate's own track.
 */
export function tapPlayedAudio(conversation: unknown): MediaStream | null {
  try {
    if (typeof conversation !== "object" || conversation === null) return null;
    const output = (conversation as { output?: unknown }).output;
    if (typeof output !== "object" || output === null) return null;
    const element = (output as { audioElement?: unknown }).audioElement;
    if (typeof element !== "object" || element === null) return null;
    const stream = (element as { srcObject?: unknown }).srcObject as MediaStream | null | undefined;
    if (!stream || typeof stream.getAudioTracks !== "function") return null;
    return stream.getAudioTracks().some((track) => track.readyState === "live") ? stream : null;
  } catch {
    return null;
  }
}

type ClientModule = typeof import("@elevenlabs/client");
type StartOptions = Parameters<ClientModule["Conversation"]["startSession"]>[0];
type StartedConversation = Awaited<ReturnType<ClientModule["Conversation"]["startSession"]>>;

export interface EngineDeps {
  /** Loads the client on demand, so it stays out of every bundle that never talks. */
  load: () => Promise<Pick<ClientModule, "Conversation">>;
}

const defaultDeps: EngineDeps = { load: () => import("@elevenlabs/client") };

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/** getUserMedia's refusals and failures, including names older browsers used. */
const MIC_ERROR_NAMES: ReadonlySet<string> = new Set([
  "NotAllowedError",
  "PermissionDeniedError",
  "NotFoundError",
  "DevicesNotFoundError",
  "NotReadableError",
  "TrackStartError",
  "OverconstrainedError",
  "ConstraintNotSatisfiedError",
  "SecurityError",
]);
/** Policy violation, and the 4xxx codes servers use for a refused credential. */
const AUTH_CLOSE_CODES: ReadonlySet<number> = new Set([1008, 3000, 4001, 4003, 4401, 4403]);
const UNAVAILABLE_CLOSE_CODES: ReadonlySet<number> = new Set([1001, 1006, 1011, 1012, 1013, 1014, 1015]);

// Firefox rejects permissions.query({ name: "microphone" }) with a TypeError naming PermissionName.
const MIC_TEXT = /microphone|getusermedia|mediadevices|permissionname|audio input|input device/i;
const AUTH_TEXT = /\bauth|unauthori[sz]ed|forbidden|signature|expired|invalid (?:token|url|key|credential)|not allowed to|\b40[13]\b/i;
const UNAVAILABLE_TEXT =
  /network|socket|connection|timed? ?out|unavailable|unreachable|offline|failed to fetch|loading chunk|overloaded|capacity|busy|quota|rate.?limit|too many|\b50[234]\b/i;

interface ErrorFacts {
  name: string;
  text: string;
  closeCode: number | null;
}

function factsOf(error: unknown, context: unknown): ErrorFacts {
  const facts: ErrorFacts = { name: "", text: "", closeCode: null };
  const texts: string[] = [];
  for (const value of [error, context]) {
    if (typeof value === "string") {
      texts.push(value);
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    const record = value as { name?: unknown; message?: unknown; closeCode?: unknown; closeReason?: unknown; code?: unknown; reason?: unknown; type?: unknown };
    if (!facts.name && typeof record.name === "string") facts.name = record.name;
    for (const text of [record.message, record.closeReason, record.reason, record.type]) if (typeof text === "string") texts.push(text);
    const code = typeof record.closeCode === "number" ? record.closeCode : typeof record.code === "number" ? record.code : null;
    if (facts.closeCode === null && code !== null && code >= 1000 && code < 5000) facts.closeCode = code;
  }
  facts.text = texts.join(" ");
  return facts;
}

/** What went wrong, from whatever the client handed over: a DOMException, a SessionConnectionError, a string and its context. */
export function classifyEngineError(error: unknown, context?: unknown): EngineErrorCode {
  const { name, text, closeCode } = factsOf(error, context);
  if (MIC_ERROR_NAMES.has(name) || MIC_TEXT.test(text)) return "mic";
  if ((closeCode !== null && AUTH_CLOSE_CODES.has(closeCode)) || AUTH_TEXT.test(text)) return "auth";
  if ((closeCode !== null && UNAVAILABLE_CLOSE_CODES.has(closeCode)) || UNAVAILABLE_TEXT.test(text) || name === "SessionConnectionError" || name === "ChunkLoadError")
    return "unavailable";
  return "internal";
}

/** A TypeError from the permissions API (Firefox's permissions.query, or no API at all): the browser, not the mic, refused. */
export function isUnsupportedBrowserError(error: unknown): boolean {
  const { name, text } = factsOf(error, undefined);
  return name === "TypeError" && /permission/i.test(text);
}

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------

const readVolume = (read: () => number): number => {
  try {
    const value = read();
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  } catch {
    return 0;
  }
};

const readSpectrum = (read: () => Uint8Array): Uint8Array | null => {
  try {
    const data = read();
    return data instanceof Uint8Array ? data : null;
  } catch {
    return null;
  }
};

/**
 * Starts a conversation on a minted signed URL. Null when it could not start,
 * after `onError` has said why. For the interview that is fatal: abandon the
 * session rather than record twenty minutes with no interviewer.
 */
export async function startEngine(o: EngineOptions, deps: EngineDeps = defaultDeps): Promise<EngineSession | null> {
  let conversation: StartedConversation | null = null;
  let agentSpeaking = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let settleFrom = 0;
  let ended = false;
  let fatalReported = false;
  let status: "connecting" | "connected" | "disconnected" | null = null;

  const now = () => o.clock.now();
  const setStatus = (next: "connecting" | "connected" | "disconnected") => {
    if (status === next || status === "disconnected") return;
    status = next;
    o.onStatus(next);
  };
  const cancelSettle = () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
  };
  const closeAgentTurn = (atMs: number) => {
    cancelSettle();
    if (!agentSpeaking) return;
    agentSpeaking = false;
    o.onAgentSpeakEnd(atMs);
  };
  // A call ending inside the settle window: the turn ended where the audio ran out.
  const turnEndAt = () => (settleTimer !== null ? settleFrom : now());
  // Until startSession resolves, the client's own "connected" is the only sign the call is open.
  const isOpen = () => !ended && (conversation === null ? status === "connected" : conversation.isOpen());
  // One fatal per session: a refused start can surface through onError and the rejection both.
  const report = (code: EngineErrorCode, fatal: boolean) => {
    if (ended || (fatal && fatalReported)) return;
    if (fatal) fatalReported = true;
    o.onError({ code, fatal });
  };

  const options: StartOptions = {
    signedUrl: o.signedUrl,
    connectionType: "websocket",
    ...(o.inputDeviceId ? { inputDeviceId: o.inputDeviceId } : {}),
    ...(o.firstMessage ? { overrides: { agent: { firstMessage: o.firstMessage } } } : {}),
    onStatusChange: ({ status: next }) => {
      // "disconnected" is reported from onDisconnect, after the error that caused it.
      if (next === "connecting" || next === "connected") setStatus(next);
    },
    onModeChange: ({ mode }) => {
      if (ended) return;
      if (mode === "speaking") {
        cancelSettle();
        if (agentSpeaking) return;
        agentSpeaking = true;
        o.onAgentSpeakStart(now());
        return;
      }
      if (!agentSpeaking || settleTimer !== null) return;
      settleFrom = now();
      settleTimer = setTimeout(() => {
        settleTimer = null;
        if (ended) return;
        closeAgentTurn(settleFrom);
      }, AGENT_DRAIN_SETTLE_MS);
    },
    onInterruption: () => {
      if (ended) return;
      const at = now();
      cancelSettle();
      o.onInterrupted(at);
      closeAgentTurn(at);
    },
    onMessage: (message) => {
      if (ended || typeof message.message !== "string" || !message.message.trim()) return;
      const role = message.role ?? (message.source === "ai" ? "agent" : "user");
      if (role !== "user") {
        o.onAgentText(message.message, now());
        return;
      }
      // The user spoke: an agent turn still settling ended at its last audio.
      if (settleTimer !== null) closeAgentTurn(settleFrom);
      o.onUserText(message.message, now(), typeof message.event_id === "number" ? message.event_id : undefined);
    },
    onError: (message, context) => {
      const code = classifyEngineError(message, context);
      report(code, code === "mic" || code === "auth" || !isOpen());
    },
    onDisconnect: (details) => {
      closeAgentTurn(turnEndAt());
      if (details.reason === "error" && details.context?.type !== "max_duration_exceeded") {
        const code = classifyEngineError({ message: details.message, closeCode: details.closeCode, closeReason: details.closeReason }, details.context);
        report(code === "mic" || code === "auth" ? code : "unavailable", true);
      } else if (details.reason === "agent" && conversation === null) {
        report("unavailable", true);
      }
      ended = true;
      setStatus("disconnected");
    },
  };

  try {
    const client = await deps.load();
    conversation = await client.Conversation.startSession(options);
  } catch (error) {
    cancelSettle();
    if (!fatalReported) o.onError({ code: classifyEngineError(error), fatal: true, ...(isUnsupportedBrowserError(error) ? { unsupported: true } : {}) });
    ended = true;
    setStatus("disconnected");
    return null;
  }
  // Closed during setup (the client replays that close after resolving), or setup already reported a fatal error.
  if (ended || fatalReported || !conversation.isOpen()) {
    closeAgentTurn(turnEndAt());
    if (!fatalReported) o.onError({ code: "unavailable", fatal: true });
    fatalReported = true;
    ended = true;
    void conversation.endSession().catch(() => undefined);
    setStatus("disconnected");
    return null;
  }

  const started = conversation;
  return {
    conversationId: started.getId(),
    async end() {
      if (!ended) closeAgentTurn(turnEndAt());
      ended = true;
      cancelSettle();
      await started.endSession().catch(() => undefined);
      setStatus("disconnected");
    },
    getInputVolume: () => (isOpen() ? readVolume(() => started.getInputVolume()) : 0),
    getOutputVolume: () => (isOpen() ? readVolume(() => started.getOutputVolume()) : 0),
    getInputByteFrequencyData: () => (isOpen() ? readSpectrum(() => started.getInputByteFrequencyData()) : null),
    getOutputByteFrequencyData: () => (isOpen() ? readSpectrum(() => started.getOutputByteFrequencyData()) : null),
    setMicMuted(muted) {
      if (isOpen()) started.setMicMuted(muted);
    },
    sendUserMessage(text) {
      if (!isOpen()) return false;
      try {
        started.sendUserMessage(text);
        return true;
      } catch {
        return false;
      }
    },
    sendUserActivity() {
      if (isOpen()) started.sendUserActivity();
    },
    isOpen,
    playedAudio: () => (isOpen() ? tapPlayedAudio(started) : null),
  };
}
