// Talk mode's state: where a spoken call is, what went wrong, and the live
// captions. A pure reducer, so every transition can be tested without a
// browser; useVoiceConversation drives it.
//
//   idle -> checking-mic -> minting -> connecting -> live -> ending -> ended
//
// A failure at any step lands in `ended` with a `problem`; `start` from `ended`
// tries again, and `reset` goes back to `idle`.

import type { VoiceConversationConflict, VoiceFeature } from "./conversation";

export const TALK_PHASES = ["idle", "checking-mic", "minting", "connecting", "live", "ending", "ended"] as const;
export type TalkPhase = (typeof TALK_PHASES)[number];

export const TALK_PROBLEM_KINDS = ["mic", "conflict", "session", "minutes", "rate", "unavailable", "dropped"] as const;
export type TalkProblemKind = (typeof TALK_PROBLEM_KINDS)[number];

export interface TalkProblem {
  kind: TalkProblemKind;
  /** `conflict`: the call already live elsewhere. */
  conflict?: VoiceConversationConflict;
  /** `minutes` or `rate`: when starting a call is expected to work again, ISO. */
  retryAt?: string;
  /** `unavailable`: this browser cannot run the voice client (P16); another browser can. */
  browser?: boolean;
}

export interface TalkState {
  phase: TalkPhase;
  problem: TalkProblem | null;
  conversationId: string | null;
  /** The call's own ceiling, capped by today's remaining minutes; null until minted. */
  limitSeconds: number | null;
  agentSpeaking: boolean;
  userCaption: string;
  agentCaption: string;
}

export type MintFailureKind = Exclude<TalkProblemKind, "mic" | "dropped">;

export interface MintFailure {
  kind: MintFailureKind;
  conflict?: VoiceConversationConflict;
  retryAt?: string;
}

/**
 * A refused mint in talk's terms. A 409 that names no live call is this
 * session refusing a call (the interview finished, is not on the engine or has
 * no time left), not a conflict.
 */
export const mintFailureOf = (refusal: MintFailure, status: number | null): MintFailure =>
  refusal.kind === "unavailable" && status === 409 ? { kind: "session" } : refusal;

const SPOKEN = new RegExp("[\\p{L}\\p{N}]", "u");

/** The service's isSpokenText: a user transcript with no letter or digit ("...") is noise, not a turn, and is not shown. */
export const isSpokenText = (text: string): boolean => SPOKEN.test(text);

export type TalkEvent =
  | { type: "start" }
  | { type: "micOk" }
  | { type: "micFailed" }
  | { type: "minted"; conversationId: string; limitSeconds: number }
  | { type: "mintFailed"; kind: MintFailureKind; conflict?: VoiceConversationConflict; retryAt?: string }
  | { type: "connected" }
  | { type: "agentSpeaking"; speaking: boolean }
  | { type: "userCaption"; text: string }
  | { type: "agentCaption"; text: string }
  /** The user hung up; `ended` follows once the socket has closed. */
  | { type: "end" }
  | { type: "ended" }
  | { type: "dropped" }
  /** Any step failed for a reason the step-specific events do not cover (the engine would not start). */
  | { type: "failed"; problem: TalkProblem }
  | { type: "reset" };

export const INITIAL_TALK_STATE: TalkState = {
  phase: "idle",
  problem: null,
  conversationId: null,
  limitSeconds: null,
  agentSpeaking: false,
  userCaption: "",
  agentCaption: "",
};

/** Phases with a call attempt in flight. */
const ACTIVE: ReadonlySet<TalkPhase> = new Set<TalkPhase>(["checking-mic", "minting", "connecting", "live", "ending"]);

export const isTalkActive = (phase: TalkPhase): boolean => ACTIVE.has(phase);

/** Whether a start would do anything: talk is on, there is a target and no call is in flight. */
export const canStartTalk = (enabled: boolean, targetId: string | null, phase: TalkPhase): boolean => enabled && !!targetId && !ACTIVE.has(phase);

const settle = (state: TalkState, problem: TalkProblem | null): TalkState => ({ ...state, phase: "ended", problem, agentSpeaking: false });

