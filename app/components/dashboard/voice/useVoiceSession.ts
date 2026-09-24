"use client";

// The live session's audio layer.
//
// Everything here is real browser capability. The one thing it does not own is
// where the interviewer's audio comes from: `speak` takes a resolver from the
// caller and only plays what it returns, so this file still makes no requests.
//   - mic level  -> Web Audio AnalyserNode, for the user's waveform
//   - dictation  -> SpeechRecognition (webkit-prefixed in Chrome and Safari)
//   - AI voice   -> an <audio> element when the caller resolves a URL for the
//                   line (synthesized server-side and cached), and the browser's
//                   own speechSynthesis otherwise, or whenever that fails
//
// Dictation is the browser's Web Speech API and nothing else, on every screen
// that has it (the career coach, Ask about a job, prep's typed answers). No
// audio from here reaches our servers; the browser may send it to its own
// speech service (Chrome sends it to Google). A voice interview's recording
// and captions are a separate path with their own capture.
//
// All three degrade independently. A browser without SpeechRecognition
// (Firefox) reports `dictationSupported: false`, so callers take the mic away
// and the user types; one without a mic still gets typing. Nothing here is
// required for the session to work, so permission is requested only when a
// screen asks for it — a press on the career coach and Ask about a job, the
// start of the session in prep's unsaved interview, which is spoken throughout.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { interviewerAudioWanted, offerInterviewerAudio } from "@/app/lib/voice/capture/interviewerAudio";
import { voiceSpectrumBins } from "@/app/lib/voice/frequencyBars";

// Minimal shape of the Web Speech API — TypeScript's DOM lib doesn't ship it.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Capability never changes for the life of the page, so nothing to subscribe to. */
const subscribeNoop = () => () => {};

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// A continuous recognizer still ends whenever the browser decides: after a few
// seconds of silence, on a network blip, or (Safari) after each utterance.
// While the user holds dictation a fresh one takes over on the same mic, but
// only within these bounds, so a recognizer that can never run does not spin,
// and a mic left on in an empty room goes off by itself.
/** A recognizer that ends this soon after starting counts as a failed start, not a pause. */
const QUICK_END_MS = 1_000;
/** Failed starts in a row before dictation gives up. */
const MAX_QUICK_ENDS = 3;
/** Nothing recognised for this long, and a recognizer the browser ended is not replaced. */
const IDLE_STOP_MS = 60_000;

// Barge-in: talking over the interviewer stops them, as it would a real one.
// In milliseconds, not animation frames — frames come at the display's rate, 60
// to 144 a second, so counting them made the hold depend on the screen.
/** Mic level that counts as somebody talking. */
const BARGE_LEVEL = 0.22;
/** How long it has to be held: long enough that a cough or a keyboard knock is not an interruption. */
const BARGE_HOLD_MS = 110;
/**
 * The browser's echo cancellation only covers audio the page itself renders. An
 * <audio> element is in that mix; `speechSynthesis` is not — that voice is
 * spoken by the platform (SAPI on Windows, AVSpeechSynthesizer on macOS)
 * outside the page's audio path. So on speakers the mic hears our own voice at
 * full volume, and a plain level gate has the interviewer cut itself off two
 * words into every question — which is what happens now that a screen can leave
 * the mic open through the questions instead of opening it for one answer.
 *
 * While that voice is the one playing, the bar is set from what the mic hears
 * of it: nothing can interrupt the first ECHO_PROBE_MS after the voice becomes
 * audible, the loudest level heard of the line so far is taken as the echo,
 * and only ECHO_MARGIN above that is somebody talking over it. On headphones
 * the echo is next to nothing and this lands back on BARGE_LEVEL.
 *
 * "Audible" is the utterance's `start` event (an <audio> element's `playing`),
 * not `speechSynthesis.speaking`. That flag is true from the moment a line is
 * QUEUED — measured 0.2-0.6 s before the voice sounds on a warm page and up to
 * ~2 s on a cold one — so a probe timed from it measured the room, not the
 * voice, and on speakers the interviewer cut itself off about 110 ms into every
 * question: a silent interview. The cost is that somebody already talking when
 * a line starts is measured as part of the echo — a line that is not stopped,
 * rather than one stopped by itself.
 *
 * After the probe the estimate may still grow, because a later syllable louder
 * than the opening is still echo — but only by ECHO_GROWTH. It used to follow
 * the line's running peak with no bound, and every frame within ECHO_MARGIN of
 * that peak raised it. The analyser's smoothing turns a voice starting into a
 * ramp that climbs less than that a frame, so the bar climbed just ahead of
 * the candidate: on speakers they had to be about three times louder than the
 * echo to cut in, and once the echo read 0.88 the bar passed the level's own
 * ceiling of 1 and nobody could. Now the bar is bounded by the probe and capped
 * under the ceiling (ECHO_BAR_MAX), and the lost protection against a louder
 * syllable is taken back in time instead: over audible echo, cutting in takes
 * ECHO_HOLD_MS over the bar, gained while over it and drained while under, so
 * the gaps between somebody's words do not start them again and a louder
 * syllable of the voice drains away before it gets there. Modelled on this
 * file's level mapping and the analyser's smoothing, not measured on a device:
 * no self-interruption from syllables up to +0.2 over the line's opening, and
 * a talk-over at about 0.2 above the echo gets through in 0.3-0.8 s.
 */
