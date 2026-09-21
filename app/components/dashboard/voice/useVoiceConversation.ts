"use client";

// Talk mode: one spoken call with the career coach, a job's Q&A or the
// interviewer, over the ElevenLabs Speech Engine.
//
// start() checks the mic, mints a conversation and dials it; everything after
// that runs through engineSession's callbacks into the talk reducer. The call
// is released on every way out: end(), a failure, the target changing, talk
// being switched off, unmount, and `pagehide` (by beacon, since an ordinary
// request dies with the page). Nothing is reserved at mint, so a call that
// never connects costs nothing but its release.
//
// Single-flight: a second start() while a call is in flight does nothing, and
// every async step re-checks that its call is still the live one, so a
// StrictMode double mount, a double click or an End pressed mid-mint never
// mints twice or leaves a conversation unreleased.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createSessionClock, type SessionClock } from "@/app/lib/voice/capture/clock";
import { ENGINE_CONNECT_TIMEOUT_MS, startEngine, type EngineErrorCode, type EngineSession } from "@/app/lib/voice/capture/engineSession";
import type { MintVoiceConversationResult, VoiceFeature } from "@/app/lib/voice/conversation";
import { VoiceRequestError, beaconRelease, mintConversation, mintRefusalOf, releaseConversation } from "@/app/lib/voice/conversations";
import { INITIAL_TALK_STATE, canStartTalk, isTalkActive, mintFailureOf, talkReducer, type TalkEvent, type TalkPhase, type TalkProblem } from "@/app/lib/voice/talkState";

export interface VoiceConversationOptions {
  feature: VoiceFeature;
  /** The coach session, job thread or prep session the call is about. Changing it ends the call. */
  targetId: string | null;
  /** Off: start() does nothing and a running call ends. */
  enabled: boolean;
  /** The interview's recording consent; coach and job-ask send none. */
  consent?: { version: string; accepted: boolean } | null;
  /** An agent turn finished, or a connected call ended: what the server stored has moved on. */
  onTurnSettled?: () => void;
  onEnded?: (ended: VoiceConversationEnded) => void;
}

export interface VoiceConversationEnded {
  conversationId: string | null;
  /** Whether the call ever connected. */
  connected: boolean;
  problem: TalkProblem | null;
}

export interface VoiceConversation {
  state: TalkPhase;
  problem: TalkProblem | null;
  agentSpeaking: boolean;
  /** Whether start() would do anything now. */
  canStart: boolean;
  start: () => void;
  end: () => void;
  /** For a `conflict` problem: hangs up the other call, then starts this one. Once. */
  endOtherCall: () => void;
  reset: () => void;
  /** The live call's mic and agent spectra, for a visualizer to read each frame; null without a session. */
  getInputFrequencyData: () => Uint8Array | null;
  getOutputFrequencyData: () => Uint8Array | null;
  userCaption: string;
  agentCaption: string;
  /** Seconds left before the call's ceiling; null until minted. */
  remainingSeconds: number | null;
  elapsedMs: number;
  conversationId: string | null;
}

interface Call {
  targetId: string;
  clock: SessionClock;
  conversationId: string | null;
  session: EngineSession | null;
  connected: boolean;
  hangingUp: boolean;
  ended: boolean;
  released: boolean;
  engineError: EngineErrorCode | null;
  /** The browser itself cannot run the engine's client (P16): another browser can, a retry here cannot. */
  unsupported: boolean;
}

const newCall = (targetId: string): Call => ({
  targetId,
  clock: createSessionClock(),
  conversationId: null,
  session: null,
  connected: false,
  hangingUp: false,
  ended: false,
  released: false,
  engineError: null,
  unsupported: false,
});

/** Only asks for permission; the engine opens its own capture once connected. */
async function preflightMic(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("No microphone API");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of stream.getTracks()) track.stop();
}

/** The call's ceiling, capped by today's remaining minutes when the mint knew them. */
const limitOf = (minted: MintVoiceConversationResult): number =>
  minted.remainingSeconds > 0 ? Math.min(minted.maxDurationSeconds, minted.remainingSeconds) : minted.maxDurationSeconds;