export function talkReducer(state: TalkState, event: TalkEvent): TalkState {
  switch (event.type) {
    case "start":
      return state.phase === "idle" || state.phase === "ended" ? { ...INITIAL_TALK_STATE, phase: "checking-mic" } : state;
    case "micOk":
      return state.phase === "checking-mic" ? { ...state, phase: "minting" } : state;
    case "micFailed":
      return state.phase === "checking-mic" || state.phase === "connecting" ? settle(state, { kind: "mic" }) : state;
    case "minted":
      return state.phase === "minting" ? { ...state, phase: "connecting", conversationId: event.conversationId, limitSeconds: event.limitSeconds } : state;
    case "mintFailed": {
      if (state.phase !== "minting") return state;
      const problem: TalkProblem = { kind: event.kind };
      if (event.kind === "conflict" && event.conflict) problem.conflict = event.conflict;
      if ((event.kind === "minutes" || event.kind === "rate") && event.retryAt) problem.retryAt = event.retryAt;
      return settle(state, problem);
    }
    case "connected":
      return state.phase === "connecting" ? { ...state, phase: "live" } : state;
    case "agentSpeaking":
      return state.phase === "live" && state.agentSpeaking !== event.speaking ? { ...state, agentSpeaking: event.speaking } : state;
    case "userCaption":
      // A new line from the user starts a new exchange; the agent's answer to the last one is done.
      return state.phase === "live" && isSpokenText(event.text) ? { ...state, userCaption: event.text, agentCaption: "" } : state;
    case "agentCaption":
      return state.phase === "live" ? { ...state, agentCaption: event.text } : state;
    case "end":
      return ACTIVE.has(state.phase) && state.phase !== "ending" ? { ...state, phase: "ending" } : state;
    case "ended":
      return ACTIVE.has(state.phase) ? settle(state, null) : state;
    case "dropped":
      if (state.phase === "ending") return settle(state, null);
      return state.phase === "connecting" || state.phase === "live" ? settle(state, { kind: "dropped" }) : state;
    case "failed":
      return ACTIVE.has(state.phase) ? settle(state, event.problem) : state;
    case "reset":
      return INITIAL_TALK_STATE;
  }
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export const VOICE_FEATURE_LABEL: Record<VoiceFeature, string> = {
  coach: "Career coach",
  "job-ask": "Ask about a job",
  interview: "Interview",
};

const localTime = (iso: string): string | null => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

/** What to tell the user. `formatTime` turns `retryAt` into a clock time; local time by default. */
export function problemCopy(problem: TalkProblem, formatTime: (iso: string) => string | null = localTime): string {
  switch (problem.kind) {
    case "mic":
      return "Mic blocked — type instead";
    case "conflict":
      return problem.conflict ? `You're already in a voice call (${VOICE_FEATURE_LABEL[problem.conflict.feature]})` : "You're already in a voice call";
    case "session":
      return "This session can't take a voice call right now";
    case "minutes": {
      const time = problem.retryAt ? formatTime(problem.retryAt) : null;
      return time ? `You've used today's voice minutes — back at ${time}` : "You've used today's voice minutes";
    }
    case "rate":
      return "Too many calls started — try again in a few minutes";
    case "unavailable":
      return problem.browser ? "Voice calls don't work in this browser yet — type instead" : "Voice isn't available right now";
    case "dropped":
      return "The call dropped";
  }
}

/**
 * What a problem offers besides typing. `end-other` hangs up the call named in
 * the conflict and tries once more; `retry` just tries again. Minutes, the
 * start limit, a session that can't take a call and a browser that can't run
 * one offer nothing: a retry now would only fail again.
 */
export function problemAction(problem: TalkProblem): "retry" | "end-other" | null {
  switch (problem.kind) {
    case "conflict":
      return problem.conflict ? "end-other" : "retry";
    case "unavailable":
      return problem.browser ? null : "retry";
    case "mic":
    case "dropped":
      return "retry";
    case "session":
    case "minutes":
    case "rate":
      return null;
  }
}