const ECHO_PROBE_MS = 400;
const ECHO_MARGIN = 0.12;
/** The most the echo estimate grows past what the probe measured: louder syllables, not the candidate's onset. */
const ECHO_GROWTH = ECHO_MARGIN / 2;
/** The bar never reaches the level's ceiling (1), so a loud enough voice can always cut in. */
const ECHO_BAR_MAX = 0.95;
/** How long the level must be over the bar when the mic hears the voice itself: longer than one of its syllables. */
const ECHO_HOLD_MS = 250;
/** The same where the voice is so loud the bar sits at ECHO_BAR_MAX, within reach of its own peaks. */
const ECHO_HOLD_CAPPED_MS = 500;
/** The most one frame adds to a hold. Frames stop in a background tab, and the first one back must not count the gap. */
const MAX_FRAME_MS = 100;
/**
 * A bar this high is over a normal speaking voice (0.3-0.6 at a normal
 * distance): on speakers at that volume, cutting in takes raising it, and
 * `echoLoud` says so rather than letting the screen promise a plain talk-over.
 */
const LOUD_ECHO_BAR = 0.6;

/** Recognition errors that mean the permission is gone: the button stays off. */
const DENIED_ERRORS: ReadonlySet<string> = new Set(["not-allowed", "service-not-allowed"]);

const UNAVAILABLE_TOAST_ID = "dictation-unavailable";

/** getUserMedia's refusals, including the name older Chrome used. */
function isPermissionError(error: unknown): boolean {
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError";
}

/**
 * - "unsupported": this browser has no speech recognition (Firefox).
 * - "denied": the mic or the speech service was refused; the button stays off.
 * - "unavailable": dictation could not start, or stopped on an error (no
 *   microphone, the speech service unreachable); a later press may work.
 */
export type MicStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported" | "unavailable";