const problemForEngine = (code: EngineErrorCode | null, connected: boolean, unsupported = false): TalkProblem =>
  unsupported ? { kind: "unavailable", browser: true } : code === "mic" ? { kind: "mic" } : { kind: connected ? "dropped" : "unavailable" };

const release = (call: Call) => {
  if (!call.conversationId || call.released) return;
  call.released = true;
  void releaseConversation(call.conversationId).catch(() => undefined);
};

export function useVoiceConversation({ feature, targetId, enabled, consent = null, onTurnSettled, onEnded }: VoiceConversationOptions): VoiceConversation {
  const [talk, dispatch] = useReducer(talkReducer, INITIAL_TALK_STATE);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [seenTarget, setSeenTarget] = useState(targetId);
  const callRef = useRef<Call | null>(null);
  const latest = useRef({ feature, targetId, enabled, consent, onTurnSettled, onEnded });

  useEffect(() => {
    latest.current = { feature, targetId, enabled, consent, onTurnSettled, onEnded };
  });

  // A problem belongs to the target it happened on.
  if (seenTarget !== targetId) {
    setSeenTarget(targetId);
    if (!isTalkActive(talk.phase)) dispatch({ type: "reset" });
  }

  const finish = useCallback((call: Call, problem: TalkProblem | null, event?: TalkEvent) => {
    if (call.ended) return;
    call.ended = true;
    if (callRef.current === call) callRef.current = null;
    if (call.session && !call.hangingUp) void call.session.end();
    release(call);
    dispatch(event ?? (problem ? { type: "failed", problem } : { type: "ended" }));
    if (call.connected) latest.current.onTurnSettled?.();
    latest.current.onEnded?.({ conversationId: call.conversationId, connected: call.connected, problem });
  }, []);

  const run = useCallback(
    async (call: Call, releaseFirst: string | null) => {
      const { feature, consent } = latest.current;
      try {
        await preflightMic();
      } catch {
        finish(call, { kind: "mic" }, { type: "micFailed" });
        return;
      }
      if (call.ended) return;
      dispatch({ type: "micOk" });

      if (releaseFirst) await releaseConversation(releaseFirst).catch(() => undefined);
      if (call.ended) return;

      let minted: MintVoiceConversationResult;
      try {
        minted = await mintConversation({ feature, targetId: call.targetId, ...(consent ? { consent } : {}) });
      } catch (error) {
        const refusal = mintFailureOf(mintRefusalOf(error), error instanceof VoiceRequestError ? error.status : null);
        finish(call, refusal, { type: "mintFailed", ...refusal });
        return;
      }
      call.conversationId = minted.conversationId;
      if (call.ended) {
        release(call);
        return;
      }
      dispatch({ type: "minted", conversationId: minted.conversationId, limitSeconds: limitOf(minted) });

      const connected = () => {
        if (call.connected || call.ended) return;
        call.connected = true;
        call.clock.start();
        dispatch({ type: "connected" });
      };
      const starting = startEngine({
        signedUrl: minted.signedUrl,
        firstMessage: minted.firstMessage,
        clock: call.clock,
        onAgentSpeakStart: () => {
          if (!call.ended) dispatch({ type: "agentSpeaking", speaking: true });
        },
        onAgentSpeakEnd: () => {
          if (call.ended || call.hangingUp) return;
          dispatch({ type: "agentSpeaking", speaking: false });
          latest.current.onTurnSettled?.();
        },
        onAgentText: (text) => {
          if (!call.ended) dispatch({ type: "agentCaption", text });
        },
        onUserText: (text) => {
          if (!call.ended) dispatch({ type: "userCaption", text });
        },
        onInterrupted: () => undefined,
        onStatus: (status) => {
          if (status === "connected") connected();
          // Before startEngine returns, a disconnect is its failure, handled below.
          else if (status === "disconnected" && call.session)
            finish(call, call.hangingUp || !call.engineError ? null : problemForEngine(call.engineError, call.connected, call.unsupported));
        },
        onError: ({ code, fatal, unsupported }) => {
          if (!fatal || call.ended) return;
          call.engineError ??= code;
          call.unsupported ||= !!unsupported;
          if (call.session) finish(call, problemForEngine(code, call.connected, call.unsupported));
        },
      });
      let connectTimer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        starting,
        new Promise<"timeout">((resolve) => {
          connectTimer = setTimeout(() => resolve("timeout"), ENGINE_CONNECT_TIMEOUT_MS);
        }),
      ]);
      clearTimeout(connectTimer);
      if (outcome === "timeout") {
        // Past the deadline: a call that connects later is hung up at once.
        void starting.then((late) => late?.end());
        finish(call, { kind: "unavailable" });
        return;
      }
      const session = outcome;
      if (!session) {
        finish(call, problemForEngine(call.engineError, false, call.unsupported));
        return;
      }
      if (call.ended) {
        void session.end();
        return;
      }
      call.session = session;
      connected();
    },
    [finish],
  );

  const begin = useCallback(
    (releaseFirst: string | null) => {
      const { targetId, enabled } = latest.current;
      if (!enabled || !targetId || callRef.current) return;
      const call = newCall(targetId);
      callRef.current = call;
      setElapsedMs(0);
      dispatch({ type: "start" });
      void run(call, releaseFirst).catch(() => finish(call, { kind: "unavailable" }));
    },
    [run, finish],
  );

  const start = useCallback(() => begin(null), [begin]);

  const end = useCallback(() => {
    const call = callRef.current;
    if (!call || call.hangingUp) return;
    const session = call.session;
    if (!session) {
      finish(call, null);
      return;
    }
    call.hangingUp = true;
    dispatch({ type: "end" });
    void session.end().finally(() => finish(call, null));
  }, [finish]);

  const conflictId = talk.problem?.kind === "conflict" ? (talk.problem.conflict?.conversationId ?? null) : null;
  const endOtherCall = useCallback(() => {
    if (conflictId) begin(conflictId);
  }, [begin, conflictId]);

  const reset = useCallback(() => {
    if (!callRef.current) dispatch({ type: "reset" });
  }, []);

  // A different target or talk switched off: this call is over.
  useEffect(() => {
    const call = callRef.current;
    if (call && (!enabled || call.targetId !== targetId)) finish(call, null, call.targetId !== targetId ? { type: "reset" } : undefined);
  }, [enabled, targetId, finish]);

  useEffect(() => {
    return () => {
      const call = callRef.current;
      if (call) finish(call, null);
    };
  }, [finish]);

  useEffect(() => {
    const onPageHide = () => {
      const call = callRef.current;
      if (!call) return;
      if (call.conversationId && !call.released) {
        call.released = true;
        beaconRelease(call.conversationId);
      }
      void call.session?.end();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  useEffect(() => {
    const call = callRef.current;
    if (talk.phase !== "live" || !call) return;
    const timer = setInterval(() => setElapsedMs(call.clock.now()), 1_000);
    return () => clearInterval(timer);
  }, [talk.phase]);

  const getInputFrequencyData = useCallback(() => callRef.current?.session?.getInputByteFrequencyData() ?? null, []);
  const getOutputFrequencyData = useCallback(() => callRef.current?.session?.getOutputByteFrequencyData() ?? null, []);

  const remainingSeconds = talk.limitSeconds === null ? null : Math.max(0, talk.limitSeconds - Math.floor(elapsedMs / 1_000));

  return {
    state: talk.phase,
    problem: talk.problem,
    agentSpeaking: talk.agentSpeaking,
    canStart: canStartTalk(enabled, targetId, talk.phase),
    start,
    end,
    endOtherCall,
    reset,
    getInputFrequencyData,
    getOutputFrequencyData,
    userCaption: talk.userCaption,
    agentCaption: talk.agentCaption,
    remainingSeconds,
    elapsedMs,
    conversationId: talk.conversationId,
  };
}
