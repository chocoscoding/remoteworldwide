// The session clock: one zero for everything a voice interview timestamps.
//
// The recording, the live captions, the interviewer's turns and the answer
// windows all end up on one timeline, the one the report's timestamps seek
// into. Its zero is the MediaRecorder's `start` event, because the stored
// recording begins there. Any other zero (the Start press, the socket opening)
// would put every "3:42" chip a few hundred milliseconds off from the audio it
// points at.
//
// Times are `performance.now()` values underneath: monotonic, so a wall-clock
// change (NTP, the user fixing their clock) mid-interview cannot bend the
// timeline. Event `timeStamp`s share that origin, which is how the recorder's
// own start event can set the zero exactly.

export interface SessionClock {
  /**
   * Sets the zero, once. `t0` is a `performance.now()` value, usually an event's
   * `timeStamp`. A second call is ignored, so a late duplicate start event
   * cannot shift a timeline other modules have already used.
   */
  start(t0?: number): void;
  /** Milliseconds since the zero; 0 before `start`. */
  now(): number;
  /** A `performance.now()` value on this clock, which is negative before the zero. NaN before `start`. */
  toSession(perfMs: number): number;
  /** Whether `start` has been called. */
  readonly started: boolean;
  /** The zero as a `performance.now()` value; null before `start`. */
  readonly t0: number | null;
}

const perfNow = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * `now` is injectable so the arithmetic can be exercised without a browser; it
 * must share an origin with whatever `t0` and `toSession` are given.
 */
export function createSessionClock(now: () => number = perfNow): SessionClock {
  let zero: number | null = null;

  return {
    start(t0 = now()) {
      if (zero !== null) return;
      zero = Number.isFinite(t0) ? t0 : now();
    },
    now() {
      return zero === null ? 0 : Math.max(0, now() - zero);
    },
    toSession(perfMs) {
      return zero === null ? Number.NaN : perfMs - zero;
    },
    get started() {
      return zero !== null;
    },
    get t0() {
      return zero;
    },
  };
}

/**
 * An event's `timeStamp` as a `performance.now()` value, or the current time
 * when the browser's is unusable. Older engines stamped events in epoch
 * milliseconds, and some synthetic events carry 0; either would put the zero
 * decades or a page-load away from the audio.
 */
export function eventTime(event: { timeStamp?: number } | null | undefined, now: () => number = perfNow): number {
  const at = now();
  const stamp = event?.timeStamp;
  if (typeof stamp !== "number" || !Number.isFinite(stamp) || stamp <= 0) return at;
  // A stamp from the future, or from long before the page could have started recording, is not on this origin.
  if (stamp > at + 1_000 || at - stamp > 60_000) return at;
  return stamp;
}
