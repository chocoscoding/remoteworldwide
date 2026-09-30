// The browser-voice interviewer's audio, handed to the playback-only mix.
//
// On a `web-speech` session each question is played by an <audio> element
// that useVoiceSession makes per line, while the playback mix belongs to
// useInterviewCapture. The two hooks never see each other (the page composes
// them), and threading an element through the page for a recording concern
// would put the page in the middle of it. So the element is offered here, and
// taken only while a recorded session is mixing; with no taker, playback is
// exactly what it always was (coach, Ask about a job, an unsaved interview).
//
// Nothing here fetches, plays or keeps an element: it is a hand-off.

type Taker = (element: HTMLMediaElement) => void;

let taker: Taker | null = null;

/**
 * A recorded session is mixing, so an element about to be made should load in
 * CORS mode: a cross-origin one can only be captured when it did. Read before
 * setting `src`, which is when the load starts.
 */
export function interviewerAudioWanted(): boolean {
  return taker !== null;
}

/** An element about to play an interviewer line. A taker that throws never stops the line. */
export function offerInterviewerAudio(element: HTMLMediaElement): void {
  try {
    taker?.(element);
  } catch {
    // The mix's problem; the question still plays.
  }
}

/** Takes the offered elements until the returned function is called. One taker at a time: a later one replaces the last. */
export function takeInterviewerAudio(take: Taker): () => void {
  taker = take;
  return () => {
    if (taker === take) taker = null;
  };
}