export interface VoiceSession {
  micStatus: MicStatus;
  /** True while the browser is speaking a question aloud. */
  aiSpeaking: boolean;
  /**
   * The browser refused to speak: Chrome turns `speechSynthesis.speak()` down
   * with a `not-allowed` error when the page has had no user activation (a
   * hard reload of a screen that talks as it opens). Nothing is heard and
   * nothing else says so, so a caller offers a press, which is the activation.
   * Cleared the next time a line starts.
   */
  voiceBlocked: boolean;
  /** Whether dictation is available at all in this browser. False where SpeechRecognition is missing, so callers hide the mic. */
  dictationSupported: boolean;
  /** Live partial transcript while dictating; empty once committed. */
  interim: string;
  /**
   * Words have been spoken that onTranscript has not delivered yet: the
   * browser's recognition still shows them as partial. A send-after-silence
   * waits for this to clear.
   */
  finalizing: boolean;
  startDictation: () => void;
  stopDictation: () => void;
  /**
   * The user muted themselves. The level stream's track is disabled (the
   * level and the bars read 0, so nothing can barge in) and the recognizer,
   * which opens a mic of its own, is stopped: the words said before the press
   * still arrive, nothing after it is heard or sent to the browser's speech
   * service. Dictation stays "listening" — the mic is held, only not heard —
   * so a screen that re-arms on "idle" does not reopen it; the unmute starts
   * a fresh recognizer. Kept, so a mic opened while muted opens silenced. Stable.
   */
  setInputMuted: (muted: boolean) => void;
  /**
   * Says `text` out loud. With `resolveUrl`, the audio it returns is played
   * instead of the browser's own voice — the caller does the fetching, this
   * hook only owns playback. Falls back to `speechSynthesis` whenever that
   * returns null or fails, so a provider outage costs quality, not the session.
   */
  speak: (text: string, resolveUrl?: () => Promise<string | null>) => void;
  cancelSpeech: () => void;
  /**
   * Subscribes a callback to the mic's amplitude, 0-1, on every animation
   * frame. Returns an unsubscribe. Deliberately a subscription rather than
   * state: at 60fps a setState would re-render the whole session screen.
   */
  onLevel: (cb: (level: number) => void) => () => void;
  /**
   * The mic's byte spectrum over 0-8000 Hz, for VoiceFrequencyBars; null while
   * the mic is closed. The same buffer the level is read from each frame — one
   * analyser read, so the bars show what barge-in and the level hear. Stable.
   */
  getInputFrequencyData: () => Uint8Array | null;
  /**
   * Judges one level from a mic this hook does not own — a recording's, whose
   * stream and analyser belong to the capture — for barge-in, exactly as a
   * dictation frame is judged. Call it once per frame, and only while
   * dictation is not running, so no frame is counted twice. Stable.
   */
  feedLevel: (level: number) => void;
  /**
   * The last level judged was the interviewer's own voice through the speakers
   * and nothing over it: the browser's voice, which is outside the page's echo
   * cancellation, is playing and the mic is under the bar a candidate talking
   * over it would clear. A caller showing the
   * candidate's voice rests it then, rather than drawing the question as if
   * they were speaking. Stable; read per frame.
   */
  hearsOnlyEcho: () => boolean;
  /**
   * The line playing is loud enough in the mic (speakers, turned up) that a
   * normal speaking voice will not cut in — see LOUD_ECHO_BAR. Set once a line
   * has been measured, cleared when it ends.
   */
  echoLoud: boolean;
}

export interface UseVoiceSessionOptions {
  /** Called with each finalised chunk of dictated speech. */
  onTranscript: (text: string) => void;
  /** Whether the interviewer's voice is enabled. */
  voiceEnabled: boolean;
  /**
   * The user talked over the interviewer and the line playing was stopped
   * mid-sentence. Said out loud because a caller keeping the session's record
   * has two things to correct for it: the line was not read in full, and what
   * the recognition hands over next is the user's, not the speakers'.
   */
  onBargeIn?: () => void;
  /**
   * The mic's constraints. Defaults to `true`, the browser's own defaults,
   * which is right for a screen that opens the mic for one dictated answer.
   * A screen that leaves it open for a whole session passes its own: automatic
   * gain turns silence up until room noise reads as speech, and a
   * send-after-silence that never sees silence never sends.
   */
  audio?: MediaTrackConstraints | true;
  /**
   * Whether opening the mic silences the interviewer. Defaults to true: on a
   * screen where a press takes the mic, taking it is the interruption. False
   * for a screen that opens the mic itself and keeps it open (prep's unsaved
   * interview): there the level loop decides what is an interruption, and a
   * re-arm — the recognizer retired after a minute of quiet — must not cancel
   * a question that is queued but not yet audible, which `aiSpeaking` cannot see.
   */
  interruptOnListen?: boolean;
}

/**
 * Barge-in's reading of the line now playing. Kept across frames, and outside
 * the dictation loop, because a recording's mic feeds the same judgement
 * (feedLevel). Reset whenever nothing of the interviewer's is playing.
 */
interface EchoGate {
  /** The line this reading is of: when it became audible. A new line starts a new reading. */
  line: number | null;
  /**
   * The first frame judged of it. The probe runs from whichever is later, so a
   * line that was already playing when frames resumed (a tab brought back) is
   * still measured before it can be interrupted, not judged against no echo.
   */
  since: number | null;
  /** The loudest level taken as the interviewer's own voice this line. */
  peak: number;
  /** `peak` as the probe left it, null until the probe is over; the estimate grows at most ECHO_GROWTH past it. */
  probed: number | null;
  /** The last frame judged, for how much time each one adds. */
  lastAt: number | null;
  /** Time over the bar, gained over it and drained under it: barge-in at the hold. */
  loudMs: number;
  /** The last level judged was the interviewer and nothing over it. */
  echoOnly: boolean;
}

