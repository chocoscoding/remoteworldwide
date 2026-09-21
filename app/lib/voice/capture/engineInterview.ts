// The speech engine's interviewer, as the interview capture sees it.
//
// On an engine session the service owns the words: its turn handler hears
// every user transcript and writes every reply, and it stores both. The
// browser sends only when each turn started and ended, matched by id
// `eng:<conversationId>:<turnIndex>:<who>`, where turnIndex is the number of
// spoken user transcripts so far (`isSpokenText`: "..." is noise and counts for
// nothing, as on the service). User turn N and the interviewer's reply to it share
// N; whatever the interviewer says before the first user turn (the greeting,
// or the first question) is 0.
//
// Pure: no browser and no clock. useInterviewCapture feeds this the engine's
// events, already on the session clock, and applies the marks it makes.

import type { InterviewOpening, VoiceConversationConflict } from "@/app/lib/voice/conversation";
import type { MintRefusal } from "@/app/lib/voice/conversations";
import { isSpokenText, mintFailureOf } from "@/app/lib/voice/talkState";
import type { TurnSource, TurnSpeaker } from "@/app/lib/voice/types";
import type { EngineErrorCode } from "./engineSession";

// ---------------------------------------------------------------------------
// Turn ids
// ---------------------------------------------------------------------------

export function engineTurnId(conversationId: string, turnIndex: number, who: TurnSpeaker): string {
  return `eng:${conversationId}:${turnIndex}:${who}`;
}

export interface EngineTurnRef {
  conversationId: string;
  turnIndex: number;
  who: TurnSpeaker;
}

const ENGINE_TURN_ID = /^eng:([A-Za-z0-9_-]{1,128}):(\d{1,6}):(ai|user)$/;

export function parseEngineTurnId(id: string): EngineTurnRef | null {
  const match = ENGINE_TURN_ID.exec(id);
  if (!match) return null;
  return { conversationId: match[1], turnIndex: Number(match[2]), who: match[3] as TurnSpeaker };
}

/** User turn N comes before the interviewer's reply N. */
const orderOf = (ref: EngineTurnRef): number => ref.turnIndex * 2 - (ref.who === "user" ? 1 : 0);

// ---------------------------------------------------------------------------
// The recording track
// ---------------------------------------------------------------------------

export interface RecordingTrackFacts {
  /** Handed to the engine, so its own capture opens the same microphone. */
  deviceId?: string;
  /** Whether the track reports automatic gain off; unset when it does not say, so the service falls back to its own guess. */
  agcOff?: boolean;
}

export function recordingTrackFacts(track: Pick<MediaStreamTrack, "getSettings"> | null | undefined): RecordingTrackFacts {
  let settings: MediaTrackSettings;
  try {
    settings = track?.getSettings?.() ?? {};
  } catch {
    return {};
  }
  const facts: RecordingTrackFacts = {};
  if (typeof settings.deviceId === "string" && settings.deviceId) facts.deviceId = settings.deviceId;
  if (typeof settings.autoGainControl === "boolean") facts.agcOff = settings.autoGainControl === false;
  return facts;
}

// ---------------------------------------------------------------------------
// Why there is no interviewer
// ---------------------------------------------------------------------------

/** `disconnected` is a call that dropped mid-interview; the rest stopped it starting. `session`: this session can't take a call. */
export type EngineProblemKind = "mic" | "unavailable" | "conflict" | "session" | "minutes" | "rate" | "disconnected";

export interface EngineProblem {
  kind: EngineProblemKind;
  /** `conflict`: the call already live elsewhere. */
  conflict?: VoiceConversationConflict;
  /** `minutes` / `rate`: when another try can work, ISO. */
  retryAt?: string;
  /** `unavailable`: this browser cannot run the interviewer (P16); another browser can. */
  browser?: boolean;
}

/** `status` is the refusal's HTTP status: a 409 naming no live call is this session refusing one (talkState's `mintFailureOf`). */
export function engineProblemOfRefusal(refusal: MintRefusal, status: number | null = null): EngineProblem {
  if (refusal.kind === "conflict") return { kind: "conflict", conflict: refusal.conflict };
  if (mintFailureOf(refusal, status).kind === "session") return { kind: "session" };
  if (refusal.kind === "minutes" || refusal.kind === "rate") return refusal.retryAt ? { kind: refusal.kind, retryAt: refusal.retryAt } : { kind: refusal.kind };
  return { kind: "unavailable" };
}

/** From the first fatal error the engine reported while starting; a refused credential is ours to retry, not the user's. */
export function engineProblemOfStart(code: EngineErrorCode | null, unsupported = false): EngineProblem {
  if (unsupported) return { kind: "unavailable", browser: true };
  return { kind: code === "mic" ? "mic" : "unavailable" };
}

export function engineProblemMessage(problem: EngineProblem): string {
  if (problem.kind === "unavailable" && problem.browser)
    return "The voice interviewer doesn't work in this browser yet. Open this page in Chrome, Edge or Safari, or start a typed interview.";
  switch (problem.kind) {
    case "mic":
      return "The interviewer couldn't use your microphone. Allow it for this site and close other apps using it, then try again.";
    case "conflict":
      return "You have a voice call open somewhere else. End it, then start the interview again.";
    case "session":
      return "The interview may have finished or run out of recording time. Try again for a fresh session, or start a typed interview.";
    case "minutes":
      return "You've used today's voice minutes. Try again tomorrow, or start a typed interview.";
    case "rate":
      return "Too many voice calls were started just now. Wait a little, or start a typed interview.";
    case "disconnected":
      return "The interviewer disconnected, so the interview has ended.";
    default:
      return "The interviewer couldn't connect. Try again in a moment, or start a typed interview.";
  }
}

