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
// On the speech engine (`engine` mode) the engine asks and moves on itself; this screen only reads a `browser` opening's first question.
//
// An unsaved session records nothing, but it is still spoken: the mic opens
// with the screen and stays open, answers are dictated through the browser's
// own speech recognition (useVoiceSession) and sent once a real answer is
// followed by silence (see turnEnd.ts), and turn times are kept on the
// capture's clock all the same. Typing is the fallback — the
// same keyboard icon the other two use — for a browser without recognition and
// for a mic that was refused.
//
// In all three the candidate can mute themselves (the call bar's mic). A mute
// silences the mic and pauses nothing: a recording runs on in silence, so its
// clock and every report time stay true, and no silence loop sends on it.

import { FC, useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CloudUpload, FileText, Headphones, Loader2, Mic, MicOff, PhoneOff, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SessionInput } from "@/app/lib/dashboard/prep-engine";
import { formatsLabel, type PrepTrack, type TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import { pickSessionQuestions, type SessionQuestion } from "@/app/lib/prep/sessionQuestions";
import type { LikelyQuestion } from "@/app/lib/prep/types";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { PREP_BILLING_HREF, getQuestionSpeech, insufficientCreditsOf, limitedOf, openSessionOf } from "@/app/lib/voice/api";
import { formatClock as formatRecordingClock } from "@/app/lib/voice/format";
import { engineTurnId, hasEngineAnswer, type EngineProblem, type EngineProblemKind } from "@/app/lib/voice/capture/engineInterview";
import { problemCopy } from "@/app/lib/voice/talkState";
import { contentWords, echoesQuestion, endsOpen, quietForVoice, quietForWords } from "@/app/lib/voice/turnEnd";
import { PREP_LIMITS, type CreatePrepSessionInput, type CreatePrepSessionResult, type EndReason, type PrepInsufficientCredits, type PrepSnapshot, type PrepVoiceConfig, type TurnSource } from "@/app/lib/voice/types";
import type { InterviewOpening } from "@/app/lib/voice/conversation";
import { questionPresetFor, type SessionConfig } from "./PrepSetup";
import { useVoiceSession } from "@/app/components/dashboard/voice/useVoiceSession";
import VoiceFrequencyBars from "@/app/components/dashboard/voice/VoiceFrequencyBars";
import { INTERVIEW_MIC_CONSTRAINTS, useInterviewCapture, type CapEndReason, type CaptureCaption, type CaptureTurn } from "@/app/components/dashboard/voice/useInterviewCapture";
import type { OrbState } from "orb-ui";
import PrepOrb from "./PrepOrb";
import InterviewTranscript, { type TranscriptEntry } from "./InterviewTranscript";
import TypeAnswerPanel from "./TypeAnswerPanel";
import { usePrepSessionMutations } from "@/hooks/mutations/usePrepSessionMutations";
import { usePrepVoiceConfig } from "@/hooks/queries/usePrepVoiceConfig";
import { useVoiceConfig } from "@/hooks/queries/useVoiceConfig";

export interface PrepLiveProps {
  track: PrepTrack;
  config: SessionConfig;
  /**
   * The track's likely questions, which the interview asks in place of the
   * general bank (app/lib/prep/sessionQuestions.ts). Read once, at mount: the
   * questions are fixed for the session from its start.
   */
  likelyQuestions?: readonly LikelyQuestion[] | null;
  /** The in-memory report. Used only when the session could not be saved in the AI service. */
  onEnd: (input: SessionInput) => void;
  /** Opens a saved session's report: this one once it is finished, or the one a conflict says is still open. */
  onSaved?: (serverId: string) => void;
  /** Leaves without a report: the session ended before any answer and was deleted, or never started. */
  onExit?: () => void;
  /** Starts this screen afresh by remounting it; without it the page reloads, which loses in-memory tracks. */
  onRestart?: () => void;
}

type Phase = "connecting" | "active" | "thinking" | "saving" | "done";

/**
 * - `idle`: waiting for the voice config, whose consent version the create echoes.
 * - `starting`: asking for the mic and creating the session.
 * - `saved`: the service has the session; this screen finishes it.
 * - `local`: the create failed; the session runs in memory and is not kept.
 * - `refused`: a voice session could not start; the screen says why and offers a way on.
 *   `engine` is the speech engine interviewer refusing or failing to start.
 */
type StartState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "saved"; serverId: string }
  | { kind: "local"; reason: string }
  | {
      kind: "refused";
      problem: "mic" | "capture" | "engine" | "credits" | "open" | "limited" | "other";
      message: string;
      openSessionId?: string;
      engine?: EngineProblem;
    };

type Refusal = Omit<Extract<StartState, { kind: "refused" }>, "kind">;

/** A turn on this screen: the transcript's shape plus what the service is told about how it was given. */
interface LiveTurn extends TranscriptTurn {
  source: TurnSource;
  /** The captions (or dictation) as shown, before any edit. */
  liveText?: string;
}

/** The answer is about to be sent on silence: a warning with captions, a countdown without. */
type AutoSend = null | { kind: "warning" } | { kind: "countdown"; seconds: number };

// Send-after-silence, in milliseconds: animation frames come at the display's
// rate, 60 to 144 a second, so counting them made the wait depend on the screen.
// How long the silence is depends on how much answer there is: turnEnd.ts.
/**
 * Mic level above which the user counts as speaking. Well under micLevel's
 * SUSTAINED_LEVEL, so a sentence trailing off still counts as speech.
 */
const SPEAKING_LEVEL = 0.12;
/**
 * The warning that the answer is about to go shows only for this last stretch
 * of the silence window: long enough to say one more word, and just under the
 * longest pause the delivery model puts inside an answer (1.6 s), so an
 * ordinary pause in a long answer barely shows it. Any sound calls it off.
 */
const MOVE_ON_WARNING_MS = 1_500;
/**
 * The most one frame adds to the time spoken. Animation frames stop in a
 * background tab, and the first one back must not count the gap as speech.
 */
const MAX_FRAME_MS = 100;
/** Time the last dictated words get on screen before the answer holding them is sent. */
const SETTLE_AFTER_FINAL_MS = 600;
/** A voice answer is not sent on silence while the user is fixing its captions. */
const TYPING_HOLD_MS = 4_000;
/**
 * Speech that has not started this long after it was asked for (voice off, a
 * blocked engine): the question counts as read. Double the slowest first line
 * measured on a cold page (1.9 s), which the old 2 s only just covered.
 */
const SPEECH_START_TIMEOUT_MS = 4_000;
/** A caption that began this long before the interviewer stopped is the interviewer, heard through the speakers. */
const CAPTION_OVERLAP_MS = 500;
/**
 * How long after the interviewer goes quiet the browser's recognition may
 * still be finalising their last words, heard through the speakers. Not
 * CAPTION_OVERLAP_MS: that compares a caption's start time against the turn's
 * end, and the browser's recognition carries no times at all — only arrival,
 * and it finalises the tail of a sentence 0.5-1.5 s after the audio for it
 * stopped. It was 1.2 s, and on speakers the question's last phrase often
 * landed just past it and went in as the answer. Longer costs the candidate
 * nothing now, because inside it a final is dropped only when the mic has not
 * heard the candidate at all, or when it is the question word for word
 * (isInterviewerEcho).
 */
const ECHO_TAIL_MS = 2_500;
/**
 * After the interviewer's voice stops, the mic still hears it for a moment:
 * the speakers' own lag and the analyser's smoothing (about 170 ms to fall
 * from a loud echo to SPEAKING_LEVEL). A loud frame inside this is that, not
 * the candidate starting to answer.
 */
const ECHO_DECAY_MS = 400;
/**
 * The snapshot's track text limit, as the AI service validates it. Its
 * question limits are sessionQuestions.ts's: a question is never cut to fit,
 * because the interviewer reads the stored text out word for word.
 */
const SNAPSHOT_TEXT_MAX = 200;
/** The engine interviewer is told the user is typing at most this often; it holds off for a couple of seconds each time. */
const TYPING_SIGNAL_MS = 1_000;

const WARNING: AutoSend = { kind: "warning" };

/** Why the engine interviewer could not start, as a headline over its message. */
const ENGINE_PROBLEM_TITLE: Record<EngineProblemKind, string> = {
  mic: "Your microphone is blocked",
  unavailable: "The voice interviewer isn't available",
  conflict: "You already have a voice call open",
  session: problemCopy({ kind: "session" }),
  minutes: "You're out of voice minutes for today",
  rate: "Too many voice calls just now",
  disconnected: "The interviewer disconnected",
};

/** How an interview on the voice engine begins. A `browser` opening reads the first question out as before, so it adds nothing. */
const INTERVIEW_OPENING_NOTE: Record<InterviewOpening, string | null> = {
  greeting: "The interviewer will say hello first — say hello back to begin.",
  "first-question": "The interviewer will ask the first question as soon as you start.",
  browser: null,
};

/**
 * What is happening on the stage, decided once per render. The orb, its
 * caption and the eyebrow over the question are all lookups on this one
 * value. They used to be four derivations reading different inputs, which put
 * "Listening to you" under the orb and "Asking" over the question at the same
 * time; one variable cannot be two stages.
 */
