// The browser's SpeechRecognition, as the lab's second live channel.
//
// It runs beside the AWS stream on the same microphone: Chrome's recognizer
// opens its own capture (it cannot be handed a MediaStream), so both engines
// hear the same room at the same time, which is the comparison the lab is for.
//
// Chrome ends a continuous recognizer on its own after a pause or about a
// minute; while the clip is still recording it is started again, and the text
// it had settled is kept. `stop()` waits briefly for the last final, then
// keeps whatever was still interim, since that is what the admin saw.

interface AlternativeLike {
  transcript: string;
}
interface ResultLike {
  isFinal: boolean;
  length: number;
  0: AlternativeLike;
}
interface ResultEventLike {
  results: { length: number; [index: number]: ResultLike };
}
interface ErrorEventLike {
  error?: string;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: ResultEventLike) => void) | null;
  onerror: ((event: ErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** False in Firefox, which has no SpeechRecognition. */
export function webSpeechSupported(): boolean {
  return recognitionCtor() !== null;
}

/** The languages offered for the Web Speech channel. AWS uses the service's TRANSCRIBE_LANGUAGE. */
export const WEB_SPEECH_LANGUAGES = ["en-US", "en-GB", "en-AU", "en-IN", "en-NG", "en-ZA"] as const;

/** How long `stop()` waits for the recognizer's last final. */
const STOP_WAIT_MS = 2_000;
/** Restarts after the browser ends the recognizer, per clip; past this it is left ended. */
const MAX_RESTARTS = 30;

export interface WebSpeechOptions {
  lang: string;
  /** Settled text so far, and the still-changing tail. */
  onText: (text: string, interim: string) => void;
  /** The first result of any kind. */
  onFirstResult: () => void;
  /** The recognizer cannot go on (permission, network, the browser's service). */
  onFailure: (message: string) => void;
}

export interface WebSpeechSession {
  /** Stops, waits (bounded) for the last final, and resolves with the whole text. */
  stop(): Promise<string>;
  /** Stops at once. */
  abort(): void;
}

const FATAL: Record<string, string> = {
  "not-allowed": "The browser refused speech recognition.",
  "service-not-allowed": "The browser's speech service is switched off.",
  network: "The browser's speech service could not be reached.",
  "audio-capture": "Speech recognition could not use the microphone.",
  "language-not-supported": "The browser's speech service does not offer this language.",
};

const joinText = (parts: readonly string[]): string =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

export function startWebSpeech(options: WebSpeechOptions): WebSpeechSession | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  let recognition: RecognitionLike;
  try {
    recognition = new Ctor();
  } catch {
    return null;
  }

  /** Text settled by recognizer sessions that have ended. */
  const committed: string[] = [];
  /** The current session's finals and interim. */
  let sessionFinal = "";
  let interim = "";
  let first = true;
  let stopping = false;
  let ended = false;
  let restarts = 0;
  let waiters: Array<() => void> = [];

  const text = () => joinText([...committed, sessionFinal]);
  const publish = () => options.onText(text(), interim);

  const wake = () => {
    const pending = waiters;
    waiters = [];
    pending.forEach((resolve) => resolve());
  };

  recognition.lang = options.lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    if (ended) return;
    if (first) {
      first = false;
      options.onFirstResult();
    }
    // Results accumulate within one recognizer session; rebuild from all of them.
    const finals: string[] = [];
    const pending: string[] = [];
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const said = result?.[0]?.transcript ?? "";
      (result?.isFinal ? finals : pending).push(said);
    }
    sessionFinal = joinText(finals);
    interim = joinText(pending);
    publish();
  };

  recognition.onerror = (event) => {
    const message = event.error ? FATAL[event.error] : undefined;
    if (!message || ended) return;
    ended = true;
    options.onFailure(message);
    wake();
  };

  recognition.onend = () => {
    committed.push(sessionFinal);
    sessionFinal = "";
    if (stopping || ended || restarts >= MAX_RESTARTS) {
      ended = true;
      wake();
      return;
    }
    // The browser ended it mid-clip: keep listening. The interim it dropped is lost, as it is for a user.
    restarts++;
    interim = "";
    publish();
    try {
      recognition.start();
    } catch {
      ended = true;
      wake();
    }
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  const detach = () => {
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
  };

  return {
    async stop() {
      if (!ended) {
        stopping = true;
        const done = new Promise<void>((resolve) => waiters.push(resolve));
        try {
          recognition.stop();
        } catch {
          ended = true;
        }
        if (!ended) await Promise.race([done, new Promise<void>((resolve) => setTimeout(resolve, STOP_WAIT_MS))]);
      }
      ended = true;
      detach();
      const whole = joinText([text(), interim]);
      interim = "";
      options.onText(whole, "");
      return whole;
    },
    abort() {
      ended = true;
      stopping = true;
      detach();
      try {
        recognition.abort();
      } catch {
        // Already ended.
      }
      wake();
    },
  };
}