// ---------------------------------------------------------------------------
// The conversation
// ---------------------------------------------------------------------------

export interface EngineTurn {
  id: string;
  who: TurnSpeaker;
  /** As the engine heard or said it, for the screen. Never sent: the service keeps its own. */
  text: string;
  /** `typed` for an answer sent as text, which has no delivery to measure. */
  source: Extract<TurnSource, "voice" | "typed">;
}

/** What the turns do to the capture's timings. Times are on the session clock. */
export interface EngineMarks {
  /** An interviewer turn starts, or resumes after a pause longer than the settle window. */
  aiStart: (turnId: string, atMs: number) => void;
  aiEnd: (turnId: string, atMs: number, bargedIn: boolean) => void;
  /** A user turn arrived: its answer window closes now. */
  answer: (turnId: string) => void;
}

export interface InterviewerTurns {
  readonly turns: readonly EngineTurn[];
  /** User turns counted so far: the index of the interviewer turn now on the table. */
  readonly userTurns: number;
  readonly speaking: boolean;
  /** The interviewer's latest line. */
  readonly aiText: string;
  speakStart: (atMs: number) => void;
  /** Debounced by engineSession: the interviewer's turn is over. */
  speakEnd: (atMs: number) => void;
  /** The user talked over the interviewer; the turn's end follows. */
  interrupted: () => void;
  agentText: (text: string) => void;
  /**
   * A user turn, or null when it is noise or not a new one. With `eventId` a spoken
   * transcript is the same turn only when that id was heard already (or it is
   * the echo of a typed answer). Without one, a spoken turn that repeats the
   * last with nothing from the interviewer between is taken as delivered again.
   */
  userText: (text: string, source?: EngineTurn["source"], eventId?: number) => EngineTurn | null;
}

export function createInterviewerTurns(conversationId: string, marks: EngineMarks): InterviewerTurns {
  let turns: EngineTurn[] = [];
  let userTurns = 0;
  let lastUser: string | null = null;
  let heardSince = false;
  const heardIds = new Set<number>();
  /** The last user turn was typed, and its echo has not come back yet. */
  let echoDue = false;
  let open: string | null = null;
  let cutOff: string | null = null;
  let aiText = "";

  const aiTurnId = () => engineTurnId(conversationId, userTurns, "ai");
  const noteAiTurn = (id: string) => {
    if (!turns.some((turn) => turn.id === id)) turns = [...turns, { id, who: "ai", text: "", source: "voice" }];
  };

  return {
    get turns() {
      return turns;
    },
    get userTurns() {
      return userTurns;
    },
    get speaking() {
      return open !== null;
    },
    get aiText() {
      return aiText;
    },
    speakStart(atMs) {
      heardSince = true;
      if (open !== null) return;
      open = aiTurnId();
      noteAiTurn(open);
      marks.aiStart(open, atMs);
    },
    speakEnd(atMs) {
      const id = open;
      open = null;
      if (id === null) return;
      marks.aiEnd(id, atMs, cutOff === id);
      cutOff = null;
    },
    interrupted() {
      if (open !== null) cutOff = open;
    },
    agentText(text) {
      const said = text.trim();
      if (!said) return;
      heardSince = true;
      const id = aiTurnId();
      noteAiTurn(id);
      turns = turns.map((turn) => (turn.id === id ? { ...turn, text: turn.text ? `${turn.text} ${said}` : said } : turn));
      aiText = said;
    },
    userText(text, source = "voice", eventId) {
      const said = text.trim();
      if (!isSpokenText(said)) return null;
      if (source === "voice") {
        const again = !heardSince && lastUser === said;
        const known = eventId === undefined ? again : heardIds.has(eventId) || (again && echoDue);
        if (eventId !== undefined) heardIds.add(eventId);
        if (known) {
          echoDue = false;
          return null;
        }
      }
      userTurns += 1;
      lastUser = said;
      heardSince = false;
      echoDue = source === "typed";
      const turn: EngineTurn = { id: engineTurnId(conversationId, userTurns, "user"), who: "user", text: said, source };
      turns = [...turns, turn];
      marks.answer(turn.id);
      return turn;
    },
  };
}

/** Whether any user turn answers a question. On a `greeting` opening user turn 1 is the reply to the greeting, which answers nothing (§8.3). */
export function hasEngineAnswer(turns: readonly { id: string; who: TurnSpeaker }[], opening: InterviewOpening | null | undefined): boolean {
  return turns.some((turn) => turn.who === "user" && !(opening === "greeting" && parseEngineTurnId(turn.id)?.turnIndex === 1));
}

/** A turn as the finish sends it on an engine session. */
export interface EngineFinishTurn {
  id: string;
  who: TurnSpeaker;
  text: string;
  source: TurnSource;
}

/**
 * The turns an engine session's finish sends: ids only, for the service to put
 * the times on its own turns, so `text` is empty. The page's turns with this
 * conversation's ids (a first question the browser read aloud) are kept; any
 * other page turn is not the service's to merge.
 */
export function engineFinishTurns(
  conversationId: string,
  own: readonly EngineTurn[],
  page: readonly { id: string; who: TurnSpeaker; source: TurnSource }[],
): EngineFinishTurn[] {
  const kept = new Map<string, { turn: EngineFinishTurn; order: number }>();
  for (const turn of [...own, ...page]) {
    const ref = parseEngineTurnId(turn.id);
    if (!ref || ref.conversationId !== conversationId || ref.who !== turn.who || kept.has(turn.id)) continue;
    kept.set(turn.id, { turn: { id: turn.id, who: turn.who, text: "", source: turn.source }, order: orderOf(ref) });
  }
  return [...kept.values()].sort((a, b) => a.order - b.order).map(({ turn }) => turn);
}