type Stage =
  | "mic-lost"
  | "interviewer-lost"
  | "connecting"
  | "saving"
  | "moving-on"
  | "asking"
  | "thinking"
  | "voice-blocked"
  | "finished"
  | "mic-opening"
  | "answering"
  | "mic-off";

const ORB_STATE_BY_STAGE: Record<Stage, OrbState> = {
  "mic-lost": "error",
  "interviewer-lost": "error",
  connecting: "connecting",
  saving: "connecting",
  "moving-on": "listening",
  asking: "speaking",
  thinking: "thinking",
  "voice-blocked": "idle",
  finished: "listening",
  "mic-opening": "idle",
  answering: "listening",
  "mic-off": "idle",
};

/** The candidate muted themselves: said under the orb until they unmute, since nothing they say meanwhile is heard or recorded. */
const MUTED_CAPTION = "You're muted — unmute your mic to answer";

/**
 * The one line under the orb. `countdown` is the no-caption send; `off` says
 * why the mic is not open, where the session opens it by itself; `echoLoud`:
 * the interviewer is loud enough in the mic that a normal voice will not cut in;
 * `muted`: the candidate's own mute, said over a question too, whose talk-over
 * offer a muted mic cannot take up.
 */
function captionFor(stage: Stage, { countdown, off, echoLoud, muted }: { countdown: number | null; off: string | null; echoLoud: boolean; muted: boolean }): string {
  switch (stage) {
    case "mic-lost":
      return "Your mic stopped — the recording is paused";
    case "interviewer-lost":
      return "The interviewer disconnected";
    case "connecting":
      return "Connecting…";
    case "saving":
      return "Saving your session…";
    case "moving-on":
      return countdown !== null ? `Moving on in ${countdown}…` : "Moving on — keep talking to carry on";
    case "asking":
      if (muted) return MUTED_CAPTION;
      // On speakers turned up the voice is too loud in the mic for a normal
      // one to be told apart from it; promising a plain talk-over was untrue there.
      return echoLoud ? "To cut in, speak up — or use headphones" : "Talk over them if you want — they'll stop";
    case "thinking":
      return "Thinking of a follow-up…";
    case "voice-blocked":
      return "Your browser blocked the interviewer's voice — press the speaker to hear it";
    case "finished":
      return "That was the last question";
    case "mic-opening":
      return "Opening your mic…";
    case "answering":
      return "Listening to you";
    case "mic-off":
      return muted ? MUTED_CAPTION : (off ?? "Your mic is off");
  }
}

/**
 * The label over the question. The question stays up for the whole turn; only
 * this changes. While the next one is being chosen the question on screen is
 * still the one just answered, so it says so rather than "Up next" — as it
 * does once an engine interview's last question has its answer.
 */
function eyebrowFor(stage: Stage): string {
  return stage === "asking" ? "Asking" : stage === "thinking" || stage === "finished" ? "Answered" : "Your turn";
}

const creditCount = (n: number) => `${n} credit${n === 1 ? "" : "s"}`;

