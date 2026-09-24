// The playback-only mix: the candidate and the interviewer together, for the
// report's player.
//
// The recording the report is built from is the candidate's own mic, echo-
// cancelled on purpose so the interviewer stays out of it: the transcript and
// the delivery analysis must hear one voice. That left the playback with one
// voice too ("I can't hear the recruiter"). The interviewer's audio never
// reaches our servers (the speech engine speaks in the browser, and its own
// recording is off by design), so the only place both voices exist is here.
// This records them, mixed, with a second MediaRecorder, and the AI service
// uses that file as the playback copy only; nothing is ever measured from it.
//
// What goes in:
//  - the same capture track the recording uses (echo-cancelled, so no third
//    capture of the device, and the interviewer is not in it twice). Muted, it
//    is silence here too, while the interviewer carries on: the mute as heard.
//  - the interviewer as the browser PLAYED it: the engine's played-audio stream
//    (engineSession.tapPlayedAudio), or a question's <audio> element on the
//    browser-voice path (captureStream). Audio the engine flushed on an
//    interruption was never played, so it is never here either.
//
// The clock: every timestamp in a report seeks on the session clock, whose
// zero is the candidate recorder's `start`. This recorder starts in the same
// tick, and its own `start` time is kept (`t0`), so the finish can say how far
// its first sample sits from that zero; the AI service pads or trims by that
// much. The graph itself adds a few tens of milliseconds of processing delay,
// which is not corrected: well under anything a listener or a ▶ chip resolves.
//
// Levels (MIX_LEVELS): the candidate's mic has automatic gain off (the
// analysis needs their real loudness), so a laptop mic can sit 10-15 dB under
// the engine's normalised voice. The candidate goes through a gentle
// compressor with makeup gain so either voice is audible over the other on
// any device; the interviewer is taken down a little; a limiter stops the sum
// clipping. These are for listening only: the analysed track is untouched.
//
// Nothing here may cost the session: every failure returns null or false, and
// the recording hook then plays the candidate's own track, as before the mix.

import { createRecorder, type Recorder } from "./recorder";

/** Mix levels; linear gains and DynamicsCompressor settings (dB, seconds). */
export const MIX_LEVELS = {
  micGain: 1,
  mic: { threshold: -30, knee: 12, ratio: 3, attack: 0.005, release: 0.25 },
  interviewerGain: 0.8,
  limiter: { threshold: -3, knee: 0, ratio: 20, attack: 0.001, release: 0.1 },
} as const;

/**
 * A context that was suspended when the session began (no user gesture on the
 * page yet) may still start the mix if it resumes this soon after the session
 * clock's zero; the service pads that little silence onto the front. Later
 * than this, the start of the interview would be missing from the playback, so
 * there is no mix at all.
 */
export const MIX_LATE_START_MS = 1_500;

export interface PlaybackMixOptions {
  context: AudioContext;
  /** The recording's own capture stream. */
  mic: MediaStream;
  /** Each non-empty chunk, in order; `atMs` is on the mix recorder's own clock (only the part queue reads it). */
  onChunk: (blob: Blob, atMs: number) => void;
  /** `performance.now()`-origin time when the session clock started, for the late-start bound; null before. */
  sessionStart: () => number | null;
  /** The mix can no longer be trusted to line up (the context stopped running, the recorder failed). */
  onBroken?: (reason: string) => void;
  /** `performance.now()`; injectable for tests. */
  now?: () => number;
}

export interface PlaybackMix {
  /** Mixes in a stream of what the interviewer played. False when it cannot be read. */
  addInterviewer(stream: MediaStream): boolean;
  /** Mixes in a question an <audio> element plays (the browser-voice path). False where the element cannot be captured. */
  addElement(element: HTMLMediaElement): boolean;
  /** Some interviewer audio made it in. Without it the mix is only the candidate, and not worth sending. */
  readonly hasInterviewer: boolean;
  /** Started, and nothing has broken it since. */
  readonly usable: boolean;
  /** The recorder's `start` as a `performance.now()` value; null until it started. */
  readonly t0: number | null;
  /** Stops recording; resolves once the last chunk is handed over. Safe to call twice. */
  stop(): Promise<void>;
  /** Disconnects the graph (stop first, to keep the last chunk). */
  dispose(): void;
}

const perfNow = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

type Compressor = { threshold: number; knee: number; ratio: number; attack: number; release: number };

function compressor(context: AudioContext, settings: Compressor): DynamicsCompressorNode {
  const node = context.createDynamicsCompressor();
  node.threshold.value = settings.threshold;
  node.knee.value = settings.knee;
  node.ratio.value = settings.ratio;
  node.attack.value = settings.attack;
  node.release.value = settings.release;
  return node;
}

