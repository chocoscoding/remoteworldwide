"use client";

// The live interview, voice or typed.
//
// Both kinds are saved sessions in the AI service: created when the screen
// starts, finished when it ends, then read back on the report route by their
// server id. Only when the create fails does the session run as before, in
// memory, with a banner saying it will not be kept.
//
// A voice session records. useInterviewCapture owns the mic, the recording,
// the live captions and the turn times; useVoiceSession is used only for the
// interviewer's voice (speak, cancelSpeech, aiSpeaking). The interviewer's
// speech starting and stopping marks its turn on the session clock (a question
// that is never read aloud counts from when it went up), the send closes the
// answer window, and speaking over the interviewer stops it and is recorded as
// a barge-in.
//
// A typed session records nothing. Answers are typed or dictated through the
// browser's own speech recognition (useVoiceSession), and turn times are kept
// on the capture's clock all the same.

import { FC, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUp, CloudUpload, Headphones, Loader2, Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pickQuestionsForSession, type SessionInput } from "@/app/lib/dashboard/prep-engine";
import { formatsLabel, type PrepTrack, type QuestionBankEntry, type TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { PREP_BILLING_HREF, getQuestionSpeech, insufficientCreditsOf, limitedOf, openSessionOf } from "@/app/lib/voice/api";
import { formatClock as formatRecordingClock } from "@/app/lib/voice/format";
import { PREP_LIMITS, type CreatePrepSessionInput, type CreatePrepSessionResult, type EndReason, type PrepSessionMode, type PrepSnapshot, type TurnSource } from "@/app/lib/voice/types";
import { questionPresetFor, type SessionConfig } from "./PrepSetup";
import RecordingConsent, { clearConsentHandoff, peekConsentHandoff } from "./RecordingConsent";
import { useVoiceSession } from "@/app/components/dashboard/voice/useVoiceSession";
import { useInterviewCapture, type CapEndReason, type CaptureCaption, type CaptureTurn } from "@/app/components/dashboard/voice/useInterviewCapture";
import type { OrbState } from "orb-ui";
import PrepOrb from "./PrepOrb";
import InterviewTranscript, { type TranscriptEntry } from "./InterviewTranscript";
import TypeAnswerPanel from "./TypeAnswerPanel";
import { usePrepSessionMutations } from "@/hooks/mutations/usePrepSessionMutations";
import { usePrepVoiceConfig } from "@/hooks/queries/usePrepVoiceConfig";

export interface PrepLiveProps {
  track: PrepTrack;
  config: SessionConfig;
  /** The in-memory report. Used only when the session could not be saved in the AI service. */
  onEnd: (input: SessionInput) => void;
  /** Opens a saved session's report: this one once it is finished, or the one a conflict says is still open. */
  onSaved?: (serverId: string) => void;
  /** Leaves without a report: the session ended before any answer and was deleted, or never started. */
  onExit?: () => void;
  /** A voice session that cannot start (the mic, credits, a daily limit) can carry on as a typed one. */
  onSwitchToTyped?: () => void;
}

type Phase = "connecting" | "active" | "thinking" | "saving" | "done";

/**
 * - `idle`: waiting for the go-ahead (a voice session needs consent first).
 * - `starting`: asking for the mic and creating the session.
 * - `saved`: the service has the session; this screen finishes it.
 * - `local`: the create failed; the session runs in memory and is not kept.
 * - `refused`: a voice session could not start; the screen says why and offers a way on.
 */
type StartState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "saved"; serverId: string }
  | { kind: "local"; reason: string }
  | { kind: "refused"; problem: "consent" | "mic" | "capture" | "credits" | "open" | "limited" | "other"; message: string; openSessionId?: string };

type Refusal = Omit<Extract<StartState, { kind: "refused" }>, "kind">;

/** A turn on this screen: the transcript's shape plus what the service is told about how it was given. */
interface LiveTurn extends TranscriptTurn {
  source: TurnSource;
  /** The captions (or dictation) as shown, before any edit. */
  liveText?: string;
}

type AutoSend = null | { kind: "hint" } | { kind: "countdown"; seconds: number };

// Send-after-silence, in milliseconds: animation frames come at the display's
// rate, 60 to 144 a second, so counting them made the wait depend on the screen.
/** Mic level above which the user counts as speaking. */
const SPEAKING_LEVEL = 0.12;
/** Quiet before the "Sending when you stop" hint shows. */
const HINT_AFTER_MS = 500;
/** Quiet before the answer is sent. */
const SEND_AFTER_MS = 2_000;
/** Time the last dictated words get on screen before the answer holding them is sent. */
const SETTLE_AFTER_FINAL_MS = 600;
/** A voice answer the captions caught nothing of is still sent after this much quiet: the recording is the answer. */
const SEND_WITHOUT_TEXT_MS = 5_000;
/** Without captions (Firefox), the quiet that sends an answer, counted down on screen. */
const NO_CAPTION_SEND_MS = 3_000;
/** A voice answer is not sent on silence while the user is fixing its captions. */
const TYPING_HOLD_MS = 4_000;
/** Speech that has not started this long after it was asked for (voice off, a blocked engine): the question counts as read. */
const SPEECH_START_TIMEOUT_MS = 2_000;
/** A caption that began this long before the interviewer stopped is the interviewer, heard through the speakers. */
const CAPTION_OVERLAP_MS = 500;
/** The snapshot's text limits, as the AI service validates them. */
const SNAPSHOT_TEXT_MAX = 200;
const QUESTION_TEXT_MAX = 1_000;

const HINT: AutoSend = { kind: "hint" };

const subscribeNoop = () => () => {};

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatClock(totalSeconds: number): string {
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
}