/** A 402 on start, with the price: the setup screen no longer shows the balance beside it. */
function creditsRefusal(credits: PrepInsufficientCredits, rule: PrepVoiceConfig["credits"]): string {
  return `You have ${creditCount(credits.balance)} — a voice session needs at least ${credits.required}. ${creditCount(rule.base)} cover up to ${rule.includedMinutes} minutes, then +${rule.perExtraMinute} for each extra minute started, charged once your report is ready.`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatClock(totalSeconds: number): string {
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
}

function aiTurn(id: string, q: SessionQuestion, spoken: boolean): LiveTurn {
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

/** Each question once, in order: the list the service stores, and the one the engine interviewer asks. */
function uniqueQuestions(questions: SessionQuestion[]): SessionQuestion[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
}

/** The question an engine interviewer's line asks ("Thanks." comes before each), or -1: the greeting, the closing line. */
function questionAskedIn(line: string, questions: readonly SessionQuestion[]): number {
  const said = squash(line);
  let found = -1;
  questions.forEach((q, i) => {
    const text = squash(q.text);
    if (text && said.includes(text) && (found < 0 || text.length > squash(questions[found].text).length)) found = i;
  });
  return found;
}

/**
 * The line under a question: what it tests. In a session otherwise written for
 * this job, a question filled in from the general bank says it is one, so it
 * does not pass for one of the job's own.
 */
function questionNote(q: SessionQuestion, tailoredSession: boolean): string {
  return tailoredSession && !q.tailored ? `General practice question · ${q.sub}` : q.sub;
}

/** How far an engine interview has got: the furthest question asked (-1 before the first), and whether the last has its answer. */
function engineProgress(turns: readonly Pick<TranscriptEntry, "who" | "text">[], questions: readonly SessionQuestion[]): { asked: number; done: boolean } {
  let asked = -1;
  let done = false;
  for (const turn of turns) {
    if (turn.who === "ai") asked = Math.max(asked, questionAskedIn(turn.text, questions));
    else if (questions.length > 0 && asked === questions.length - 1) done = true;
  }
  return { asked, done };
}

/**
 * The setup as the service stores it. The question list is a set: the bank
 * cycles for long sessions, so a question can be asked twice, but the
 * snapshot names each once (the service refuses repeats).
 */
function snapshotFor(track: PrepTrack, config: SessionConfig, questions: SessionQuestion[]): PrepSnapshot {
  const unique = uniqueQuestions(questions);
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
    // Whole: sessionQuestions.ts only picks questions the service takes as they are.
    questions: unique.slice(0, PREP_LIMITS.questionsMax).map((q) => ({ id: q.id, text: q.text })),
  };
}

/** A refusal the service will repeat, as opposed to the service being unreachable. */
function isRefusal(error: unknown): error is BackendError {
  return error instanceof BackendError && ((error.status >= 400 && error.status < 500) || error.status === 503);
}

const PrepLive: FC<PrepLiveProps> = ({ track, config, likelyQuestions, onEnd, onSaved, onExit, onRestart }) => {
  // A shorter session the balance covers asks the largest question set that fits.
  // The track's likely questions when it has them; the general bank otherwise.
  const [questions] = useState(() =>
    pickSessionQuestions({
      formats: config.formats,
      lengthMinutes: questionPresetFor(Math.min(config.lengthMinutes, config.capMinutes ?? config.lengthMinutes)),
      seed: `${track.id}-${config.formats.join(",")}-${config.lengthMinutes}`,
      likely: likelyQuestions,
    })
  );
  const tailoredSession = questions.some((q) => q.tailored);
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
  const [autoSend, setAutoSend] = useState<AutoSend>(null);
  /**
   * The window in which anything the recognition hands over is the
   * interviewer, heard through the speakers: while they are talking, and for
   * ECHO_TAIL_MS after — a sentence finalises a beat after its audio stopped —
   * until the mic hears the candidate. handleDictated drops those finals; this
   * keeps the partials they were built from off the transcript, where they
   * would otherwise show the question as the candidate's pending answer.
   * Driven off the mic level, below.
   */
  const [echoTail, setEchoTail] = useState(false);
  const [endNote, setEndNote] = useState<string | null>(null);
  /** "Start over" after the engine interviewer dropped: the attempt is being deleted. */
  const [restarting, setRestarting] = useState(false);
  /**
   * The candidate muted their mic (the call bar's mic button). Held here, not
   * in either hook, because which mic the session has — the capture's or
   * dictation's — is only settled once the start is; both are told, and each
   * keeps it for a mic it opens later.
   */
  const [selfMuted, setSelfMuted] = useState(false);
  /** The footnote under the answer bar, which the Next button points screen readers to. */
  const helpId = useId();

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
  const consentRetriedRef = useRef(false);
  const typedAtRef = useRef(Number.NEGATIVE_INFINITY);
  /** When the interviewer last stopped speaking, for the echo tail below. */
  const aiQuietAtRef = useRef(Number.NEGATIVE_INFINITY);
  /** The line now being read was talked over rather than finished. Cleared when the next one starts. */
  const bargedInRef = useRef(false);
  /**
   * The mic has heard the candidate since the interviewer last went quiet (or
   * since the question went up, with the voice off): a loud frame past the
   * echo's own decay, or a talk-over. Until then a final inside the echo tail
   * can only be the interviewer; after it, it may be the candidate's quick
   * "Yes." — which the tail used to drop, leaving nothing on screen and Next
   * disabled. Kept off the mic level, below.
   */
  const candidateHeardRef = useRef(false);
  /**
   * The typed composer is open. Neither silence loop sends from under it: the
   * candidate is writing, and a pause to choose a word is not the end of an
   * answer. Reported by TypeAnswerPanel; a ref, as the loops read it per frame.
   */
  const composerOpenRef = useRef(false);
  /**
   * `selfMuted` for the silence loops, which read it per frame. A muted mic
   * reads as silence, and silence is what sends an answer: without this the
   * answer went while the candidate could not be heard.
   */
  const selfMutedRef = useRef(false);
  /** The question on the table, for callbacks that must not be rebuilt when it changes. */
  const currentQuestionRef = useRef<SessionQuestion | undefined>(undefined);
  const typingSignalAtRef = useRef(Number.NEGATIVE_INFINITY);
  const submitRef = useRef<() => void>(() => {});
  const startSessionRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // The capture calls these; an effect points them at this render's handlers.
  const onFinalRef = useRef<(caption: CaptureCaption) => void>(() => {});
  const onCapRef = useRef<(reason: CapEndReason) => void>(() => {});
  const getTurnsRef = useRef<() => CaptureTurn[]>(() => []);
  const onInterviewerLostRef = useRef<() => void>(() => {});

  const { create, finish: finishMutation, delete: removeMutation } = usePrepSessionMutations();
  const voiceConfig = usePrepVoiceConfig();
  // How an engine interview opens, handed to the capture at begin; a voice session waits for it before starting.
  const voiceCallConfig = useVoiceConfig();
  const opening = voiceCallConfig.data?.interviewOpening;
  const openingKnown = voiceCallConfig.data !== undefined || voiceCallConfig.isError;

  // No `onBargeIn`: the capture's own is a plain level gate, and the browser's
  // voice is not in the echo-cancelled mix, so on speakers it stopped the
  // question the moment it became audible. A recording's levels go to
  // useVoiceSession's echo-aware barge-in instead (feedLevel, below).
  const capture = useInterviewCapture({
    onFinal: (caption) => onFinalRef.current(caption),
    onCap: (reason) => onCapRef.current(reason),
    getTurns: () => getTurnsRef.current(),
    finish: (id, body) => finishMutation.mutateAsync({ id, body }),
    remove: (id) => removeMutation.mutateAsync(id),
    onInterviewerLost: () => onInterviewerLostRef.current(),
  });
  const {
    markAiStart,
    markAiEnd,
    markAnswer,
    timesOf,
    now: captureNow,
    end: endCapture,
    discard,
    onLevel: onCaptureLevel,
    setMicMuted: setEngineMicMuted,
    setSelfMuted: setCaptureMuted,
    resumeAudio: resumeCaptureAudio,
    getMicFrequencyData: getCaptureFrequencyData,
  } = capture;

  const recording = start.kind === "saved";
  const captionsLive = capture.captions === "live";
  /** The speech engine interviews: it asks, hears and moves on by itself, so nothing here asks, sends or advances. */
  const engine = recording && capture.liveMode === "engine";
  const engineLost = engine && capture.engineProblem?.kind === "disconnected";
  const engineAnswered = hasEngineAnswer(capture.engineTurns, capture.opening);
  const askedQuestions = uniqueQuestions(questions).slice(0, PREP_LIMITS.questionsMax);
  /** The conversation as shown: this screen's own turns (a `browser` opening's first question), then the engine's. */
  const shownTurns: readonly Pick<LiveTurn, "id" | "who" | "text">[] = engine
    ? [...transcript.filter((turn) => !capture.engineTurns.some((own) => own.id === turn.id)), ...capture.engineTurns]
    : transcript;
  const progress = engineProgress(shownTurns, askedQuestions);
  const engineDone = engine && progress.done;

  // Dictated speech (typed sessions) and live captions (voice sessions) land
  // in the same draft box as typing, so every input converges before submit
  // and the rest of the flow stays identical.
  const handleTranscript = useCallback((text: string) => {
    const said = text.trim();
    if (!said) return;
    liveTextRef.current = liveTextRef.current ? `${liveTextRef.current} ${said}` : said;
    setDraft((prev) => (prev ? `${prev.trimEnd()} ${said}` : said));
  }, []);

  /**
   * A final from the browser's recognition that is the interviewer, heard
   * through the speakers, rather than the candidate. The recognition carries
   * no times, only arrival, and the last words of a question finalise after
   * its audio has stopped. A question transcribed as its own answer is not a
   * cosmetic fault — it is sent, and the interview moves on with the question
   * standing in for the answer — so inside ECHO_TAIL_MS:
   *   - nothing is the candidate's before the mic has heard them at all;
   *   - nothing that is only a stretch of the question is, whatever its length
   *     ("and why" is two words of "…from that project, and why?").
   * The second used to be a substring test on the question as written, with
   * its commas, hyphens and "ten", against the recognizer's "10" and no
   * punctuation, and it missed the question read back word for word. Past the
   * tail the recognizer has finished with the interviewer, and a reply that
   * repeats the question's own words ("Base salary.") is the candidate's.
   */
  const isInterviewerEcho = useCallback((text: string): boolean => {
    if (performance.now() - aiQuietAtRef.current >= ECHO_TAIL_MS) return false;
    return !candidateHeardRef.current || echoesQuestion(text, currentQuestionRef.current?.text ?? "");
  }, []);

  /** Dictation, which hears the interviewer through the speakers as well as the candidate: the mic no longer waits for a press. */
  const handleDictated = useCallback(
    (text: string) => {
      if (phaseRef.current !== "active" || aiSpeakingRef.current) return;
      if (isInterviewerEcho(text)) return;
      handleTranscript(text);
    },
    [handleTranscript, isInterviewerEcho],
  );

  /**
   * The candidate talked over the interviewer and useVoiceSession stopped them
   * mid-line. Two things follow from that: the question was not read in full
   * (the effect that watches the voice marks the turn as talked over), and the
   * candidate has been heard — the interviewer went quiet *because* they are
   * mid-sentence, so what the recognition hands over next is theirs, and the
   * echo tail must not drop the very words that did the interrupting. A final
   * that is only the interrupted line is still caught (isInterviewerEcho).
   */
  const handleSelfBargeIn = useCallback(() => {
    bargedInRef.current = true;
    candidateHeardRef.current = true;
  }, []);

  // The mic is open for the whole of an unsaved session, so the constraints
  // matter here as they do for a recording: automatic gain would turn a quiet
  // room up until it read as speech, and an answer that never hears silence is
  // never sent. Harmless on the screens that open the mic for one answer.
  // Opening (or re-opening) the mic must not silence the interviewer: this
  // screen opens it by itself, and a question can be queued and not yet
  // audible, where `aiSpeaking` cannot see it. The level loop decides what is
  // an interruption here.
  const voice = useVoiceSession({
    onTranscript: handleDictated,
    onBargeIn: handleSelfBargeIn,
    voiceEnabled: voiceOn,
    audio: INTERVIEW_MIC_CONSTRAINTS,
    interruptOnListen: false,
  });
  const {
    speak,
    cancelSpeech,
    stopDictation,
    startDictation,
    setInputMuted: setDictationMuted,
    micStatus,
    aiSpeaking,
    voiceBlocked,
    dictationSupported,
    interim: dictationInterim,
    finalizing: dictationFinalizing,
    onLevel: dictationLevel,
    getInputFrequencyData,
    feedLevel: feedVoiceLevel,
    hearsOnlyEcho,
    echoLoud,
  } = voice;

  /**
   * The candidate's voice, for their bars: the mic that is open, except on a
   * frame that is only the interviewer through the speakers (hearsOnlyEcho).
   * speechSynthesis is outside the echo-cancelled mix, so on speakers the bars
   * used to dance to every question as if the candidate were the one talking.
   * They rest then, and still move for somebody talking over the interviewer.
   */
  const candidateSpectrum = useCallback(
    () => (hearsOnlyEcho() ? null : recording ? getCaptureFrequencyData() : getInputFrequencyData()),
    [hearsOnlyEcho, recording, getCaptureFrequencyData, getInputFrequencyData],
  );
  /** Where the composer says it opened or closed; see composerOpenRef. */
  const setComposerOpen = useCallback((open: boolean) => {
    composerOpenRef.current = open;
  }, []);

  const listening = micStatus === "listening";
  /** The mic prompt is up, or the stream is still opening: said under the orb, so the wait is not a dead screen. */
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
  const interim = engine
    ? ""
    : recording
      ? capture.interim
      : // An unsaved session has no draft box any more, so what has been heard
        // but not sent shows here with the partial: the transcript is the only
        // place a mishearing can be caught before the answer goes. Partials
        // from the echo tail are the interviewer, not the candidate —
        // handleDictated drops those finals, and this keeps the partials they
        // were built from off the screen for the same window rather than only
        // while the speakers are actually going. Between questions too: it
        // drops everything then, and words shown and then silently lost read
        // as a mic that heard them.
        [draft.trim(), aiSpeaking || echoTail || phase !== "active" ? "" : dictationInterim.trim()].filter(Boolean).join(" ");
  const finalizing = recording ? capture.finalizing : dictationFinalizing;

  // The create echoes the consent version in the service's voice config, so a
  // start waits for that config, fresh. Without it (it failed to load, or voice
  // interviews are off) the session runs unsaved, with no interviewer opening
  // to wait for.
  const wantsStart = start.kind === "idle" && !voiceConfig.isFetching && (openingKnown || voiceConfig.data?.interviewsEnabled !== true);
  const showPrecall = start.kind === "refused";
  const openingNote = voiceConfig.data?.liveProvider === "elevenlabs" && opening ? INTERVIEW_OPENING_NOTE[opening] : null;
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
    currentQuestionRef.current = currentQuestion;
  });

  // ---------------------------------------------------------------------------
  // Starting
  // ---------------------------------------------------------------------------

  function refuse(refusal: Refusal) {
    setStart({ kind: "refused", ...refusal });
  }

  async function startSession() {
    const current = startRef.current.kind;
    if (current !== "idle") return;
    // Held here too, so a second call before the next render cannot start twice.
    startRef.current = { kind: "starting" };
    setStart({ kind: "starting" });

    const prep = snapshotFor(track, config, questions);
    const settings = voiceConfig.data;
    if (!settings?.interviewsEnabled) {
      // Voice itself works here — the session is spoken either way — so this
      // must not read as "voice is unavailable": it is the recording, the
      // report and the scorecard that are off (the AI service's
      // VOICE_INTERVIEWS_ENABLED).
      setStart({ kind: "local", reason: settings ? "Recorded interviews are switched off right now" : apiMessage(voiceConfig.error) });
      return;
    }
    // The mic first: a refusal here should cost no session.
    const micOk = await capture.requestMic();
    if (!aliveRef.current) return;
    if (!micOk) {
      refuse({ problem: "mic", message: "" });
      return;
    }
    const input: CreatePrepSessionInput = { mode: "voice", prep, consent: { version: settings.consentVersion, accepted: true } };

    let result: CreatePrepSessionResult;
    try {
      result = await create.mutateAsync(input);
    } catch (error) {
      if (!aliveRef.current) return;
      capture.releaseMic();
      if (isRefusal(error)) {
        // A 400 is most likely a consent version changed since the config was read: read it again and start over, once.
        if (error.status === 400 && !consentRetriedRef.current) {
          consentRetriedRef.current = true;
          const fresh = await voiceConfig.refetch();
          if (!aliveRef.current) return;
          if (fresh.data && fresh.data.consentVersion !== settings.consentVersion) {
            setStart({ kind: "idle" });
            return;
          }
        }
        const open = openSessionOf(error);
        const credits = insufficientCreditsOf(error);
        const limited = limitedOf(error);
        refuse({
          problem: open ? "open" : credits ? "credits" : limited ? "limited" : "other",
          message: credits ? creditsRefusal(credits, settings.credits) : apiMessage(error),
          ...(open ? { openSessionId: open.sessionId } : {}),
        });
        return;
      }
      // The service could not be reached: carry on, unsaved.
      setStart({ kind: "local", reason: apiMessage(error) });
      return;
    }

    if (!aliveRef.current) {
      // The screen closed while the session was being created: nothing will use it.
      void removeMutation.mutateAsync(result.session.id).catch(() => {});
      return;
    }
    // The consent goes again with an engine interview's call, which repeats it.
    const begun = await capture.begin({ config: result, consent: input.consent, opening: opening ?? null });
    // Closed meanwhile: the capture's own unmount deleted the session.
    if (!aliveRef.current) return;
    if (!begun.ok) {
      await discard();
      if (!aliveRef.current) return;
      refuse(begun.problem ? { problem: "engine", engine: begun.problem, message: begun.error } : { problem: "capture", message: begun.error });
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
    // A capture that has begun cannot begin again: a fresh screen starts a fresh one.
    if (start.kind === "refused" && (start.problem === "capture" || start.problem === "engine")) {
      if (onRestart) onRestart();
      else window.location.reload();
      return;
    }
    setStart({ kind: "idle" });
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

  function ask(index: number, id = nextTurnId()) {
    const question = questions[index];
    if (!question) return;
    // A question still being read when the next one comes (a typed answer
    // sent over it) ends here, where the new question's speech cuts it off.
    const previous = aiTurnRef.current;
    if (previous) endAiTurn(previous);
    aiTurnRef.current = id;
    askedAtRef.current = captureNow();
    aiSpokeRef.current = false;
    heardRef.current = false;
    candidateHeardRef.current = false;
    liveTextRef.current = "";
    setTranscript((prev) => [...prev, aiTurn(id, question, recording)]);
    setQuestionIndex(index);
    setPhase("active");
  }

  // Connecting -> first question, once the session exists (or runs unsaved).
  useEffect(() => {
    if (phase !== "connecting" || !ready || engine) return;
    const t = setTimeout(() => ask(0), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ready, engine]);

  // The engine asks for itself; a `browser` opening's first question is read here, under the service's turn id so its times merge.
  useEffect(() => {
    if (phase !== "connecting" || !engine) return;
    // No first question once the interviewer has dropped: there is no one to answer to.
    const firstId = capture.opening === "browser" && capture.conversationId && !engineLost ? engineTurnId(capture.conversationId, 0, "ai") : null;
    const t = setTimeout(() => (firstId ? ask(0, firstId) : setPhase("active")), firstId ? 900 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, engine, engineLost]);

  // The engine must not hear the page's own first question as the candidate's answer: its mic is off while that plays.
  // A hold, which the capture ORs with the candidate's own mute: the question ending sends false here, and that
  // used to unmute a candidate who had muted themselves while it played.
  useEffect(() => {
    if (engine) setEngineMicMuted(aiSpeaking);
  }, [engine, aiSpeaking, setEngineMicMuted]);

  // An unsaved session's mic is open for the whole interview, as a call is:
  // this screen stopped asking for a press when the interview stopped being a
  // text box. Opened while it is still connecting, ~900ms before ask(0), so a
  // slow permission prompt costs the interview nothing.
  //
  // It is the re-arm too. useVoiceSession retires a recognizer after 60s with
  // nothing recognised and lands on "idle"; in a session that never calls
  // stopDictation, "idle" can only mean that, so starting again is right. It
  // cannot spin: each re-arm survives 60s of quiet, and a recognizer that
  // genuinely cannot run is turned into the terminal "unavailable" after three
  // quick ends, which this does not retry — nor "denied" or "unsupported". A
  // recognizer another page took (`aborted`: the interview open in a second
  // tab, Dictate pressed on the coach) no longer lands on "idle" either: the
  // hook replaces it on the same mic and counts it as a quick end, so two tabs
  // fighting over recognition settle on one of them in three hops rather than
  // re-opening the mic at each other forever.
  // It no longer waits for the interviewer to finish: opening the mic used to
  // cancel speech, and a re-arm between a question being queued and it being
  // heard silenced that question outright. `interruptOnListen: false` took
  // the cancel away, and re-arming at once keeps barge-in working mid-question.
  useEffect(() => {
    if (recording || start.kind !== "local" || !dictationSupported) return;
    if (phase === "saving" || phase === "done") return;
    if (micStatus !== "idle") return;
    startDictation();
  }, [recording, start.kind, dictationSupported, phase, micStatus, startDictation]);

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
    if (phase !== "active" || !currentQuestion || (engine && !aiTurnRef.current)) return;
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
  // muted, or talked over) ends it. Stopping also opens the echo tail below.
  useEffect(() => {
    const turnId = aiTurnRef.current;
    if (aiSpeaking) {
      aiSpokeRef.current = true;
      // Whatever ends this line, it has not been talked over yet, and nothing
      // the mic hears now can be told from the line itself.
      bargedInRef.current = false;
      candidateHeardRef.current = false;
      if (turnId) markAiStart(turnId);
      return;
    }
    // Stamped whether or not there was a turn to end: the echo tail is about
    // the speakers, not the transcript. A line that was talked over opens it
    // too — what the recognizer still holds of that line is echo — but the
    // talk-over has already counted as hearing the candidate (see
    // handleSelfBargeIn), so their own words go through it.
    aiQuietAtRef.current = performance.now();
    if (aiSpokeRef.current && turnId) endAiTurn(turnId, bargedInRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSpeaking, markAiStart]);

  // Whether the mic has heard the candidate (candidateHeardRef), off whichever
  // mic this session has — a recording's captions go through the same echo
  // guard as dictation (handleCaption). And, for dictation, the same window as
  // a rendered flag: handleDictated tests it on refs, which is right in a
  // callback; the transcript needs it to change a render, and the mic level is
  // the tick that already runs for as long as it matters — a timer started
  // where the window opens would be a setState in an effect, and a whole
  // cascade for one hidden line.
  useEffect(() => {
    if (engine || !(recording || listening)) return;
    const source = recording ? onCaptureLevel : dictationLevel;
    let shown = false;
    const unsubscribe = source((level) => {
      const now = performance.now();
      const quietFor = now - aiQuietAtRef.current;
      if (!aiSpeakingRef.current && level > SPEAKING_LEVEL && quietFor >= ECHO_DECAY_MS) candidateHeardRef.current = true;
      if (recording) return;
      const tail = aiSpeakingRef.current || (quietFor < ECHO_TAIL_MS && !candidateHeardRef.current);
      if (tail === shown) return;
      shown = tail;
      setEchoTail(tail);
    });
    return () => {
      unsubscribe();
      if (shown) setEchoTail(false);
    };
  }, [engine, recording, listening, dictationLevel, onCaptureLevel]);

  // A recording's mic is the capture's, and dictation never opens beside it,
  // so its levels are judged for barge-in by the same echo-aware rule as
  // dictation's (see useVoiceSession's ECHO_PROBE_MS) — including an engine
  // interview's first question, which this screen reads itself.
  useEffect(() => {
    if (!recording) return;
    return onCaptureLevel(feedVoiceLevel);
  }, [recording, onCaptureLevel, feedVoiceLevel]);

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
    // The engine's answers are the capture's own turns; this screen has none to add.
    if (engine || phaseRef.current !== "active") return turns;
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

    const answered = engine ? engineAnswered : finalTranscript.some((turn) => turn.who === "user");
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

  /**
   * False when the session was not in a state to take the answer — between two
   * questions, or once it is finishing. Said so out loud because the composer
   * clears itself on a send that went: without an answer here, a line typed
   * during the pause between questions was wiped and never asked about.
   */
  function commitAnswer(raw: string): boolean {
    if (phase !== "active" || finishingRef.current) return false;
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
    return true;
  }

  function endNow() {
    const current = startRef.current.kind;
    if ((current === "idle" || current === "refused" || current === "starting") && onExit) {
      onExit();
      return;
    }
    // An engine interview whose last question has its answer is complete, however it is ended.
    void finishSession(engine && engineDone ? "completed" : "ended-early", recording ? withPendingAnswer() : transcript);
  }

  /** The engine interviewer dropped. The capture finishes (or deletes) the session; a question still being read here stops. */
  function handleInterviewerLost() {
    if (aiTurnRef.current) endAiTurn(aiTurnRef.current);
    cancelSpeech();
    // Every question has its answer: a hang-up now ends a complete interview, so it is finished here as one.
    if (engineDone) void finishSession("completed", withPendingAnswer());
  }

  /** After a drop: this attempt is not wanted. Deleted before a fresh screen starts, which an open session would refuse. */
  async function startOver() {
    if (restarting) return;
    setRestarting(true);
    finishingRef.current = true;
    cancelSpeech();
    const current = startRef.current;
    await discard();
    if (current.kind === "saved") await removeMutation.mutateAsync(current.serverId).catch(() => {});
    if (!aliveRef.current) return;
    if (onRestart) onRestart();
    else window.location.reload();
  }

  function sendTypedToEngine(text: string): boolean {
    if (capture.sendTypedAnswer(text)) return true;
    toast.error("Your answer couldn't be sent: the interviewer isn't connected.");
    return false;
  }

  function signalEngineTyping() {
    const at = performance.now();
    if (at - typingSignalAtRef.current < TYPING_SIGNAL_MS) return;
    typingSignalAtRef.current = at;
    capture.signalTyping();
  }

  /**
   * The mic button. Both hooks are told, whichever mic is live: see `selfMuted`.
   * An engine interviewer is held off speaking while it lasts (the capture's
   * mute hold); the other two only move on from silence, which a mute is not.
   */
  function toggleSelfMute() {
    // A press is the activation a context opened without one needs (see toggleVoice).
    if (recording) resumeCaptureAudio();
    const next = !selfMutedRef.current;
    selfMutedRef.current = next;
    setSelfMuted(next);
    setCaptureMuted(next);
    setDictationMuted(next);
  }

  // ---------------------------------------------------------------------------
  // What the capture calls back into
  // ---------------------------------------------------------------------------

  /**
   * A finished live caption: into the draft, unless it is the interviewer heard
   * through the speakers. A timed caption is judged by when it began; the
   * browser's captions carry no times (startMs null), only arrival, so they
   * get dictation's guard — they had none past `aiSpeaking`.
   */
  function handleCaption(caption: CaptureCaption) {
    if (engine || phaseRef.current !== "active" || aiSpeakingRef.current) return;
    if (caption.startMs === null) {
      if (isInterviewerEcho(caption.text)) return;
    } else {
      const turnId = aiTurnRef.current;
      const aiEnd = turnId ? timesOf(turnId)?.endMs : undefined;
      if (aiEnd !== undefined && caption.startMs < aiEnd - CAPTION_OVERLAP_MS) return;
    }
    handleTranscript(caption.text);
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
    onCapRef.current = handleCap;
    getTurnsRef.current = () => withPendingAnswer().map(toCaptureTurn);
    onInterviewerLostRef.current = handleInterviewerLost;
  });

  // ---------------------------------------------------------------------------
  // Moving on once the answer is over
  // ---------------------------------------------------------------------------

  // Auto-send once an answer is over. Held in locals and driven off the mic
  // level subscription rather than state, because this runs every animation
  // frame and re-rendering the call screen at 60fps to watch for silence would
  // be absurd.
  //
  // "Over" is an answer followed by silence, and how much silence depends on
  // how much answer there is and whether its last sentence is finished
  // (turnEnd.ts). The rule this replaces sent any text at all after two
  // seconds of quiet, so "um" and a moment to think was taken as the whole
  // answer and the next question was asked over the candidate. Filler and
  // stall phrases alone now never end a turn; a few words wait 12 s of total
  // silence; a sentence left hanging ("…and the first thing I did was") waits
  // 8 s; only an answer under way and at a full stop goes after 5-6.5 s. Next
  // question is the manual fallback, not the mechanism.
  //
  // The quiet is the time since the last frame loud enough to be speech, and
  // any such frame — another "um", a breath the mic catches — starts it again.
  // It only starts once the turn has had one. Frames while the interviewer is
  // audible, or dying away in the mic just after (ECHO_DECAY_MS), are neither
  // speech nor quiet. An open composer is the candidate answering in writing:
  // the quiet starts again when it closes, so the send never comes from under
  // it, and never without its warning straight after it shuts.
  //
  // Silence alone isn't enough either. Dictated words reach the draft only once
  // they are final, which for the browser's recognition can be a moment after
  // the user stops, so sending on silence could send an answer without its last
  // sentence and leave that sentence to land in the next answer. The send waits
  // while anything spoken is still being finalised, and gives the words that
  // just landed a moment on screen.
  const finalizingRef = useRef(finalizing);
  const settledAtRef = useRef(0);
  useEffect(() => {
    finalizingRef.current = finalizing;
    if (!finalizing) settledAtRef.current = performance.now();
  }, [finalizing]);

  /** The unsaved session's answer is about to go: the "moving on" warning is up. */
  const [pausing, setPausing] = useState(false);

  // Unsaved sessions: the mic is open from the start of the interview, so this
  // is the whole of it rather than the stretch between a Talk press and a Stop.
  // Dictation is the only record here, so the text is the answer and only
  // words count: a turn of nothing but filler never ends itself.
  useEffect(() => {
    if (recording || !listening || phase !== "active") return;

    let voiced = false;
    let quietSince: number | null = null;
    // The draft last counted, so a 60fps loop does not re-tokenise an unchanged answer.
    let counted: string | null = null;
    let words = 0;
    let open = false;
    let warned = false;
    const warn = (next: boolean) => {
      if (next === warned) return;
      warned = next;
      setPausing(next);
    };
    const unsubscribe = dictationLevel((level) => {
      // The interviewer through the speakers is not the user answering. The
      // mic no longer goes off between questions, so this is now reached.
      if (aiSpeakingRef.current) {
        voiced = false;
        quietSince = null;
        warn(false);
        return;
      }
      const now = performance.now();
      if (composerOpenRef.current) {
        quietSince = null;
        warn(false);
        return;
      }
      // Muted: the level is a disabled track's zero, not the answer ending. The
      // quiet starts again from the unmute, as it does when the composer closes.
      if (selfMutedRef.current) {
        quietSince = null;
        warn(false);
        return;
      }
      if (level > SPEAKING_LEVEL) {
        if (now - aiQuietAtRef.current < ECHO_DECAY_MS) return;
        voiced = true;
        quietSince = null;
        warn(false);
        return;
      }
      if (!voiced) return;
      quietSince ??= now;
      const quietMs = now - quietSince;
      const draft = draftRef.current;
      if (draft !== counted) {
        counted = draft;
        words = contentWords(draft);
        open = endsOpen(draft);
      }
      const endAfter = quietForWords(words, open);
      const held = finalizingRef.current || now - typedAtRef.current < TYPING_HOLD_MS;
      warn(endAfter !== null && !held && quietMs >= endAfter - MOVE_ON_WARNING_MS);
      if (endAfter === null || quietMs < endAfter || held || now - settledAtRef.current < SETTLE_AFTER_FINAL_MS) return;
      voiced = false;
      quietSince = null;
      warn(false);
      submitRef.current();
    });
    return () => {
      unsubscribe();
      if (warned) setPausing(false);
    };
  }, [recording, listening, phase, dictationLevel]);

  // Voice sessions: the mic is always open, and the recording is the answer
  // even where the captions caught nothing of it. So with live captions a turn
  // is judged by its words when there are any and by how long the candidate
  // has spoken when there are none; without captions (Firefox), by time spoken
  // alone. Filler-only captions over under 1.5 s of voice never end a turn.
  // Without captions the send is counted down on screen at the end of its
  // window, and speaking again calls it off.
  useEffect(() => {
    if (!recording || engine || phase !== "active") return;
    let voiced = false;
    // Time spoken in this turn: resubscribing on phase starts it again for each question.
    let voicedMs = 0;
    let lastFrame: number | null = null;
    let quietSince: number | null = null;
    let counted: string | null = null;
    let words = 0;
    let open = false;
    let shown: AutoSend = null;
    const show = (next: AutoSend) => {
      const same = shown === next || (shown?.kind === "countdown" && next?.kind === "countdown" && shown.seconds === next.seconds);
      if (same) return;
      shown = next;
      setAutoSend(next);
    };
    const unsubscribe = onCaptureLevel((level) => {
      const now = performance.now();
      const frameMs = lastFrame === null ? 0 : Math.min(MAX_FRAME_MS, now - lastFrame);
      lastFrame = now;
      // The interviewer through the speakers is not the user answering.
      if (aiSpeakingRef.current) {
        voiced = false;
        quietSince = null;
        show(null);
        return;
      }
      if (composerOpenRef.current) {
        quietSince = null;
        show(null);
        return;
      }
      // Muted: the recording hears silence, which is not the answer ending, and
      // without captions nothing else could tell. The quiet starts again from the
      // unmute, so the answer never goes while the candidate cannot be heard.
      if (selfMutedRef.current) {
        quietSince = null;
        show(null);
        return;
      }
      if (level > SPEAKING_LEVEL) {
        if (now - aiQuietAtRef.current < ECHO_DECAY_MS) return;
        voiced = true;
        voicedMs += frameMs;
        heardRef.current = true;
        quietSince = null;
        show(null);
        return;
      }
      if (!voiced) return;
      quietSince ??= now;
      const quietMs = now - quietSince;
      let endAfter: number | null;
      if (captionsLive) {
        const draft = draftRef.current;
        if (draft !== counted) {
          counted = draft;
          words = contentWords(draft);
          open = endsOpen(draft);
        }
        endAfter = words > 0 ? quietForWords(words, open) : quietForVoice(voicedMs);
      } else {
        endAfter = quietForVoice(voicedMs);
      }
      const held = (captionsLive && finalizingRef.current) || now - typedAtRef.current < TYPING_HOLD_MS;
      const warning = endAfter !== null && !held && quietMs >= endAfter - MOVE_ON_WARNING_MS;
      if (endAfter === null || !warning) show(null);
      else if (captionsLive) show(WARNING);
      else {
        const left = Math.ceil((endAfter - quietMs) / 1000);
        show(left > 0 ? { kind: "countdown", seconds: left } : null);
      }
      if (endAfter === null || quietMs < endAfter || held) return;
      if (captionsLive && now - settledAtRef.current < SETTLE_AFTER_FINAL_MS) return;
      voiced = false;
      quietSince = null;
      show(null);
      submitRef.current();
    });
    return () => {
      unsubscribe();
      if (shown) setAutoSend(null);
    };
  }, [recording, engine, phase, captionsLive, onCaptureLevel]);

  function toggleVoice() {
    // A press is the user activation a context opened without one needs: a
    // session that starts itself on a hard reload has a recording mic reading
    // silence until then (dictation's context is resumed by speak itself).
    if (recording) resumeCaptureAudio();
    // The browser refused to speak without a press on the page. This is that
    // press, so it plays the question rather than muting a voice nobody heard.
    if (voiceOn && voiceBlocked) {
      if (currentQuestion && phase === "active") speak(currentQuestion.text, resolveQuestionAudio(currentQuestion.id));
      return;
    }
    const next = !voiceOn;
    setVoiceOn(next);
    if (!next) cancelSpeech();
  }

  // Unmuted: the question on the table is read again. From an effect, not the
  // press: `speak` in the press is that render's, which still has the voice
  // off, and it returned without a word — an unmute that stayed silent until
  // the next question, which looked like the audio still being broken.
  const voiceWasOnRef = useRef(voiceOn);
  useEffect(() => {
    const wasOn = voiceWasOnRef.current;
    voiceWasOnRef.current = voiceOn;
    if (!voiceOn || wasOn || engine || phase !== "active" || !currentQuestion) return;
    speak(currentQuestion.text, resolveQuestionAudio(currentQuestion.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const lastQuestion = questionIndex >= questions.length - 1;
  /**
   * Why the unsaved bar can only be typed into. The one thing the bar still
   * says in words: it is the only explanation of a blocked mic, and it stays
   * with the composer that opens for it. What is happening otherwise is the
   * orb's to say (see `stage`), and the steady-state instruction is the footnote.
   */
  const problemHint =
    micStatus === "denied"
      ? "Mic blocked — type your answer instead."
      : micStatus === "unsupported" || !dictationSupported
        ? "Dictation isn't available in this browser. You can still type your answers here."
        : micStatus === "unavailable"
          ? "Dictation isn't available right now. You can still type your answers here."
          : undefined;
  /** The engine interviewer's side: it is speaking when either it or this screen's first question is. */
  const agentSpeaking = aiSpeaking || (engine && capture.agentSpeaking);
  const engineHint = engineDone
    ? "That was the last question. Finish when you're ready."
    : agentSpeaking
      ? "Answer when you're ready — talk over them if you want, they'll stop."
      : "Answer out loud. The interviewer moves on when you finish.";

  const rule = voiceConfig.data?.credits;
  const includedMs = (rule?.includedMinutes ?? 10) * 60_000;
  const perExtra = rule?.perExtraMinute ?? 1;
  const pastIncluded = recording && capture.elapsedMs >= includedMs;
  const pendingParts = capture.upload.pending;
  const failedParts = capture.upload.failed;
  // A part is cut every few seconds, so one on its way is the normal state;
  // more than that means the connection is falling behind.
  const uploadBacklog = recording && failedParts === 0 && pendingParts > 1;
  // An engine interviewer's drop sets the capture's error too, but it has its own notice.
  const micLost = recording && (capture.micStatus === "unavailable" || (capture.error !== null && capture.engineProblem === null));
  const refusal = start.kind === "refused" ? start : null;

  /** The mic that is actually open: the recorder's in a voice session, dictation's otherwise. */
  const micOpen = recording ? capture.micStatus === "live" : listening;

  /**
   * Why the mic is not open, where the session opens it by itself. Each says
   * what went wrong rather than "Your mic is off": the one "off" the candidate
   * can turn back on is their own mute, which says so in its own words (the
   * mic button, MUTED_CAPTION), and a mic that could not open must not read as
   * one they muted. It outranks the mute's line, being the thing to fix first.
   * A recording session's mic belongs to the capture, and `dictationSupported`
   * says nothing about it, so none of this applies there.
   */
  const dictationOff =
    recording || micOpen || requesting
      ? null
      : micStatus === "denied"
        ? "Your mic is blocked — type your answer"
        : micStatus === "unsupported" || !dictationSupported
          ? "This browser can't turn speech into text — type your answer"
          : micStatus === "unavailable"
            ? "Your mic stopped — try it again, or type your answer"
            : null;

  // What is happening, once — see Stage. Derived from the session this screen
  // already runs rather than from a provider, because this screen still owns
  // it (see PrepOrb). Order is precedence: a lost mic outranks everything, an
  // answer about to go outranks the state it is going from, and the
  // interviewer speaking outranks the mic being open, because the candidate is
  // meant to be listening then. The candidate's mute is not a stage of its own:
  // the orb goes on showing the interviewer, and the mute is the line under it
  // (`showsMuted`) where the line would offer to hear them — "asking" and "mic-off".
  const stage: Stage = micLost
    ? "mic-lost"
    : engineLost
      ? "interviewer-lost"
      : phase === "connecting"
        ? "connecting"
        : phase === "saving"
          ? "saving"
          : autoSend || pausing
            ? "moving-on"
            : agentSpeaking
              ? "asking"
              : phase === "thinking"
                ? "thinking"
                : // The engine plays its own voice; there is no speaker button to press there.
                  !engine && voiceOn && voiceBlocked && phase === "active"
                  ? "voice-blocked"
                  : engineDone
                    ? "finished"
                    : selfMuted
                      ? "mic-off"
                      : requesting
                        ? "mic-opening"
                        : micOpen
                          ? "answering"
                          : "mic-off";
  const showsMuted = selfMuted && dictationOff === null && (stage === "asking" || stage === "mic-off");
  const orbCaption = captionFor(stage, { countdown: autoSend?.kind === "countdown" ? autoSend.seconds : null, off: dictationOff, echoLoud, muted: showsMuted });
  // Something is about to happen on its own: the caption has to be read. And a
  // mute, whose failure is an answer given to nobody: it must not read as a state name.
  const orbCaptionEmphasis = stage === "moving-on" || showsMuted;
  const speakerBlocked = !engine && voiceOn && voiceBlocked;

  /**
   * The mic path works, so the bar shows the candidate's voice and the
   * footnote. Where typing is the only way in, the problem hint takes the
   * place of both, because it says why.
   */
  const micUsable = recording || problemHint === undefined;
  /** A mic to mute, or a mute to undo; not on the refusal screen, which has no session. */
  const showMute = !showPrecall && (micUsable || selfMuted);
  /**
   * The candidate's voice, where the instruction sentence used to be. The orb
   * is the interviewer's and no longer pulses with this mic — two meters of
   * one voice, one of them labelled "Your interviewer", was the who-is-talking
   * confusion. Live but dimmed while the interviewer talks, since talking over
   * them is allowed and this is the only sign the mic hears it — though only
   * what is over the interviewer's own echo (candidateSpectrum); resting between
   * questions. White is the candidate; lime stays the interviewer's colour.
   * Muted, they rest in the mic button's red and say so: flat bars alone read
   * as a quiet room, which is exactly the mistake a forgotten mute makes.
   */
  const candidateBars = micUsable ? (
    selfMuted ? (
      <span className="flex h-8 min-w-0 max-w-[420px] flex-1 items-center gap-2 px-1 text-[11px] font-bold text-red-300">
        <MicOff className="h-3.5 w-3.5 flex-none" aria-hidden />
        <span className="flex-none">Muted</span>
        <VoiceFrequencyBars getFrequencyData={candidateSpectrum} active={false} className="h-8 flex-1" barClassName="bg-red-300/40" />
      </span>
    ) : (
      <VoiceFrequencyBars
        getFrequencyData={candidateSpectrum}
        active={micOpen && phase === "active"}
        className="h-8 max-w-[420px] flex-1 px-1"
        barClassName={stage === "asking" ? "bg-white/25" : "bg-white/80"}
      />
    )
  ) : undefined;
  // The manual way on, and deliberately quiet: silence moves the interview
  // on, and this used to be the loudest thing on the bar (52px, lime, a
  // sticker shadow), which made it read as the mechanism. 32px tall — a 70% cut
  // to the old height would be 15.6px, under even WCAG 2.5.8's 24px — with the
  // reduction taken from width, type and treatment instead (about 76% less
  // area), and an invisible 6px above and below that keeps a 44px touch target.
  const secondaryButton =
    "relative flex-none inline-flex items-center gap-1 h-8 rounded-lg border border-white/25 bg-transparent px-2.5 text-[11px] font-bold text-white/75 cursor-pointer transition-colors hover:border-white/50 hover:text-white disabled:opacity-35 disabled:pointer-events-none after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']";
  const nextButton = (disabled: boolean) => (
    <button
      type="button"
      onClick={submitAnswer}
      disabled={disabled}
      aria-label={lastQuestion ? "Finish the interview" : "Next question"}
      aria-describedby={micUsable ? helpId : undefined}
      className={secondaryButton}>
      <ArrowRight className="h-3 w-3" aria-hidden />
      {lastQuestion ? "Finish" : "Next"}
    </button>
  );
  // A footnote, not a label: the bars say "we hear you", the orb says what is
  // happening, and this is the rule once, small, at the very bottom. Not live —
  // the Next button points to it instead, so it is read where it applies.
  const footnote = micUsable ? (
    <p id={helpId} className="mx-auto mt-2 max-w-[1100px] text-center text-[10.5px] leading-snug text-white/50">
      When you&apos;ve finished and gone quiet, we move on — or press {lastQuestion ? "Finish" : "Next"}.
    </p>
  ) : null;
  // The engine bar's rule, in the same place and size. Steady on purpose: engineHint
  // swaps sentence whenever the interviewer starts or stops talking, which is the orb's
  // job to show — a footnote that changes every few seconds is only something to reread.
  const engineFootnote = (
    <p className="mx-auto mt-2 max-w-[1100px] text-center text-[10.5px] leading-snug text-white/50">
      {engineDone
        ? "That was the last question. Finish when you're ready."
        : "Answer out loud — the interviewer moves on when you finish, and you can talk over them."}
    </p>
  );

  /** The transcript, in the shape the panel takes. An engine turn speaking before its words arrive shows as "…". */
  const transcriptEntries: TranscriptEntry[] = shownTurns.flatMap((turn, i) => {
    const speaking = agentSpeaking && turn.who === "ai" && i === shownTurns.length - 1;
    if (turn.who === "ai" && !turn.text && !speaking) return [];
    return [{ id: turn.id, who: turn.who, text: turn.who === "ai" && !turn.text ? "…" : turn.text, speaking }];
  });

  // The engine's latest line: shown as the session's question when it asks one.
  let interviewerLine = "";
  for (const turn of shownTurns) if (turn.who === "ai" && turn.text) interviewerLine = turn.text;
  const engineQuestion = askedQuestions[questionAskedIn(interviewerLine, askedQuestions)] ?? null;
  const questionCount = engine
    ? engineDone
      ? `All ${askedQuestions.length} questions answered`
      : progress.asked < 0
        ? capture.opening === "greeting"
          ? "Say hello to begin"
          : "Starting…"
        : `Question ${progress.asked + 1} of ${askedQuestions.length}`
    : `Question ${Math.min(questionIndex + 1, questions.length)} of ${questions.length}`;
  const progressShare = engine
    ? (engineDone ? askedQuestions.length : Math.max(progress.asked, 0)) / Math.max(askedQuestions.length, 1)
    : questionIndex / questions.length;
  /** Typing needs a call to type into: hidden once the engine interviewer is gone. */
  const engineTyping = engine && capture.status === "live" && capture.engineProblem === null;

  const refusalText = !refusal
    ? null
    : refusal.problem === "mic"
      ? (capture.error ?? "We couldn't use your microphone.")
      : refusal.problem === "open"
        ? "You already have a voice interview that is still open or being saved. Open it to see where it's up to."
        : refusal.message;
  const refusalTitle = refusal?.engine ? ENGINE_PROBLEM_TITLE[refusal.engine.kind] : null;
  // Today's voice minutes are gone, or this browser can't run the interviewer: another try would fail the same way.
  const canRetry = refusal?.problem !== "open" && refusal?.engine?.kind !== "minutes" && !refusal?.engine?.browser;

  return (
    <div className="bg-[#222325] text-white min-h-screen lg:h-screen flex flex-col">
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
          {phase === "connecting" ? "Connecting…" : questionCount}
        </span>
        <div className="flex-1 min-w-[100px] h-1 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-[#e1f073] transition-[width] duration-300" style={{ width: `${progressShare * 100}%` }} />
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
          {/* The candidate's own mic, in every kind of session. Muted is red
              rather than dimmed as the interviewer's speaker is when off: a
              mute left on costs an answer without a sound, so it must not look
              like a resting control. Kept on screen while muted even where the
              mic has since failed, so a mute can always be undone. */}
          {showMute && (
            <button
              type="button"
              onClick={toggleSelfMute}
              disabled={phase === "saving" || phase === "done" || engineLost || restarting}
              // A fixed name with aria-pressed carrying the state: a label that also
              // flips would be read as "Unmute your mic, pressed", which says both.
              aria-pressed={selfMuted}
              aria-label="Mute your mic"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] cursor-pointer transition-colors disabled:opacity-40 disabled:pointer-events-none",
                selfMuted ? "border-red-400/70 bg-red-500/15 text-red-300 hover:border-red-300" : "border-white/25 hover:border-white/50"
              )}>
              {selfMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          )}
          {/* The engine plays its own voice, and the interview needs it heard. */}
          {!engine && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={speakerBlocked ? "Play the interviewer's voice" : voiceOn ? "Mute interviewer" : "Unmute interviewer"}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] cursor-pointer transition-colors",
                speakerBlocked
                  ? "border-[#e1f073] text-[#e1f073] ring-2 ring-[#e1f073]/40"
                  : voiceOn
                    ? "border-white/25 hover:border-white/50"
                    : "border-white/15 text-white/40"
              )}>
              {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={endNow}
            disabled={phase === "saving" || phase === "done" || restarting}
            className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-white px-3 py-1.5 text-xs font-bold text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none">
            <PhoneOff className="h-3.5 w-3.5" />
            {engine ? "End interview" : "End session"}
          </button>
        </div>
      </div>

      {/* Notices */}
      {start.kind === "local" && (
        <div role="status" className="flex items-start gap-2.5 px-6 py-2.5 bg-[#e1f073]/10 border-b border-[#e1f073]/25 text-xs text-white/80 flex-none">
          <AlertTriangle className="h-3.5 w-3.5 text-[#e1f073] flex-none mt-0.5" />
          {/* No scorecard is promised, because there is none: reports are
              graded by the AI service from a saved session, and this screen's
              onEnd has nothing to grade — the live route says so and goes back
              to the track. The banner used to promise one anyway, and then
              offered "no scorecard at the end" as if one were the norm here. */}
          <p>
            <b className="font-bold text-white">This session won&apos;t be saved or scored.</b> {asSentence(start.reason)} You can still practise out
            loud the whole way through.
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

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <div className="flex-1 min-w-0 flex flex-col lg:min-h-0 lg:overflow-y-auto">
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
                {refusalTitle && <b className="block font-bold text-white mb-0.5">{refusalTitle}</b>}
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
              {canRetry && (
                <button
                  type="button"
                  onClick={retryStart}
                  className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-[#222325] bg-[#e1f073] px-5 py-2.5 text-sm font-bold text-[#222325] cursor-pointer shadow-[2px_2px_0_0_#ffffff] transition-[transform,box-shadow] duration-100 hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-35 disabled:pointer-events-none">
                  <Mic className="h-4 w-4" />
                  Try again
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
          <p className="text-[15px] font-bold">{start.kind === "starting" ? "Starting your recording…" : "Connecting to your interviewer…"}</p>
          <p className="text-sm text-white/50">This is a practice session — keep this tab open.</p>
          {openingNote && start.kind !== "local" && <p className="text-xs font-bold text-[#e1f073]">{openingNote}</p>}
          {/* An unsaved session has no recording to keep the interviewer out
              of, and the mic opens itself here, so both halves of the line
              change: what is about to happen, and why echo matters anyway. */}
          {start.kind === "local" ? (
            <div className="flex flex-col items-center gap-1.5 text-xs text-white/45">
              {/* Only where the browser has speech recognition at all. Firefox
                  has none, the mic is never opened there, and someone told to
                  answer out loud would be left waiting on a mic that is not
                  coming. */}
              {dictationSupported ? (
                <>
                  <p>Your mic opens by itself — just answer out loud. Your browser turns what you say into text.</p>
                  <p className="flex items-center gap-2">
                    <Headphones className="h-3.5 w-3.5 flex-none" />
                    Use headphones if you can: they stop the interviewer being heard as your answer.
                  </p>
                </>
              ) : (
                <p>This browser can&apos;t turn speech into text, so you&apos;ll type your answers here.</p>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-xs text-white/45">
              <Headphones className="h-3.5 w-3.5 flex-none" />
              Use headphones if you can: they keep the interviewer&apos;s voice out of your recording.
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-10">
          {/* The interviewer, and the question on the table */}
          <div className="w-full max-w-[640px] flex flex-col items-center gap-7">
            <div className="flex flex-col items-center">
              <PrepOrb
                state={ORB_STATE_BY_STAGE[stage]}
                // The interviewer's orb. The candidate's own voice is the bars in
                // the answer bar; only the engine, whose orb is the whole call,
                // gives it the mic — its real levels, except while this screen
                // reads the first question itself. Muted, the mic is not active:
                // the engine's own level reads 0 then too, but the orb must not
                // depend on that to stop pulsing to a voice nobody hears.
                {...(engine
                  ? {
                      micActive: micOpen && !selfMuted,
                      ...(!aiSpeaking ? { getInputVolume: capture.getInputVolume, getOutputVolume: capture.getOutputVolume } : {}),
                    }
                  : {})}
                label="Your interviewer"
                caption={orbCaption}
                captionEmphasis={orbCaptionEmphasis}
              />
              <p className="mt-1 text-xs text-white/30">{formatsLabel(config.formats)}</p>
            </div>

            {engineLost ? (
              <div role="alert" className="w-full max-w-[420px] rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-center">
                <p className="text-[15px] font-bold">The interviewer disconnected</p>
                <p className="text-sm text-white/70 leading-relaxed mt-1.5">
                  {engineAnswered
                    ? "The interview has ended. What you recorded so far is saved: get a report on it, or delete it and start again."
                    : "The interview ended before any answers, so nothing was saved."}
                </p>
                <div className="flex gap-2.5 flex-wrap justify-center mt-4">
                  {engineAnswered && (
                    <button
                      type="button"
                      onClick={() => void finishSession("ended-early", withPendingAnswer())}
                      disabled={restarting}
                      className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-[#222325] bg-[#e1f073] px-5 py-2.5 text-sm font-bold text-[#222325] cursor-pointer shadow-[2px_2px_0_0_#ffffff] transition-[transform,box-shadow] duration-100 hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-35 disabled:pointer-events-none">
                      <FileText className="h-4 w-4" />
                      Finish and get my report
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void startOver()}
                    disabled={restarting}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold text-white cursor-pointer hover:border-white/45 transition-colors disabled:opacity-35 disabled:pointer-events-none">
                    {restarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Start over
                  </button>
                </div>
              </div>
            ) : engine ? (
              interviewerLine && (
                <div className="text-center">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#e1f073] mb-3">{engineQuestion ? eyebrowFor(stage) : "Interviewer"}</p>
                  <p className="text-xl font-bold leading-snug text-balance">{engineQuestion ? engineQuestion.text : interviewerLine}</p>
                  {engineQuestion && <p className="text-xs text-white/40 mt-3">{questionNote(engineQuestion, tailoredSession)}</p>}
                </div>
              )
            ) : (
              currentQuestion && (
                <div className="text-center">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#e1f073] mb-3">{eyebrowFor(stage)}</p>
                  <p className="text-xl font-bold leading-snug text-balance">{currentQuestion.text}</p>
                  <p className="text-xs text-white/40 mt-3">{questionNote(currentQuestion, tailoredSession)}</p>
                </div>
              )
            )}

            {recording && (
              <div className="flex flex-col items-center gap-1.5 text-center text-[11px] text-white/35">
                <p>
                  {engine
                    ? "Transcript updates after each answer."
                    : captionsLive
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
      {!showPrecall && !engineLost && (phase === "active" || phase === "thinking") && (
        // Tighter at the bottom where the footnote closes it.
        <div className={cn("border-t border-white/10 px-6 flex-none", engine && !engineTyping ? "py-4" : "pt-3.5 pb-2.5")}>
          {engine ? (
            // Nothing to press to move on: the engine does that when an answer ends.
            <>
              <div className="mx-auto flex max-w-[1100px] items-center gap-3">
                {engineTyping ? (
                  // The candidate's voice where the instruction was, as on the other
                  // two bars; the instruction is the footnote below.
                  <TypeAnswerPanel
                    onSend={sendTypedToEngine}
                    onTyping={signalEngineTyping}
                    disabled={phase !== "active"}
                    beside={candidateBars}
                    tone="dark"
                    className="min-w-0 flex-1"
                  />
                ) : (
                  // No live call: bars would meter nothing, so the status stays in words.
                  <p className="flex-1 text-xs text-white/35">{engineHint}</p>
                )}
                {engineDone && (
                  <button
                    type="button"
                    onClick={() => void finishSession("completed", withPendingAnswer())}
                    className={cn(
                      "flex-none inline-flex items-center gap-2.5 h-[52px] rounded-xl border-[1.5px] border-[#222325] bg-[#e1f073] px-5 text-sm font-bold text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out",
                      "shadow-[2px_2px_0_0_#ffffff] hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    )}>
                    <FileText className="h-4 w-4" />
                    Finish and get my report
                  </button>
                )}
              </div>
              {engineTyping && engineFootnote}
            </>
          ) : recording ? (
            <>
              <div className="mx-auto flex max-w-[1100px] items-center gap-3">
                {/* Speaking is the session. Typing is one icon that opens a
                    composer, and it warns once that a typed answer is left out
                    of the delivery scoring — which is measured from the voice. */}
                <TypeAnswerPanel
                  onSend={(text) => {
                    typedAtRef.current = performance.now();
                    return commitAnswer(text);
                  }}
                  onTyping={() => {
                    typedAtRef.current = performance.now();
                  }}
                  onOpenChange={setComposerOpen}
                  disabled={phase !== "active"}
                  beside={candidateBars}
                  // No label on the composer's submit: the button beside it
                  // already says "Next", and both do the same thing.
                  tone="dark"
                  className="min-w-0 flex-1"
                />
                {nextButton(phase !== "active")}
              </div>
              {footnote}
            </>
          ) : (
            // Unsaved, but still spoken: the same shape as a recorded session's
            // bar. There is no draft box, because a draft box is what made this
            // feel like a form — what is heard shows in the transcript and goes
            // once the answer is over.
            <>
              <div className="mx-auto flex max-w-[1100px] items-center gap-3">
                {/* Speaking is the session; the keyboard is one icon that opens a
                    composer. No confirmation here: this session records nothing
                    and is never scored for delivery, so there is nothing to warn
                    about. Open from the start where there is no other way in.
                    It edits the answer itself rather than a second box beside it
                    — one buffer, as the old textarea was, so a line typed on top
                    of a spoken answer adds to it instead of replacing it, and so
                    either way of sending sends the same words. */}
                <TypeAnswerPanel
                  onSend={(text) => {
                    typedAtRef.current = performance.now();
                    return commitAnswer(text);
                  }}
                  onTyping={() => {
                    typedAtRef.current = performance.now();
                  }}
                  value={draft}
                  onValueChange={setDraft}
                  onOpenChange={setComposerOpen}
                  confirm={false}
                  defaultOpen={!dictationSupported || micStatus === "denied" || micStatus === "unsupported"}
                  disabled={phase !== "active"}
                  beside={candidateBars}
                  hint={problemHint}
                  tone="dark"
                  className="min-w-0 flex-1"
                />
                {/* Not a Talk button: the mic opens itself. This is the only way
                    back from a mic another app took, or a recognizer that would
                    not run — which is the other thing the old Talk button did.
                    Sized as Next is, so the bar keeps one height. */}
                {micStatus === "unavailable" && (
                  <button type="button" onClick={startDictation} className={secondaryButton}>
                    <Mic className="h-3 w-3" aria-hidden />
                    Try my mic again
                  </button>
                )}
                {/* Disabled on an empty draft, unlike a recorded session's: with
                    no recording behind it commitAnswer builds no turn for an
                    empty answer, so pressing it would skip the question. */}
                {nextButton(phase !== "active" || !draft.trim())}
              </div>
              {footnote}
            </>
          )}
        </div>
      )}
      </div>

      <div className="flex flex-col max-h-[360px] border-t border-white/10 bg-black/15 lg:max-h-none lg:w-[380px] xl:w-[420px] lg:flex-none lg:border-t-0 lg:border-l">
        <InterviewTranscript
          entries={transcriptEntries}
          interim={interim}
          pending={phase === "thinking" ? "Thinking of a follow-up…" : undefined}
          open={transcriptOpen}
          onOpenChange={setTranscriptOpen}
          tone="dark"
          fill
          openOnDesktop
          className="min-h-0 flex-1"
        />
      </div>
      </div>
    </div>
  );
};

export default PrepLive;