/** Whether this browser can capture what a media element plays without taking over its output (Chrome, Edge). */
export function canCaptureElements(): boolean {
  return typeof HTMLMediaElement !== "undefined" && typeof (HTMLMediaElement.prototype as { captureStream?: unknown }).captureStream === "function";
}

/**
 * Builds the mix and starts its recorder once the context runs. Null when this
 * browser cannot (no Web Audio node it needs, no recorder for the stream).
 */
export function createPlaybackMix(options: PlaybackMixOptions): PlaybackMix | null {
  const { context } = options;
  const now = options.now ?? perfNow;
  let destination: MediaStreamAudioDestinationNode;
  let bus: GainNode;
  const nodes: AudioNode[] = [];
  try {
    destination = context.createMediaStreamDestination();
    // One channel: two voices for one listener, and the playback copy is mono anyway.
    destination.channelCount = 1;
    destination.channelCountMode = "explicit";
    const limiter = compressor(context, MIX_LEVELS.limiter);
    bus = context.createGain();
    bus.connect(limiter);
    limiter.connect(destination);

    const mic = context.createMediaStreamSource(options.mic);
    const micGain = context.createGain();
    micGain.gain.value = MIX_LEVELS.micGain;
    const micCompressor = compressor(context, MIX_LEVELS.mic);
    mic.connect(micGain);
    micGain.connect(micCompressor);
    micCompressor.connect(bus);
    nodes.push(mic, micGain, micCompressor, bus, limiter, destination);
  } catch {
    return null;
  }

  let recorder: Recorder | null = null;
  let t0: number | null = null;
  let broken = false;
  let stopped = false;
  let interviewer = false;
  const breakMix = (reason: string) => {
    if (broken) return;
    broken = true;
    try {
      options.onBroken?.(reason);
    } catch {
      // The hook's problem; the mix is already marked unusable.
    }
  };

  const onState = () => {
    if (stopped) return;
    if (context.state === "running") {
      begin();
      return;
    }
    // A context that stops rendering stops the mix's timeline while the
    // candidate's recording runs on: from here the two no longer line up.
    if (recorder) breakMix("suspended");
  };

  function begin() {
    if (recorder || stopped || broken) return;
    const zero = options.sessionStart();
    // Too late to line the start of the interview up: no mix rather than one missing its opening.
    if (zero !== null && now() - zero > MIX_LATE_START_MS) {
      breakMix("late");
      return;
    }
    try {
      recorder = createRecorder(destination.stream, {
        onChunk: options.onChunk,
        onStart: (at) => {
          t0 = at;
        },
        onError: () => breakMix("recorder"),
      });
      recorder.start();
    } catch {
      recorder = null;
      breakMix("recorder");
    }
  }

  context.addEventListener?.("statechange", onState);
  if (context.state === "running") begin();

  const addSource = (stream: MediaStream): boolean => {
    if (stopped || broken) return false;
    try {
      const source = context.createMediaStreamSource(stream);
      const gain = context.createGain();
      gain.gain.value = MIX_LEVELS.interviewerGain;
      source.connect(gain);
      gain.connect(bus);
      nodes.push(source, gain);
      interviewer = true;
      return true;
    } catch {
      return false;
    }
  };

  return {
    addInterviewer(stream) {
      if (!stream || typeof stream.getAudioTracks !== "function" || stream.getAudioTracks().length === 0) return false;
      return addSource(stream);
    },
    addElement(element) {
      if (stopped || broken || !canCaptureElements()) return false;
      let captured: MediaStream;
      try {
        // Not createMediaElementSource: that takes the element's output away
        // from the speakers, and a cross-origin one would then play silence.
        // A capture leaves playback as it was, and refuses (throws) where the
        // audio is not the page's to read.
        captured = (element as HTMLMediaElement & { captureStream(): MediaStream }).captureStream();
      } catch {
        return false;
      }
      const attached = new Set<string>();
      const attach = () => {
        for (const track of captured.getAudioTracks()) {
          if (attached.has(track.id)) continue;
          attached.add(track.id);
          addSource(new MediaStream([track]));
        }
      };
      // The track appears once the element has something to play.
      captured.addEventListener?.("addtrack", attach);
      attach();
      return true;
    },
    get hasInterviewer() {
      return interviewer;
    },
    get usable() {
      return recorder !== null && t0 !== null && !broken;
    },
    get t0() {
      return t0;
    },
    async stop() {
      stopped = true;
      context.removeEventListener?.("statechange", onState);
      if (recorder) await recorder.stop();
    },
    dispose() {
      stopped = true;
      context.removeEventListener?.("statechange", onState);
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Never connected, or its context is closed.
        }
      }
      nodes.length = 0;
    },
  };
}
