"use client";

// The live session's audio layer.
//
// Everything here is real browser capability, no backend:
//   - mic level  -> Web Audio AnalyserNode, for the user's waveform
//   - dictation  -> SpeechRecognition (webkit-prefixed in Chrome)
//   - AI voice   -> speechSynthesis
//
// All three degrade independently. A browser without SpeechRecognition still
// gets typing plus a waveform; one without a mic still gets typing. Nothing
// here is required for the session to work, so permission is only ever
// requested when the user actually presses Dictate.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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

export type MicStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported";

export interface VoiceSession {
  micStatus: MicStatus;
  /** True while the browser is speaking a question aloud. */
  aiSpeaking: boolean;
  /** Whether dictation is available at all in this browser. */
  dictationSupported: boolean;
  /** Live partial transcript while dictating; empty once committed. */
  interim: string;
  startDictation: () => void;
  stopDictation: () => void;
  speak: (text: string) => void;
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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Latched false on teardown. speechSynthesis is a global that outlives this
  // component, so without a guard an utterance queued a moment before
  // navigation keeps talking on the next screen.
  const liveRef = useRef(true);
  const loudFramesRef = useRef(0);
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

  const startDictation = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
            if (loudFramesRef.current > 6 && typeof window !== "undefined" && window.speechSynthesis.speaking) {
              window.speechSynthesis.resume();
              window.speechSynthesis.cancel();
              setAiSpeaking(false);
            }
          } else {
            loudFramesRef.current = 0;
          }

          listenersRef.current.forEach((cb) => cb(level));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (e) => {
        let finalText = "";
        let partial = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else partial += r[0].transcript;
        }
        if (finalText) {
          onTranscriptRef.current(finalText);
          setInterim("");
        } else {
          setInterim(partial);
        }
      };
      recognition.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") setMicStatus("denied");
      };
      recognition.onend = () => setInterim("");
      recognitionRef.current = recognition;
      recognition.start();

      setMicStatus("listening");
    } catch {
      teardownAudio();
      setMicStatus("denied");
    }
  }, [teardownAudio]);

  const stopDictation = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    teardownAudio();
    setInterim("");
    setMicStatus("idle");
  }, [teardownAudio]);

  const cancelSpeech = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // resume() first: a paused queue in Chrome ignores cancel() outright, and
    // a half-spoken utterance then resurfaces later.
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    setAiSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      if (!voiceEnabled || !liveRef.current) return;
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
    },
    [voiceEnabled]
  );

  // Release the mic and silence the voice if the screen goes away mid-session.
  useEffect(() => {
    liveRef.current = true;
    // Leaving the tab or hitting back should silence the interviewer too —
    // unmount alone doesn't fire on a bfcache navigation.
    const silence = () => {
      liveRef.current = false;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      }
    };
    window.addEventListener("pagehide", silence);
    return () => {
      window.removeEventListener("pagehide", silence);
      silence();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      teardownAudio();
    };
  }, [teardownAudio]);

  return { micStatus, aiSpeaking, dictationSupported, interim, startDictation, stopDictation, speak, cancelSpeech, onLevel };
}