function aiTurn(id: string, q: QuestionBankEntry, spoken: boolean): LiveTurn {
  return { id, who: "ai", text: q.text, questionId: q.id, source: spoken ? "voice" : "typed" };
}

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/** The service's messages carry no closing stop; one is added before another sentence follows. */
const asSentence = (text: string) => {
  const trimmed = text.trim();
  return !trimmed || /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/**
 * How an answer was given. Unedited captions are `voice`; captions the user
 * changed are `mixed`; text with no captions behind it is `typed`; and a
 * spoken answer the captions caught nothing of is still `voice`.
 */
function sourceFor(text: string, liveText: string): TurnSource {
  const said = squash(liveText);
  if (!said) return text.trim() ? "typed" : "voice";
  return squash(text) === said ? "voice" : "mixed";
}

function toCaptureTurn(turn: LiveTurn): CaptureTurn {
  const out: CaptureTurn = { id: turn.id, who: turn.who, text: turn.text, source: turn.source };
  if (turn.questionId) out.questionId = turn.questionId;
  if (turn.liveText) out.liveText = turn.liveText;
  return out;
}

/**
 * The setup as the service stores it. The question list is a set: the bank
 * cycles for long sessions, so a question can be asked twice, but the
 * snapshot names each once (the service refuses repeats).
 */
function snapshotFor(track: PrepTrack, config: SessionConfig, questions: QuestionBankEntry[]): PrepSnapshot {
  const seen = new Set<string>();
  const unique = questions.filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
  return {
    trackId: track.id,
    trackSnapshot: {
      company: track.company.slice(0, SNAPSHOT_TEXT_MAX),
      role: track.role.slice(0, SNAPSHOT_TEXT_MAX),
      roundLabel: track.roundLabel.slice(0, SNAPSHOT_TEXT_MAX),
    },
    formats: config.formats,
    difficulty: config.difficulty,
    lengthMinutes: config.lengthMinutes,
    questions: unique.slice(0, PREP_LIMITS.questionsMax).map((q) => ({ id: q.id, text: q.text.slice(0, QUESTION_TEXT_MAX) })),
  };
}

/** A refusal the service will repeat, as opposed to the service being unreachable. */
function isRefusal(error: unknown): error is BackendError {
  return error instanceof BackendError && ((error.status >= 400 && error.status < 500) || error.status === 503);
}

const PrepLive: FC<PrepLiveProps> = ({ track, config, onEnd, onSaved, onExit, onSwitchToTyped }) => {
  const mode: PrepSessionMode = config.mode ?? "text";
  const voiceMode = mode === "voice";
  // A shorter session the balance covers asks the largest question set that fits.
  const [questions] = useState(() =>
    pickQuestionsForSession(
      config.formats,
      questionPresetFor(Math.min(config.lengthMinutes, config.capMinutes ?? config.lengthMinutes)),
      `${track.id}-${config.formats.join(",")}-${config.lengthMinutes}`
    )
  );
  const [phase, setPhase] = useState<Phase>("connecting");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState<LiveTurn[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  // Open by default: in a spoken interview this is the only record of what
  // was actually heard, and a misheard answer has to be visible without
  // going looking for it.
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [start, setStart] = useState<StartState>({ kind: "idle" });
  const [startAsked, setStartAsked] = useState(false);
  const [consentTicked, setConsentTicked] = useState(false);
  const [autoSend, setAutoSend] = useState<AutoSend>(null);
  const [endNote, setEndNote] = useState<string | null>(null);

  const idSeq = useRef(0);
  const nextTurnId = () => `turn-${idSeq.current++}`;

  // Mirrors of state for callbacks that outlive a render (timers, the mic
  // level loop, the capture's own calls back into this screen).
  const aliveRef = useRef(true);
  const phaseRef = useRef<Phase>(phase);
  const startRef = useRef<StartState>(start);
  const transcriptRef = useRef<LiveTurn[]>(transcript);
  const draftRef = useRef(draft);
  const aiSpeakingRef = useRef(false);
  /** The captions or dictation that went into the current answer. */
  const liveTextRef = useRef("");
  /** The interviewer turn now on the table. */
  const aiTurnRef = useRef<string | null>(null);
  /** When that question went up, on the session clock: its turn's start and end if it is never read aloud. */
  const askedAtRef = useRef(0);
  /** The current question's speech has started at least once. */
  const aiSpokeRef = useRef(false);
  /** The user has spoken since the current question. */
  const heardRef = useRef(false);
  /** The id given to an answer still in progress when the session had to end. */
  const pendingAnswerRef = useRef<{ index: number; id: string } | null>(null);
  const finishingRef = useRef(false);
  const typedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const submitRef = useRef<() => void>(() => {});
  const startSessionRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // The capture calls these; an effect points them at this render's handlers.
  const onFinalRef = useRef<(caption: CaptureCaption) => void>(() => {});
  const onBargeInRef = useRef<() => void>(() => {});
  const onCapRef = useRef<(reason: CapEndReason) => void>(() => {});
  const getTurnsRef = useRef<() => CaptureTurn[]>(() => []);

  const { create, finish: finishMutation, delete: removeMutation } = usePrepSessionMutations();
  const voiceConfig = usePrepVoiceConfig();

  const capture = useInterviewCapture({
    onFinal: (caption) => onFinalRef.current(caption),
    onBargeIn: () => onBargeInRef.current(),
    onCap: (reason) => onCapRef.current(reason),
    getTurns: () => getTurnsRef.current(),
    finish: (id, body) => finishMutation.mutateAsync({ id, body }),
    remove: (id) => removeMutation.mutateAsync(id),
  });
  const { markAiStart, markAiEnd, markAnswer, timesOf, now: captureNow, end: endCapture, discard, onLevel: onCaptureLevel } = capture;

  const recording = voiceMode && start.kind === "saved";
  const captionsLive = capture.captions === "live";

  // Dictated speech (typed sessions) and live captions (voice sessions) land
  // in the same draft box as typing, so every input converges before submit
  // and the rest of the flow stays identical.
  const handleTranscript = useCallback((text: string) => {
    const said = text.trim();
    if (!said) return;
    liveTextRef.current = liveTextRef.current ? `${liveTextRef.current} ${said}` : said;
    setDraft((prev) => (prev ? `${prev.trimEnd()} ${said}` : said));
  }, []);

  const voice = useVoiceSession({ onTranscript: handleTranscript, voiceEnabled: voiceOn });
  const {
    speak,
    cancelSpeech,
    stopDictation,
    startDictation,
    micStatus,
    aiSpeaking,
    dictationSupported,
    interim: dictationInterim,
    finalizing: dictationFinalizing,
    onLevel: dictationLevel,
  } = voice;

  const listening = micStatus === "listening";
  // A start still waiting on the mic prompt can be called off with the same button.
  const requesting = micStatus === "requesting";
  const currentQuestion = questions[questionIndex];

  /**
   * Where the interviewer's voice comes from for one question: the service
   * synthesizes it once and serves it from storage. Null — no session of ours
   * to ask, or no provider configured — leaves the browser to speak it, which
   * is also what a local (unsaved) session gets.
   */
  const resolveQuestionAudio = useCallback(
    (questionId: string) => async (): Promise<string | null> => {
      if (start.kind !== "saved") return null;
      const link = await getQuestionSpeech(start.serverId, questionId).catch(() => null);
      return link?.url ?? null;
    },
    [start],
  );
  const totalSeconds = config.lengthMinutes * 60;
  const interim = recording ? capture.interim : dictationInterim;
  const finalizing = recording ? capture.finalizing : dictationFinalizing;

  // The consent ticked on the setup screen reaches this page through
  // sessionStorage, which the server render cannot read: until hydration the
  // screen shows "connecting" rather than flashing the consent card.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const handoffVersion = useSyncExternalStore(subscribeNoop, () => (voiceMode ? peekConsentHandoff(track.id) : null), () => null);
  const tickedVersion = consentTicked ? (voiceConfig.data?.consentVersion ?? null) : null;
  const consentVersion = handoffVersion ?? tickedVersion;
  const wantsStart = hydrated && start.kind === "idle" && (!voiceMode || handoffVersion !== null || startAsked);
  const showPrecall = voiceMode && hydrated && (start.kind === "refused" || (start.kind === "idle" && handoffVersion === null && !startAsked));
  const ready = start.kind === "saved" || start.kind === "local";

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
    startRef.current = start;
    transcriptRef.current = transcript;
    draftRef.current = draft;
    aiSpeakingRef.current = aiSpeaking;
  });

  // ---------------------------------------------------------------------------
  // Starting
  // ---------------------------------------------------------------------------

  function refuse(refusal: Refusal) {
    if (refusal.problem === "consent") setConsentTicked(false);
    setStartAsked(false);
    setStart({ kind: "refused", ...refusal });
  }

  async function startSession() {
    const current = startRef.current.kind;
    if (current !== "idle") return;
    // Held here too, so a second call before the next render cannot start twice.
    startRef.current = { kind: "starting" };
    setStart({ kind: "starting" });

    const prep = snapshotFor(track, config, questions);
    let input: CreatePrepSessionInput;
    if (voiceMode) {
      const version = consentVersion;
      if (!version) {
        refuse({ problem: "consent", message: "Tick the recording consent to start." });
        return;
      }
      // The mic first: a refusal here should cost no session.
      const micOk = await capture.requestMic();
      if (!aliveRef.current) return;
      if (!micOk) {
        refuse({ problem: "mic", message: "" });
        return;
      }
      input = { mode: "voice", prep, consent: { version, accepted: true } };
    } else {
      input = { mode: "text", prep };
    }

    let result: CreatePrepSessionResult;
    try {
      result = await create.mutateAsync(input);
    } catch (error) {
      if (!aliveRef.current) return;
      capture.releaseMic();
      if (voiceMode && isRefusal(error)) {
        const open = openSessionOf(error);
        const credits = insufficientCreditsOf(error);
        const limited = limitedOf(error);
        // A stale consent version is refused with a 400: ask for the tick again.
        const consentProblem = error.status === 400;
        if (consentProblem) clearConsentHandoff();
        refuse({
          problem: open ? "open" : credits ? "credits" : limited ? "limited" : consentProblem ? "consent" : "other",
          message: apiMessage(error),
          ...(open ? { openSessionId: open.sessionId } : {}),
        });
        return;
      }
      // The service could not be reached, or refused a typed session: carry on, unsaved.
      setStart({ kind: "local", reason: apiMessage(error) });
      return;
    }

    if (voiceMode) clearConsentHandoff();
    if (!aliveRef.current) {
      // The screen closed while the session was being created: nothing will use it.
      void removeMutation.mutateAsync(result.session.id).catch(() => {});
      return;
    }
    const begun = await capture.begin({ config: result });
    // Closed meanwhile: the capture's own unmount deleted the session.
    if (!aliveRef.current) return;
    if (!begun.ok) {
      await discard();
      if (!aliveRef.current) return;
      if (voiceMode) refuse({ problem: "capture", message: begun.error });
      else setStart({ kind: "local", reason: begun.error });
      return;
    }
    setStart({ kind: "saved", serverId: result.session.id });
  }

  useEffect(() => {
    startSessionRef.current = startSession;
  });

  // Started from a timer so StrictMode's double effect run starts it once.
  useEffect(() => {
    if (!wantsStart) return;
    const t = setTimeout(() => void startSessionRef.current(), 0);
    return () => clearTimeout(t);
  }, [wantsStart]);

  function retryStart() {
    setStart({ kind: "idle" });
    setStartAsked(true);
  }

  // A page restored after the tab was hidden for good: the session was finished by beacon.
  useEffect(() => {
    if (!capture.interrupted || start.kind !== "saved" || !onSaved) return;
    onSaved(start.serverId);
  }, [capture.interrupted, start, onSaved]);

  // ---------------------------------------------------------------------------
  // The interview
  // ---------------------------------------------------------------------------

  // An interviewer turn starts when its speech does (below). These two fill
  // the gaps, and both are no-ops for a turn the speech already marked.

  /** The question has a start: its speech's, or when it went up if no speech has begun. */
  function ensureAiStart(turnId: string) {
    markAiStart(turnId, askedAtRef.current);
  }

  /** The question's turn is over: now if it was read aloud, or where it went up if it never was. */
  function endAiTurn(turnId: string, bargedIn = false) {
    const spoke = aiSpokeRef.current || aiSpeakingRef.current;
    ensureAiStart(turnId);
    markAiEnd(turnId, { bargedIn, ...(spoke ? {} : { atMs: askedAtRef.current }) });
  }

  function ask(index: number) {
    const question = questions[index];
    if (!question) return;
    // A question still being read when the next one comes (a typed answer
    // sent over it) ends here, where the new question's speech cuts it off.
    const previous = aiTurnRef.current;
    if (previous) endAiTurn(previous);
    const id = nextTurnId();
    aiTurnRef.current = id;
    askedAtRef.current = captureNow();
    aiSpokeRef.current = false;
    heardRef.current = false;
    liveTextRef.current = "";
    setTranscript((prev) => [...prev, aiTurn(id, question, recording)]);
    setQuestionIndex(index);
    setPhase("active");
  }

  // Connecting -> first question, once the session exists (or runs unsaved).
  useEffect(() => {
    if (phase !== "connecting" || !ready) return;
    const t = setTimeout(() => ask(0), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ready]);

  // Thinking -> next question.
  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setTimeout(() => ask(questionIndex + 1), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIndex]);

  // Read each new question aloud as it arrives. The question's turn starts and
  // ends with the speech (below); with the voice off, or speech that never
  // starts, it is a moment at the time the question went up.
  useEffect(() => {
    if (phase !== "active" || !currentQuestion) return;
    speak(currentQuestion.text, resolveQuestionAudio(currentQuestion.id));
    const turnId = aiTurnRef.current;
    if (!turnId) return;
    if (!voiceOn) {
      endAiTurn(turnId);
      return;
    }
    const t = setTimeout(() => {
      if (aiSpokeRef.current || aiTurnRef.current !== turnId) return;
      if (aiSpeakingRef.current) {
        // Speaking, though the change was never seen: the old question's end
        // and this one's start landed in the same render.
        aiSpokeRef.current = true;
        ensureAiStart(turnId);
        return;
      }
      endAiTurn(turnId);
    }, SPEECH_START_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIndex]);

  // The interviewer's speech starting opens its turn; stopping (finished,
  // muted, or talked over) ends it.
  useEffect(() => {
    const turnId = aiTurnRef.current;
    if (aiSpeaking) {
      aiSpokeRef.current = true;
      if (turnId) markAiStart(turnId);
      return;
    }
    if (aiSpokeRef.current && turnId) endAiTurn(turnId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSpeaking, markAiStart]);

  // Elapsed timer for unrecorded sessions — advanced by the interval callback,
  // never Date.now() in render. A recording's clock comes from the capture.
  useEffect(() => {
    if (recording || phase === "connecting" || phase === "done" || phase === "saving") return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase, recording]);

  function buildInput(finalTranscript: TranscriptTurn[]): SessionInput {
    return { trackId: track.id, formats: config.formats, difficulty: config.difficulty, lengthMinutes: config.lengthMinutes, transcript: finalTranscript, elapsedSeconds };
  }

  /** The answer to the current question, its window closed now. */
  function answerTurn(text: string, live: string): LiveTurn {
    const pending = pendingAnswerRef.current;
    const id = pending && pending.index === questionIndex ? pending.id : nextTurnId();
    pendingAnswerRef.current = { index: questionIndex, id };
    // The window opens where the question's turn ended, or began if it is still
    // being read, so the question needs a start even if its speech never came.
    if (aiTurnRef.current) ensureAiStart(aiTurnRef.current);
    markAnswer(id);
    const turn: LiveTurn = { id, who: "user", text, questionId: questions[questionIndex]?.id, source: sourceFor(text, live) };
    if (live) turn.liveText = live;
    const times = timesOf(id);
    if (times?.startMs !== undefined) turn.startMs = times.startMs;
    if (times?.endMs !== undefined) turn.endMs = times.endMs;
    return turn;
  }

  /** The transcript plus the answer being given, for a session that has to end now. */
  function withPendingAnswer(): LiveTurn[] {
    const turns = transcriptRef.current;
    if (phaseRef.current !== "active") return turns;
    const text = draftRef.current.trim();
    const live = liveTextRef.current.trim();
    const spoke = recording && heardRef.current;
    if (!text && !live && !spoke) return turns;
    return [...turns, answerTurn(text, live)];
  }

  async function finishSession(reason: EndReason, finalTranscript: LiveTurn[]) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    stopDictation();
    // The question on the table ends with the session, before its speech is cut.
    if (aiTurnRef.current) endAiTurn(aiTurnRef.current);
    cancelSpeech();

    const current = startRef.current;
    if (current.kind !== "saved") {
      setPhase("done");
      onEnd(buildInput(finalTranscript));
      return;
    }

    const answered = finalTranscript.some((turn) => turn.who === "user");
    const atCap = reason === "credit-limit" || reason === "time-limit";
    if (!answered && !atCap) {
      // Nothing to grade and nothing worth keeping: the session and any audio go.
      setPhase("done");
      await discard();
      toast("The session ended before any answers, so nothing was saved.");
      if (!aliveRef.current) return;
      if (onExit) onExit();
      else onEnd(buildInput(finalTranscript));
      return;
    }

    setPhase("saving");
    const result = await endCapture(reason, finalTranscript.map(toCaptureTurn));
    if (!result.saved) toast.error("We couldn't confirm your session was saved. It will finish processing shortly; check this track's sessions.");
    if (!aliveRef.current) return;
    setPhase("done");
    if (onSaved) onSaved(current.serverId);
    else onEnd(buildInput(finalTranscript));
  }

  /**
   * Send the answer on the table. `submitAnswer` is wired straight to onClick,
   * so it must take no argument — a React MouseEvent would arrive as the text.
   * Anything with its own text (the typed composer) calls `commitAnswer`.
   */
  function submitAnswer() {
    commitAnswer(draft);
  }

  function commitAnswer(raw: string) {
    if (phase !== "active" || finishingRef.current) return;
    const text = raw.trim();
    const live = liveTextRef.current.trim();
    // A spoken answer needs no text: the recording is the answer, and the
    // transcript fills it in. A typed session moves on without one, as before.
    const answer = recording || text ? answerTurn(text, live) : null;
    if (recording && aiTurnRef.current) {
      // Sent while the question was still being read (or before it began): the
      // question stops here. The answer is marked first, so its window still
      // covers what was said over the question.
      cancelSpeech();
      endAiTurn(aiTurnRef.current);
    }
    pendingAnswerRef.current = null;
    const withAnswer = answer ? [...transcript, answer] : transcript;
    setTranscript(withAnswer);
    setDraft("");
    liveTextRef.current = "";
    heardRef.current = false;
    // The mic deliberately stays open between questions — hanging up after
    // every answer is what made this feel like texting rather than a call.
    if (questionIndex >= questions.length - 1) void finishSession("completed", withAnswer);
    else setPhase("thinking");
  }

  function endNow() {
    const current = startRef.current.kind;
    if ((current === "idle" || current === "refused" || current === "starting") && onExit) {
      onExit();
      return;
    }
    void finishSession("ended-early", recording ? withPendingAnswer() : transcript);
  }

  // ---------------------------------------------------------------------------
  // What the capture calls back into
  // ---------------------------------------------------------------------------

  /** A finished live caption: into the draft, unless it is the interviewer heard through the speakers. */
  function handleCaption(caption: CaptureCaption) {
    if (phaseRef.current !== "active" || aiSpeakingRef.current) return;
    const turnId = aiTurnRef.current;
    const aiEnd = turnId ? timesOf(turnId)?.endMs : undefined;
    if (caption.startMs !== null && aiEnd !== undefined && caption.startMs < aiEnd - CAPTION_OVERLAP_MS) return;
    handleTranscript(caption.text);
  }

  /** Sustained speech while the interviewer talks: they stop, as a real one would. */
  function handleBargeIn() {
    if (!aiSpeakingRef.current || phaseRef.current !== "active") return;
    cancelSpeech();
    if (aiTurnRef.current) endAiTurn(aiTurnRef.current, true);
  }

  /** Recording stopped at the cap: the interviewer closes, and whatever was being answered is the last answer. */
  function handleCap(reason: CapEndReason) {
    if (finishingRef.current) return;
    const at = formatRecordingClock(capture.capMs ?? 0);
    setEndNote(reason === "credit-limit" ? `Recording stopped at ${at}, as far as your credits go.` : `Recording stopped at ${at}, the session's time limit.`);
    void finishSession(reason, withPendingAnswer());
  }

  useEffect(() => {
    submitRef.current = submitAnswer;
    onFinalRef.current = handleCaption;
    onBargeInRef.current = handleBargeIn;
    onCapRef.current = handleCap;
    getTurnsRef.current = () => withPendingAnswer().map(toCaptureTurn);
  });

  // ---------------------------------------------------------------------------
  // Sending on a pause
  // ---------------------------------------------------------------------------

  // Auto-send on a natural pause. Held in refs and driven off the mic level
  // subscription rather than state, because this runs every animation frame
  // and re-rendering the call screen at 60fps to watch for silence would be
  // absurd.
  //
  // Silence alone isn't enough. Dictated words reach the draft only once they
  // are final, which for the browser's recognition can be a moment after the
  // user stops, so sending on silence could send an answer without its last
  // sentence and leave that sentence to land in the next answer. The send waits
  // while anything spoken is still being finalised, and gives the words that
  // just landed a moment on screen.
  const finalizingRef = useRef(finalizing);
  const settledAtRef = useRef(0);
  useEffect(() => {
    finalizingRef.current = finalizing;
    if (!finalizing) settledAtRef.current = performance.now();
  }, [finalizing]);

  const spokeRef = useRef(false);
  /** When the current quiet began (performance.now()), or null while the user is speaking. */
  const quietSinceRef = useRef<number | null>(null);
  const [pausing, setPausing] = useState(false);

  // Typed sessions: while dictating.
  useEffect(() => {
    spokeRef.current = false;
    quietSinceRef.current = null;
    if (recording || !listening || phase !== "active") return;

    let armed = false;
    const arm = (next: boolean) => {
      if (next === armed) return;
      armed = next;
      setPausing(next);
    };
    const unsubscribe = dictationLevel((level) => {
      const now = performance.now();
      if (level > SPEAKING_LEVEL) {
        spokeRef.current = true;
        quietSinceRef.current = null;
        arm(false);
        return;
      }
      if (!spokeRef.current) return;
      quietSinceRef.current ??= now;
      const quietMs = now - quietSinceRef.current;
      const hasText = draftRef.current.trim() !== "";
      const waiting = finalizingRef.current;
      // Half a second of quiet shows the hint, once there is an answer to send or one on its way.
      arm(quietMs >= HINT_AFTER_MS && (hasText || waiting));
      if (quietMs < SEND_AFTER_MS || waiting || !hasText || now - settledAtRef.current < SETTLE_AFTER_FINAL_MS) return;
      spokeRef.current = false;
      quietSinceRef.current = null;
      arm(false);
      submitRef.current();
    });
    return () => {
      unsubscribe();
      if (armed) setPausing(false);
    };
  }, [recording, listening, phase, dictationLevel]);

  // Voice sessions: the mic is always open. With captions this is the same
  // rule as dictation, plus a longer wait for an answer the captions caught
  // nothing of. Without captions the level is the only sign, so the send is
  // counted down on screen and speaking again calls it off.
  useEffect(() => {
    if (!recording || phase !== "active") return;
    let spoke = false;
    let quietSince: number | null = null;
    let shown: AutoSend = null;
    const show = (next: AutoSend) => {
      const same = shown === next || (shown?.kind === "countdown" && next?.kind === "countdown" && shown.seconds === next.seconds);
      if (same) return;
      shown = next;
      setAutoSend(next);
    };
    const unsubscribe = onCaptureLevel((level) => {
      // The interviewer through the speakers is not the user answering.
      if (aiSpeakingRef.current) {
        spoke = false;
        quietSince = null;
        show(null);
        return;
      }
      const now = performance.now();
      if (level > SPEAKING_LEVEL) {
        spoke = true;
        heardRef.current = true;
        quietSince = null;
        show(null);
        return;
      }
      if (!spoke) return;
      quietSince ??= now;
      const quietMs = now - quietSince;
      if (captionsLive) {
        const waiting = finalizingRef.current;
        const hasText = draftRef.current.trim() !== "";
        show(quietMs >= HINT_AFTER_MS && (hasText || waiting) ? HINT : null);
        if (waiting || now - settledAtRef.current < SETTLE_AFTER_FINAL_MS) return;
        if (quietMs < (hasText ? SEND_AFTER_MS : SEND_WITHOUT_TEXT_MS)) return;
      } else {
        const left = Math.ceil((NO_CAPTION_SEND_MS - quietMs) / 1000);
        show(quietMs >= HINT_AFTER_MS && left > 0 ? { kind: "countdown", seconds: left } : null);
        if (quietMs < NO_CAPTION_SEND_MS) return;
      }
      if (now - typedAtRef.current < TYPING_HOLD_MS) return;
      spoke = false;
      quietSince = null;
      show(null);
      submitRef.current();
    });
    return () => {
      unsubscribe();
      if (shown) setAutoSend(null);
    };
  }, [recording, phase, captionsLive, onCaptureLevel]);

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    if (!next) cancelSpeech();
    else if (currentQuestion && phase === "active") speak(currentQuestion.text, resolveQuestionAudio(currentQuestion.id));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const micHint =
    micStatus === "denied"
      ? "Mic blocked — type your answer instead."
      : micStatus === "unsupported" || !dictationSupported
        ? "Dictation isn't available in this browser. You can still type your answers here."
        : micStatus === "unavailable"
          ? "Dictation isn't available right now. You can still type your answers here."
          : listening
            ? pausing
              ? "Sending when you stop…"
              : "Go ahead — talk over them if you want, they'll stop."
            : "Press Talk to start the conversation. Typing works too.";

  const lastQuestion = questionIndex >= questions.length - 1;
  const voiceHint =
    autoSend?.kind === "countdown"
      ? `Sending in ${autoSend.seconds}…`
      : autoSend?.kind === "hint"
        ? "Sending when you stop…"
        : aiSpeaking
          ? "Answer when you're ready — talk over them if you want, they'll stop."
          : captionsLive
            ? `Answer out loud. We move on when you pause, or press ${lastQuestion ? "Finish" : "Next question"}.`
            : `Answer out loud. We move on after 3 seconds of quiet, or press ${lastQuestion ? "Finish" : "Next question"}.`;

  const rule = voiceConfig.data?.credits;
  const includedMs = (rule?.includedMinutes ?? 10) * 60_000;
  const perExtra = rule?.perExtraMinute ?? 1;
  const pastIncluded = recording && capture.elapsedMs >= includedMs;
  const pendingParts = capture.upload.pending;
  const failedParts = capture.upload.failed;
  // A part is cut every few seconds, so one on its way is the normal state;
  // more than that means the connection is falling behind.
  const uploadBacklog = recording && failedParts === 0 && pendingParts > 1;
  const micLost = recording && (capture.micStatus === "unavailable" || capture.error !== null);
  const refusal = start.kind === "refused" ? start : null;

  // What the orb shows. Derived from the session this screen already runs
  // rather than from a provider, because this screen still owns it — see
  // PrepOrb. Order matters: a lost mic outranks whatever else is true, and the
  // interviewer speaking outranks the mic being open, because the candidate is
  // meant to be listening then.
  /** The mic that is actually open: the recorder's in a voice session, dictation's otherwise. */
  const micOpen = recording ? capture.micStatus === "live" : listening;
  const orbState: OrbState = micLost
    ? "error"
    : phase === "connecting" || phase === "saving"
      ? "connecting"
      : aiSpeaking
        ? "speaking"
        : phase === "thinking"
          ? "thinking"
          : micOpen
            ? "listening"
            : "idle";

  // The one line under the orb that says what is happening. It used to share
  // the job with a second status line below the question, which repeated
  // "Listening" a few hundred pixels further down; that line is gone and its
  // cases live here. Order is precedence: a lost mic outranks everything, and
  // an answer about to send outranks the state it is sending from.
  const orbCaption = micLost
    ? "Your mic stopped — the recording is paused"
    : phase === "saving"
      ? "Saving your session…"
      : autoSend?.kind === "countdown"
        ? `Sending in ${autoSend.seconds}…`
        : autoSend || pausing
          ? "Sending when you stop…"
          : aiSpeaking
            ? "Talk over them if you want — they'll stop"
            : phase === "thinking"
              ? "Thinking of a follow-up…"
              : micOpen
                ? "Listening to you"
                : "Your mic is off";
  // Something is about to happen on its own: the caption has to be read.
  const orbCaptionEmphasis = Boolean(autoSend) || pausing;

  /** The transcript, in the shape the panel takes. */
  const transcriptEntries: TranscriptEntry[] = transcript.map((turn, i) => ({
    id: turn.id,
    who: turn.who,
    text: turn.text,
    speaking: aiSpeaking && turn.who === "ai" && i === transcript.length - 1,
  }));

  // The service has voice interviews switched off; a create would only be refused.
  const voiceOff = voiceConfig.data?.interviewsEnabled === false;
  const needsConsent = handoffVersion === null || refusal?.problem === "consent";
  const canStartVoice = consentVersion !== null && refusal?.problem !== "open" && !voiceOff;

  const refusalText = !refusal
    ? voiceOff
      ? "Voice interviews aren't available right now. A typed session works as usual."
      : null
    : refusal.problem === "mic"
      ? (capture.error ?? "We couldn't use your microphone.")
      : refusal.problem === "open"
        ? "You already have a voice interview that is still open or being saved. Open it to see where it's up to, or practise with a typed session now."
        : refusal.problem === "consent"
          ? "Tick the recording consent to start."
          : refusal.message;

  return (
    <div className="bg-[#222325] text-white min-h-screen flex flex-col">
      {/* Call bar */}
      <div className="flex items-center gap-3.5 px-6 py-3.5 border-b border-white/10 flex-wrap flex-none">
        <span className="text-xs font-bold bg-[#e1f073] text-[#222325] rounded-md px-2.5 py-1 flex-none">{formatsLabel(config.formats)}</span>
        {recording && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70 flex-none" title="This session is being recorded">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
            Recording
          </span>
        )}
        {recording && (failedParts > 0 || uploadBacklog) && (
          <span
            role="status"
            className={cn("inline-flex items-center gap-1 text-[11px] font-bold tabular-nums flex-none", failedParts > 0 ? "text-red-300" : "text-white/55")}
            title="Your recording uploads in parts as you speak">
            <CloudUpload className="h-3.5 w-3.5" aria-hidden />
            {failedParts > 0 ? `${failedParts} part${failedParts === 1 ? "" : "s"} to re-send` : `Uploading ${pendingParts} parts`}
          </span>
        )}
        <span className="text-xs text-white/50 flex-none tabular-nums">
          {phase === "connecting" ? "Connecting…" : `Question ${Math.min(questionIndex + 1, questions.length)} of ${questions.length}`}
        </span>
        <div className="flex-1 min-w-[100px] h-1 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-[#e1f073] transition-[width] duration-300" style={{ width: `${(questionIndex / questions.length) * 100}%` }} />
        </div>
        {pastIncluded && (
          <span className="text-[11px] font-bold text-[#e1f073] border border-[#e1f073]/40 rounded-md px-2 py-0.5 flex-none">
            +{perExtra} credit{perExtra === 1 ? "" : "s"} per extra minute
          </span>
        )}
        <span className="text-xs font-bold tabular-nums flex-none">
          {recording
            ? `${formatRecordingClock(capture.elapsedMs)} / ${formatRecordingClock(capture.capMs ?? 0)}`
            : `${formatClock(elapsedSeconds)} / ${formatClock(totalSeconds)}`}
        </span>
        <div className="flex gap-2 flex-none">
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voiceOn ? "Mute interviewer" : "Unmute interviewer"}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] cursor-pointer transition-colors",
              voiceOn ? "border-white/25 hover:border-white/50" : "border-white/15 text-white/40"
            )}>
            {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={endNow}
            disabled={phase === "saving" || phase === "done"}
            className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-white px-3 py-1.5 text-xs font-bold text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none">
            <PhoneOff className="h-3.5 w-3.5" />
            End session
          </button>
        </div>
      </div>

      {/* Notices */}
      {start.kind === "local" && (
        <div role="status" className="flex items-start gap-2.5 px-6 py-2.5 bg-[#e1f073]/10 border-b border-[#e1f073]/25 text-xs text-white/80 flex-none">
          <AlertTriangle className="h-3.5 w-3.5 text-[#e1f073] flex-none mt-0.5" />
          <p>
            <b className="font-bold text-white">This session won&apos;t be saved.</b> {asSentence(start.reason)} You&apos;ll still get a scorecard at the
            end, but it disappears when you leave.
          </p>
        </div>
      )}
      {recording && capture.warning && phase !== "saving" && (
        <div role="alert" className="flex items-center gap-2.5 px-6 py-2.5 bg-[#e1f073] text-[#222325] text-xs font-bold flex-none">
          <AlertTriangle className="h-3.5 w-3.5 flex-none" />
          {capture.warning.message}
        </div>
      )}
      {micLost && phase !== "saving" && phase !== "done" && (
        <div role="alert" className="flex items-center gap-2.5 px-6 py-2.5 bg-red-500/15 border-b border-red-500/30 text-xs text-white flex-none">
          <MicOff className="h-3.5 w-3.5 text-red-400 flex-none" />
          {capture.error ?? "Your microphone stopped. End the session to save what was recorded."}
        </div>
      )}
      {recording && failedParts > 0 && phase !== "saving" && phase !== "done" && (
        <p className="px-6 py-2 text-xs text-white/55 border-b border-white/10 flex-none">
          Part of your recording hasn&apos;t uploaded yet. We&apos;ll keep trying while this tab is open.
        </p>
      )}

      {showPrecall ? (
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[480px] flex flex-col gap-4">
            <div className="text-center">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#e1f073] mb-2">Voice session</p>
              <p className="text-xl font-bold leading-snug text-balance">
                {track.company} · {formatsLabel(config.formats)}
              </p>
              <p className="text-sm text-white/50 mt-1">
                {questions.length} questions
                {config.capMinutes ? ` · recording stops at ${config.capMinutes}:00` : ""}
              </p>
            </div>

            {refusalText && (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-white/85 leading-relaxed">
                {refusalText}
                {refusal?.problem === "credits" && (
                  <>
                    {" "}
                    <Link href={PREP_BILLING_HREF} className="font-bold text-[#e1f073] underline underline-offset-2">
                      Top up
                    </Link>
                  </>
                )}
              </div>
            )}

            {needsConsent && refusal?.problem !== "open" && !voiceOff && <RecordingConsent dark checked={consentTicked} onChange={setConsentTicked} />}

            <p className="flex items-center gap-2 text-xs text-white/50">
              <Headphones className="h-3.5 w-3.5 flex-none" />
              Use headphones if you can: they keep the interviewer&apos;s voice out of your recording.
            </p>

            <div className="flex gap-2.5 flex-wrap justify-center mt-1">
              {refusal?.problem === "open" && refusal.openSessionId && onSaved && (
                <button
                  type="button"
                  onClick={() => onSaved(refusal.openSessionId as string)}
                  className="rounded-xl border-[1.5px] border-[#222325] bg-[#e1f073] px-5 py-2.5 text-sm font-bold text-[#222325] cursor-pointer shadow-[2px_2px_0_0_#ffffff] transition-[transform,box-shadow] duration-100 hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  Open that session
                </button>
              )}
              {refusal?.problem !== "open" && (
                <button
                  type="button"
                  onClick={retryStart}
                  disabled={!canStartVoice}
                  className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-[#222325] bg-[#e1f073] px-5 py-2.5 text-sm font-bold text-[#222325] cursor-pointer shadow-[2px_2px_0_0_#ffffff] transition-[transform,box-shadow] duration-100 hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-35 disabled:pointer-events-none">
                  <Mic className="h-4 w-4" />
                  {refusal ? "Try again" : "Start voice session"}
                </button>
              )}
              {onSwitchToTyped && (
                <button
                  type="button"
                  onClick={onSwitchToTyped}
                  className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold text-white cursor-pointer hover:border-white/45 transition-colors">
                  Switch to a typed session
                </button>
              )}
            </div>
          </div>
        </div>
      ) : phase === "saving" ? (
        <div role="status" className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#e1f073]" />
          <p className="text-[15px] font-bold">
            {recording
              ? pendingParts > 0
                ? `Saving your recording (${pendingParts} part${pendingParts === 1 ? "" : "s"} left)`
                : "Saving your recording…"
              : "Saving your session…"}
          </p>
          {endNote && <p className="text-sm text-white/70">{endNote}</p>}
          <p className="text-sm text-white/50 max-w-[420px]">Keep this tab open for a moment. Your report starts as soon as everything is saved.</p>
        </div>
      ) : phase === "connecting" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
          <PrepOrb state="connecting" size={150} />
          <p className="text-[15px] font-bold">{voiceMode && start.kind === "starting" ? "Starting your recording…" : "Connecting to your interviewer…"}</p>
          <p className="text-sm text-white/50">This is a practice session — keep this tab open.</p>
          {voiceMode && (
            <p className="flex items-center gap-2 text-xs text-white/45">
              <Headphones className="h-3.5 w-3.5 flex-none" />
              Use headphones if you can: they keep the interviewer&apos;s voice out of your recording.
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Left — the conversation so far. Collapsible: on a phone it stacks
              above the interviewer, and someone who wants the orb and the
              question full-height should be able to fold it away. */}
          <div
            className={cn(
              "flex min-w-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r",
              transcriptOpen ? "min-h-0 flex-1" : "flex-none"
            )}>
            <InterviewTranscript
              entries={transcriptEntries}
              interim={interim}
              pending={phase === "thinking" ? "Thinking of a follow-up…" : undefined}
              open={transcriptOpen}
              onOpenChange={setTranscriptOpen}
              tone="dark"
              fill
              className="min-h-0 flex-1"
            />
          </div>

          {/* Right — the interviewer, and the question on the table */}
          <div className="w-full lg:w-[42%] lg:max-w-[520px] flex-none flex flex-col items-center justify-center gap-7 px-8 py-10">
            <div className="flex flex-col items-center">
              <PrepOrb
                state={orbState}
                onLevel={recording ? onCaptureLevel : dictationLevel}
                micActive={micOpen}
                label="Your interviewer"
                caption={orbCaption}
                captionEmphasis={orbCaptionEmphasis}
              />
              <p className="mt-1 text-xs text-white/30">{formatsLabel(config.formats)}</p>
            </div>

            {currentQuestion && (
              <div className="text-center">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#e1f073] mb-3">Asking</p>
                <p className="text-xl font-bold leading-snug text-balance">{currentQuestion.text}</p>
                <p className="text-xs text-white/40 mt-3">{currentQuestion.sub}</p>
              </div>
            )}

            {recording && (
              <div className="flex flex-col items-center gap-1.5 text-center text-[11px] text-white/35">
                <p>
                  {captionsLive
                    ? capture.liveProvider === "web-speech"
                      ? "Live captions by your browser's speech service."
                      : "Live captions on."
                    : "No live captions here. Your answers are still recorded and transcribed for the report."}
                </p>
                <p className="flex items-center gap-1.5">
                  <Headphones className="h-3 w-3 flex-none" />
                  Headphones keep the interviewer out of your recording.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Answer bar — typing and dictation side by side, neither nested in the other */}
      {!showPrecall && (phase === "active" || phase === "thinking") && (
        <div className="border-t border-white/10 px-6 py-4 flex-none">
          {recording ? (
            <>
              <div className="mx-auto flex max-w-[1100px] items-center gap-3">
                {/* Speaking is the session. Typing is one icon that opens a
                    composer, and it warns once that a typed answer is left out
                    of the delivery scoring — which is measured from the voice. */}
                <TypeAnswerPanel
                  onSend={(text) => {
                    typedAtRef.current = performance.now();
                    commitAnswer(text);
                  }}
                  disabled={phase !== "active"}
                  // No label on the composer's submit: the button beside it
                  // already says "Next question", and both do the same thing.
                  hint={voiceHint}
                  tone="dark"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={phase !== "active"}
                  className={cn(
                    "flex-none inline-flex items-center gap-2.5 h-[52px] rounded-xl border-[1.5px] border-[#222325] bg-[#e1f073] px-5 text-sm font-bold text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out disabled:opacity-35 disabled:pointer-events-none",
                    "shadow-[2px_2px_0_0_#ffffff] hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  )}>
                  <ArrowUp className="h-4 w-4" />
                  {lastQuestion ? "Finish" : "Next question"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-end gap-3 max-w-[1100px] mx-auto">
                {/* The alternative, not the main event — so it sits left and stays quiet. */}
                <div className="flex-1 min-w-0">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={phase !== "active"}
                    rows={2}
                    placeholder={listening ? "Your words appear here as you speak…" : "…or type your answer"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitAnswer();
                      }
                    }}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/40 disabled:opacity-40 resize-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={phase !== "active" || !draft.trim()}
                  className="flex-none inline-flex items-center gap-2 h-[52px] rounded-xl border border-white/20 px-4 text-sm font-bold text-white cursor-pointer hover:border-white/45 transition-colors disabled:opacity-25 disabled:pointer-events-none">
                  <ArrowUp className="h-4 w-4" />
                  Send
                </button>

                {/* The main event. */}
                <button
                  type="button"
                  onClick={listening || requesting ? stopDictation : startDictation}
                  disabled={phase !== "active" || !dictationSupported || micStatus === "denied"}
                  aria-pressed={listening}
                  className={cn(
                    "flex-none inline-flex items-center gap-2.5 h-[52px] rounded-xl border-[1.5px] border-[#222325] px-5 text-sm font-bold cursor-pointer transition-[transform,box-shadow,background-color] duration-100 ease-out disabled:opacity-35 disabled:pointer-events-none",
                    "shadow-[2px_2px_0_0_#ffffff] hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                    listening ? "bg-white text-[#222325]" : "bg-[#e1f073] text-[#222325]"
                  )}>
                  {requesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : listening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {listening ? "Stop talking" : requesting ? "Cancel" : "Talk"}
                  {listening && (
                    <span className="flex items-center gap-[2px] ml-0.5" aria-hidden>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#222325] animate-pulse" />
                    </span>
                  )}
                </button>
              </div>
              <p className="text-xs text-white/35 mt-2.5 max-w-[1100px] mx-auto">{micHint}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PrepLive;
