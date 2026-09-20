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
// required for the session to work, so permission is only ever requested when
// the user actually presses Dictate.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

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
}

export interface UseVoiceSessionOptions {
  /** Called with each finalised chunk of dictated speech. */
  onTranscript: (text: string) => void;
  /** Whether the interviewer's voice is enabled. */
  voiceEnabled: boolean;
}

export function useVoiceSession({ onTranscript, voiceEnabled }: UseVoiceSessionOptions): VoiceSession {
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [interim, setInterim] = useState("");

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
  const loudFramesRef = useRef(0);
  // The interviewer's audio, when a question is played from storage rather than
  // spoken by the browser. Held in a ref for the same reason as the utterance
  // guard above: it outlives a render and has to be stoppable from anywhere.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Bumped by every speak(). A URL that arrives after the next question has
  // started belongs to a question nobody is on any more.
  const speechAttemptRef = useRef(0);
  // Held in a ref so the recognition handler always sees the latest callback
  // without having to tear down and rebuild recognition on every render.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

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
      recognition.onerror = (e) => {
        const code = e.error ?? "";
        // Silence is the one error a fresh recognizer can fix.
        if (code === "no-speech") return;
        outcome = DENIED_ERRORS.has(code) ? "denied" : code === "aborted" ? "idle" : "unavailable";
        // Settled here, not only in onend: not every browser follows an error with an end.
        if (recognitionRef.current === recognition) finish(outcome);
      };
      recognition.onend = () => {
        // Stopped on purpose, or already settled by onerror.
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        setInterim("");
        quickEnds = performance.now() - startedAt < QUICK_END_MS ? quickEnds + 1 : 0;
        const micLive = streamRef.current?.getAudioTracks().some((track) => track.readyState === "live") ?? false;
        const wanted = holdingRef.current && outcome === null && micLive && performance.now() - heardAt < IDLE_STOP_MS;
        if (wanted && quickEnds < MAX_QUICK_ENDS && run()) return;
        // Ending in a row straight after starting is a recognizer that can't run, not a pause.
        finish(outcome ?? (wanted ? "unavailable" : "idle"));
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

  const startDictation = useCallback(async () => {
    // One start at a time. The button still offers to start while the first
    // press waits on the mic prompt.
    if (startingRef.current || holdingRef.current) return;
    if (!getRecognitionCtor()) {
      setMicStatus("unsupported");
      return;
    }
    // Barge-in: you can't talk over the interviewer, so taking the mic stops
    // them mid-sentence rather than letting two voices overlap.
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    }
    setAiSpeaking(false);
    setMicStatus("requesting");
    startingRef.current = true;
    const attempt = ++attemptRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (attempt !== attemptRef.current) {
        // Stopped, or the screen went away, while the permission prompt was up.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtor();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
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

          // Sustained speech while the interviewer is talking counts as an
          // interruption. Requiring several consecutive loud frames keeps a
          // cough or a keyboard knock from cutting them off.
          if (level > 0.22) {
            loudFramesRef.current += 1;
            if (loudFramesRef.current > 6 && typeof window !== "undefined") {
              // Either voice may be the one talking: a question played from
              // storage is an <audio> element, not an utterance.
              const audio = audioRef.current;
              if (audio && !audio.paused) {
                audio.pause();
                audioRef.current = null;
                setAiSpeaking(false);
              }
              if (window.speechSynthesis.speaking) {
                window.speechSynthesis.resume();
                window.speechSynthesis.cancel();
                setAiSpeaking(false);
              }
            }
          } else {
            loudFramesRef.current = 0;
          }

          listenersRef.current.forEach((cb) => cb(level));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      holdingRef.current = true;
      if (!startRecognition()) {
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
  }, [finish, startRecognition]);

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

  /** Stops the audio element, if one is playing, and releases it. */
  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;
    // Handlers first: pause() fires nothing, but src="" makes some browsers
    // raise an error event, which would otherwise look like a failed question
    // and start the fallback voice on top of the next one.
    audio.onplaying = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  }, []);

  const cancelSpeech = useCallback(() => {
    stopAudio();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // resume() first: a paused queue in Chrome ignores cancel() outright, and
    // a half-spoken utterance then resurfaces later.
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    setAiSpeaking(false);
  }, [stopAudio]);

  /** The browser's own voice. The fallback, and what speaks when no URL is offered. */
  const speakInBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (!liveRef.current) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.pitch = 1;
    utter.onstart = () => {
      // The session can end between queueing and starting.
      if (!liveRef.current) {
        window.speechSynthesis.cancel();
        return;
      }
      setAiSpeaking(true);
    };
    utter.onend = () => setAiSpeaking(false);
    utter.onerror = () => setAiSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, []);

  const speak = useCallback(
    (text: string, resolveUrl?: () => Promise<string | null>) => {
      cancelSpeech();
      if (!voiceEnabled || !liveRef.current) return;
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
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onplaying = () => {
            if (stale()) {
              audio.pause();
              return;
            }
            setAiSpeaking(true);
          };
          audio.onended = () => {
            if (audioRef.current === audio) audioRef.current = null;
            setAiSpeaking(false);
          };
          // A 403 means the presigned URL expired; the browser's voice covers
          // this question and the next one asks for a fresh URL anyway.
          audio.onerror = () => {
            if (audioRef.current === audio) audioRef.current = null;
            if (!stale()) speakInBrowser(text);
          };
          void audio.play().catch(() => {
            // Autoplay refused, or the element was torn down mid-play.
            if (audioRef.current === audio) audioRef.current = null;
            if (!stale()) speakInBrowser(text);
          });
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

  return { micStatus, aiSpeaking, dictationSupported, interim, finalizing, startDictation, stopDictation, speak, cancelSpeech, onLevel };
}