const freshGate = (line: number | null = null): EchoGate => ({ line, since: null, lastAt: null, peak: 0, probed: null, loudMs: 0, echoOnly: false });

export function useVoiceSession({ onTranscript, voiceEnabled, audio = true, onBargeIn, interruptOnListen = true }: UseVoiceSessionOptions): VoiceSession {
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const [interim, setInterim] = useState("");
  const [echoLoud, setEchoLoud] = useState(false);

  // A browser capability, not React state: read through useSyncExternalStore
  // so the server renders `false` and the client corrects it during hydration
  // without a setState-in-effect cascade.
  const dictationSupported = useSyncExternalStore(subscribeNoop, () => getRecognitionCtor() !== null, () => false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const listenersRef = useRef<Set<(level: number) => void>>(new Set());
  // The recognizer currently dictating. Cleared before any stop or abort, so an
  // event from a recognizer that is no longer this one is recognised as stale.
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // True from a successful Dictate press until the user stops or dictation
  // fails for good: the only state in which a browser-ended recognizer is replaced.
  const holdingRef = useRef(false);
  // Bumped by every stop and on unmount. A start still waiting on the mic
  // prompt compares it afterwards, so pressing Stop mid-start is not undone
  // when that start completes.
  const attemptRef = useRef(0);
  const startingRef = useRef(false);
  // Latched false on teardown. speechSynthesis is a global that outlives this
  // component, so without a guard an utterance queued a moment before
  // navigation keeps talking on the next screen.
  const liveRef = useRef(true);
  // The interviewer's audio, when a question is played from storage rather than
  // spoken by the browser. Held in a ref for the same reason as the utterance
  // guard above: it outlives a render and has to be stoppable from anywhere.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Bumped by every speak() and cancelSpeech(). A URL that arrives after the
  // next question has started, or after a cancel, belongs to speech nobody wants.
  const speechAttemptRef = useRef(0);
  // The browser's line now queued or speaking. Its events act only while it is
  // this one, so a cancelled line's late `interrupted` error cannot clear the
  // next line's `aiSpeaking`. Holding it also keeps Chrome from garbage
  // collecting an utterance mid-line, which drops its `end` and would latch
  // `aiSpeaking` true.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // When the interviewer's current line became audible (performance.now()), or
  // null before it has: the echo probe's clock. See ECHO_PROBE_MS.
  const voiceAudibleAtRef = useRef<number | null>(null);
  // A view on the analyser buffer the level loop fills: the spectrum the bars draw.
  const spectrumRef = useRef<Uint8Array | null>(null);
  const gateRef = useRef<EchoGate>(freshGate());
  // `echoLoud` as last set, so a per-frame judgement sets state only on a change.
  const echoLoudRef = useRef(false);
  // The user's mute (setInputMuted), read wherever the mic or a recognizer starts.
  const inputMutedRef = useRef(false);
  // Held in a ref so the recognition handler always sees the latest callback
  // without having to tear down and rebuild recognition on every render.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  const onBargeInRef = useRef(onBargeIn);
  useEffect(() => {
    onBargeInRef.current = onBargeIn;
  }, [onBargeIn]);
  // Same reason, and one more: `startDictation` has to stay referentially
  // stable, because a caller that opens the mic from an effect has it in that
  // effect's dependencies. Closing over the constraints directly would rebuild
  // it whenever a caller passed a fresh object.
  const micConstraintsRef = useRef(audio);
  useEffect(() => {
    micConstraintsRef.current = audio;
  }, [audio]);
  const interruptOnListenRef = useRef(interruptOnListen);
  useEffect(() => {
    interruptOnListenRef.current = interruptOnListen;
  }, [interruptOnListen]);

  const onLevel = useCallback((cb: (level: number) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const teardownAudio = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    spectrumRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    listenersRef.current.forEach((cb) => cb(0));
  }, []);

  /**
   * Dictation is over, whatever ended it. The mic and analyser are released and
   * the button says why. This is the one exit for every end the user did not
   * ask for; the old stuck "listening" state was a browser-ended recognizer
   * that only had its interim text cleared.
   */
  const finish = useCallback(
    (status: MicStatus) => {
      holdingRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition?.abort();
      teardownAudio();
      setInterim("");
      setMicStatus(status);
      // Said out loud: the button looks just as it did before it was pressed.
      if (status === "unavailable") toast.error("Dictation isn't available right now. You can still type.", { id: UNAVAILABLE_TOAST_ID });
    },
    [teardownAudio],
  );

  /** Starts the browser's recognition on the held mic. False when it refuses to start. */
  const startRecognition = useCallback((): boolean => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;
    let quickEnds = 0;
    let heardAt = performance.now();

    const run = (): boolean => {
      const recognition = new Ctor();
      const startedAt = performance.now();
      // How this recognizer's error ends dictation; null while a replacement is still allowed.
      let outcome: MicStatus | null = null;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (e) => {
        const current = recognitionRef.current === recognition;
        if (current) heardAt = performance.now();
        let finalText = "";
        let partial = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else partial += r[0].transcript;
        }
        // A stopped recognizer still hands over the words already spoken.
        if (finalText) onTranscriptRef.current(finalText);
        // Its partials are not shown: nothing is left to clear them, and a
        // leftover partial would hold `finalizing` true for good.
        if (current) setInterim(partial);
      };
      /** This recognizer is over: a fresh one takes over on the same mic while that is still wanted and still bounded. */
      const ended = () => {
        recognitionRef.current = null;
        setInterim("");
        quickEnds = performance.now() - startedAt < QUICK_END_MS ? quickEnds + 1 : 0;
        const micLive = streamRef.current?.getAudioTracks().some((track) => track.readyState === "live") ?? false;
        const wanted = holdingRef.current && outcome === null && micLive && performance.now() - heardAt < IDLE_STOP_MS;
        if (wanted && quickEnds < MAX_QUICK_ENDS && run()) return;
        // Ending in a row straight after starting is a recognizer that can't run, not a pause.
        finish(outcome ?? (wanted ? "unavailable" : "idle"));
      };
      recognition.onerror = (e) => {
        const code = e.error ?? "";
        // Silence is the one error a fresh recognizer can fix.
        if (code === "no-speech") return;
        if (code === "aborted") {
          // Nothing here aborts the current recognizer — every stop and abort
          // lets go of it first — so this is the browser handing recognition
          // to another page: Chrome runs one at a time and aborts the last one
          // when another starts. It used to end dictation ("idle"), which a
          // screen that keeps its mic open re-armed at once with a new stream
          // and AudioContext, aborting the other page's in turn: two tabs of
          // one interview did that to each other forever. Now it is an end
          // like any other: replaced on the same mic, and counted, so a tug of
          // war lands on "unavailable" after MAX_QUICK_ENDS rather than spinning.
          if (recognitionRef.current === recognition) ended();
          return;
        }
        outcome = DENIED_ERRORS.has(code) ? "denied" : "unavailable";
        // Settled here, not only in onend: not every browser follows an error with an end.
        if (recognitionRef.current === recognition) finish(outcome);
      };
      recognition.onend = () => {
        // Stopped on purpose, or already settled by onerror.
        if (recognitionRef.current !== recognition) return;
        ended();
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        return false;
      }
      return true;
    };

    return run();
  }, [finish]);

  const sayEchoLoud = useCallback((loud: boolean) => {
    if (echoLoudRef.current === loud) return;
    echoLoudRef.current = loud;
    setEchoLoud(loud);
  }, []);

  /**
   * Barge-in, and the echo it has to be told apart from: one mic level, judged
   * against the line now playing. Timed from when the voice became audible
   * (voiceAudibleAtRef) and read from the audio itself, not from `aiSpeaking`,
   * which lands a render after the sound. Either voice may be the one talking:
   * a question played from storage is an <audio> element, not an utterance.
   */
  const judgeLevel = useCallback(
    (level: number) => {
      const now = performance.now();
      const element = audioRef.current;
      const fromStorage = Boolean(element && !element.paused);
      // Only once the line is audible: `speaking` alone is true while it
      // is still queued, and the room then is not the echo.
      const audibleAt = voiceAudibleAtRef.current;
      const fromBrowser =
        !fromStorage && audibleAt !== null && typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking;
      if (!fromStorage && !fromBrowser) {
        if (gateRef.current.line !== null || gateRef.current.since !== null) gateRef.current = freshGate();
        gateRef.current.echoOnly = false;
        sayEchoLoud(false);
        return;
      }
      if (gateRef.current.line !== audibleAt) {
        gateRef.current = freshGate(audibleAt);
        sayEchoLoud(false);
      }
      const gate = gateRef.current;
      // A frame's worth of time, capped: frames stop in a background tab, and the first one back is not that long spent loud.
      const frameMs = gate.lastAt === null ? 0 : Math.min(MAX_FRAME_MS, now - gate.lastAt);
      gate.lastAt = now;
      gate.since ??= now;
      let bar = BARGE_LEVEL;
      let hold = BARGE_HOLD_MS;
      // The browser's voice is not in the page's echo-cancelled mix, so each of
      // its lines is measured rather than judged — see ECHO_PROBE_MS.
      if (fromBrowser && audibleAt !== null) {
        if (now - Math.max(audibleAt, gate.since) < ECHO_PROBE_MS) {
          gate.peak = Math.max(gate.peak, level);
          gate.echoOnly = true;
          return;
        }
        if (gate.probed === null) {
          gate.probed = gate.peak;
          sayEchoLoud(Math.max(BARGE_LEVEL, gate.probed + ECHO_MARGIN) >= LOUD_ECHO_BAR);
        }
        const wanted = Math.max(BARGE_LEVEL, gate.peak + ECHO_MARGIN);
        bar = Math.min(ECHO_BAR_MAX, wanted);
        // Audible echo: one of its louder syllables must not read as a talk-over.
        // Longer again where the cap took the margin away, and the voice's own
        // peaks can reach the bar.
        if (gate.probed + ECHO_MARGIN > BARGE_LEVEL) hold = wanted > ECHO_BAR_MAX ? ECHO_HOLD_CAPPED_MS : ECHO_HOLD_MS;
      }
      if (level <= bar) {
        // Leaky rather than reset: the gaps between somebody's words must not
        // start their talk-over again, and a lone loud syllable drains away.
        gate.loudMs = Math.max(0, gate.loudMs - frameMs);
        // A question from storage is echo-cancelled: what the mic hears under it is the room, or the candidate.
        gate.echoOnly = fromBrowser;
        // Up to its bound only — see ECHO_GROWTH. Past it is too loud for the
        // voice and not yet loud enough to be somebody over it.
        if (fromBrowser && gate.probed !== null && level <= gate.probed + ECHO_GROWTH) gate.peak = Math.max(gate.peak, level);
        return;
      }
      gate.echoOnly = false;
      gate.loudMs += frameMs;
      if (gate.loudMs < hold) return;
      gateRef.current = freshGate();
      sayEchoLoud(false);
      // Invalidated as cancelSpeech does it, so a line whose audio is
      // still being fetched cannot start talking over the answer.
      speechAttemptRef.current += 1;
      voiceAudibleAtRef.current = null;
      if (fromStorage && element) {
        element.pause();
        audioRef.current = null;
      }
      if (fromBrowser) {
        // Let go first, so the cancelled line's `interrupted` error is stale when it lands.
        utteranceRef.current = null;
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      }
      setAiSpeaking(false);
      onBargeInRef.current?.();
    },
    [sayEchoLoud],
  );

  const startDictation = useCallback(async () => {
    // One start at a time. The button still offers to start while the first
    // press waits on the mic prompt.
    if (startingRef.current || holdingRef.current) return;
    if (!getRecognitionCtor()) {
      setMicStatus("unsupported");
      return;
    }
    // Barge-in: you can't talk over the interviewer, so taking the mic stops
    // them mid-sentence rather than letting two voices overlap. Not on a
    // screen that opens the mic by itself — see `interruptOnListen`.
    if (interruptOnListenRef.current) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      }
      setAiSpeaking(false);
    }
    setMicStatus("requesting");
    startingRef.current = true;
    const attempt = ++attemptRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraintsRef.current });
      if (attempt !== attemptRef.current) {
        // Stopped, or the screen went away, while the permission prompt was up.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      // Muted while the prompt was up: the mic opens silenced.
      if (inputMutedRef.current) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtor();
      // A context created outside a user gesture starts suspended and reads
      // silence — which, for a mic a screen opened rather than a press, means a
      // send-after-silence that arms once and never fires. micLevel.ts does the
      // same for the recording branch.
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      // The bars draw from this same buffer, filled once a frame below.
      spectrumRef.current = data.subarray(0, voiceSpectrumBins(ctx.sampleRate, analyser.frequencyBinCount));
      const tick = () => {
        const a = analyserRef.current;
        if (a) {
          a.getByteFrequencyData(data);
          // RMS over the low/mid bins, where speech energy actually sits.
          const bins = Math.min(data.length, 64);
          let sum = 0;
          for (let i = 0; i < bins; i++) sum += data[i] * data[i];
          const rms = Math.sqrt(sum / bins) / 255;
          const level = Math.min(1, rms * 2.2);
          // Sustained speech while the interviewer is talking counts as an interruption.
          judgeLevel(level);
          listenersRef.current.forEach((cb) => cb(level));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      holdingRef.current = true;
      // Muted, the recognizer waits for the unmute (setInputMuted).
      if (!inputMutedRef.current && !startRecognition()) {
        finish("unavailable");
        return;
      }
      setMicStatus("listening");
    } catch (error) {
      if (attempt !== attemptRef.current) return;
      // A refusal turns the mic off; anything else (no microphone, one another
      // app holds, an insecure page) may work on a later press.
      finish(isPermissionError(error) ? "denied" : "unavailable");
    } finally {
      if (attempt === attemptRef.current) startingRef.current = false;
    }
  }, [finish, startRecognition, judgeLevel]);

  const stopDictation = useCallback(() => {
    attemptRef.current += 1;
    startingRef.current = false;
    holdingRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    // stop(), not abort(): the words already spoken still arrive as a final
    // result a moment later.
    recognition?.stop();
    teardownAudio();
    setInterim("");
    setMicStatus("idle");
  }, [teardownAudio]);

  const setInputMuted = useCallback(
    (muted: boolean) => {
      if (inputMutedRef.current === muted) return;
      inputMutedRef.current = muted;
      streamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      if (muted) {
        // Let go first, as stopDictation does: its end is then not a browser
        // ending to replace, and its last finals still arrive (onresult).
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        recognition?.stop();
        setInterim("");
        return;
      }
      // Only while dictation is held: a start still waiting on the prompt starts its own.
      if (holdingRef.current && !recognitionRef.current && !startRecognition()) finish("unavailable");
    },
    [startRecognition, finish],
  );

  /** Stops the audio element, if one is playing, and releases it. */
  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;
    voiceAudibleAtRef.current = null;
    // Handlers first: pause() fires nothing, but src="" makes some browsers
    // raise an error event, which would otherwise look like a failed question
    // and start the fallback voice on top of the next one.
    audio.onplaying = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  }, []);

  const cancelSpeech = useCallback(() => {
    speechAttemptRef.current += 1;
    stopAudio();
    // Let go before the cancel, whose `interrupted` error then finds the line stale.
    utteranceRef.current = null;
    voiceAudibleAtRef.current = null;
    setAiSpeaking(false);
    sayEchoLoud(false);
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // resume() first: a paused queue in Chrome ignores cancel() outright, and
    // a half-spoken utterance then resurfaces later.
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
  }, [stopAudio, sayEchoLoud]);

  /** The browser's own voice. The fallback, and what speaks when no URL is offered. */
  const speakInBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (!liveRef.current) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.pitch = 1;
    utteranceRef.current = utter;
    voiceAudibleAtRef.current = null;
    utter.onstart = () => {
      // The session can end between queueing and starting.
      if (!liveRef.current) {
        window.speechSynthesis.cancel();
        return;
      }
      // Cancelled as it started: no `end` will come for it, so it must not set the flag either.
      if (utteranceRef.current !== utter) return;
      voiceAudibleAtRef.current = performance.now();
      setVoiceBlocked(false);
      setAiSpeaking(true);
    };
    const settle = () => {
      utteranceRef.current = null;
      voiceAudibleAtRef.current = null;
      setAiSpeaking(false);
    };
    utter.onend = () => {
      if (utteranceRef.current === utter) settle();
    };
    utter.onerror = (event) => {
      if (utteranceRef.current !== utter) return;
      // No activation on the page yet: silent, so said out loud — see `voiceBlocked`.
      if (event.error === "not-allowed") setVoiceBlocked(true);
      settle();
    };
    window.speechSynthesis.speak(utter);
  }, []);

  const speak = useCallback(
    (text: string, resolveUrl?: () => Promise<string | null>) => {
      cancelSpeech();
      if (!voiceEnabled || !liveRef.current) return;
      // A page with no user activation yet (a hard reload) refuses the voice
      // and also leaves a mic context it opened suspended, reading silence. A
      // press that replays a refused line is that activation: resuming here,
      // inside it, brings the level (and so barge-in and the silence that ends
      // an answer) back with the voice. A no-op for a running context.
      if (ctxRef.current?.state === "suspended") void ctxRef.current.resume().catch(() => {});
      if (!resolveUrl) {
        speakInBrowser(text);
        return;
      }

      // Every speak() invalidates the one before it: a question the user has
      // already moved past must not start talking when its URL finally lands.
      speechAttemptRef.current += 1;
      const attempt = speechAttemptRef.current;
      const stale = () => attempt !== speechAttemptRef.current || !liveRef.current;

      void resolveUrl()
        .then((url) => {
          if (stale()) return;
          if (!url) {
            speakInBrowser(text);
            return;
          }
          // A recorded interview mixing its playback copy (capture/
          // interviewerAudio.ts) can only capture a cross-origin question that
          // loaded in CORS mode. Storage without a CORS rule for GET refuses
          // that load; the question is then played once more the old way,
          // uncaptured, so the mix never costs the candidate the voice.
          const play = (cors: boolean) => {
            const audio = new Audio();
            if (cors) audio.crossOrigin = "anonymous";
            audio.src = url;
            audioRef.current = audio;
            let played = false;
            audio.onplaying = () => {
              if (stale()) {
                audio.pause();
                return;
              }
              played = true;
              voiceAudibleAtRef.current = performance.now();
              setAiSpeaking(true);
            };
            audio.onended = () => {
              if (audioRef.current === audio) {
                audioRef.current = null;
                voiceAudibleAtRef.current = null;
              }
              setAiSpeaking(false);
            };
            // A 403 means the presigned URL expired; the browser's voice covers
            // this question and the next one asks for a fresh URL anyway.
            audio.onerror = () => {
              if (audioRef.current === audio) {
                audioRef.current = null;
                voiceAudibleAtRef.current = null;
              }
              if (stale()) return;
              if (cors && !played) play(false);
              else speakInBrowser(text);
            };
            if (cors) offerInterviewerAudio(audio);
            void audio.play().catch(() => {
              // A CORS load that failed: onerror retries it plainly and owns the line.
              if (cors && audio.error) return;
              // Autoplay refused, or the element was torn down mid-play.
              if (audioRef.current === audio) audioRef.current = null;
              if (!stale()) speakInBrowser(text);
            });
          };
          play(interviewerAudioWanted());
        })
        .catch(() => {
          if (!stale()) speakInBrowser(text);
        });
    },
    [cancelSpeech, speakInBrowser, voiceEnabled]
  );

  // Release the mic and silence the voice if the screen goes away mid-session.
  useEffect(() => {
    liveRef.current = true;
    // Chrome loads its voices lazily, on the first call to ask for them, and a
    // first line queued before they have loaded took ~2 s to sound on a cold
    // page. Asking at mount starts that load while a screen is still setting
    // up — prep's interview has ~900 ms of "connecting" before it speaks.
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();
    // Leaving the tab or hitting back should silence the interviewer too —
    // unmount alone doesn't fire on a bfcache navigation.
    const silence = () => {
      liveRef.current = false;
      // Invalidates any URL still in flight, so a question cannot start
      // talking on the next screen.
      speechAttemptRef.current += 1;
      stopAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      }
    };
    window.addEventListener("pagehide", silence);
    return () => {
      window.removeEventListener("pagehide", silence);
      silence();
      attemptRef.current += 1;
      startingRef.current = false;
      holdingRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition?.abort();
      teardownAudio();
    };
  }, [stopAudio, teardownAudio]);

  const finalizing = interim.trim() !== "";
  const getInputFrequencyData = useCallback(() => spectrumRef.current, []);
  const hearsOnlyEcho = useCallback(() => gateRef.current.echoOnly, []);

  return {
    micStatus,
    aiSpeaking,
    voiceBlocked,
    dictationSupported,
    interim,
    finalizing,
    startDictation,
    stopDictation,
    setInputMuted,
    speak,
    cancelSpeech,
    onLevel,
    getInputFrequencyData,
    feedLevel: judgeLevel,
    hearsOnlyEcho,
    echoLoud,
  };
}
