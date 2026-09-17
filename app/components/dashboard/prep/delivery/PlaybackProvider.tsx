"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type FC, type ReactNode } from "react";

/**
 * One recording, many ways into it.
 *
 * Every summary line, finding, evidence item, timeline marker and transcript
 * word can start the recording at its own moment, so they all talk to one
 * `<audio>` element through this provider rather than each holding a ref.
 *
 * The playback position is deliberately NOT React state. It changes every
 * frame while audio plays; as state it would re-render the whole report 60
 * times a second. It lives in a tiny external store instead, and only the
 * leaves that draw it (the playhead, the current word, the clock) subscribe,
 * through `useSyncExternalStore` with a selector so most of them re-render
 * only when their own derived value changes.
 *
 * Things that change rarely (duration, playing, rate) are ordinary state, in
 * a second context, so a component that only seeks (`useSeek`) never
 * re-renders on play/pause either.
 */

// ---------------------------------------------------------------------------
// The time store
// ---------------------------------------------------------------------------

/** Milliseconds on the session clock; -1 until anything has played or been sought. */
export interface PlaybackTimeStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
}

interface WritableTimeStore extends PlaybackTimeStore {
  set: (ms: number) => void;
}

function createTimeStore(): WritableTimeStore {
  let value = -1;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => value,
    set(ms) {
      if (ms === value) return;
      value = ms;
      for (const listener of listeners) listener();
    },
  };
}

/** Outside a provider nothing plays, so the position never moves off "nowhere". */
const IDLE_STORE: PlaybackTimeStore = { subscribe: () => () => {}, getSnapshot: () => -1 };

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export interface SeekOptions {
  /**
   * How far before `ms` to start, so the listener hears the lead-in to the
   * moment rather than landing mid-word. Default 1500.
   */
  preroll?: number;
  /** Start playing after the seek. Default true: every seek is a user's "play from here". */
  play?: boolean;
}

export const PLAYBACK_RATES = [1, 1.25, 1.5] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface PlaybackControls {
  seekTo: (ms: number, options?: SeekOptions) => void;
  /** Moves by `deltaMs` from wherever playback is, without preroll, keeping play/pause as it is. */
  seekBy: (deltaMs: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setRate: (rate: PlaybackRate) => void;
  /**
   * Call just before the element's source is replaced or reloaded (a fresh
   * signed URL, a retry after a 403): the new source starts where this one
   * was, playing if it was playing. A seek already waiting is kept instead.
   */
  holdForReload: () => void;
  /** The position, for `useSyncExternalStore`. Prefer `usePlaybackTime`. */
  currentMs: PlaybackTimeStore;
  /**
   * Attach the one `<audio>` element. Written as a React 19 callback ref:
   * pass it straight to `ref`, and the cleanup it returns detaches.
   */
  register: (el: HTMLAudioElement | null) => (() => void) | undefined;
}

export interface PlaybackState {
  /** Milliseconds; the recording's known length until the media reports its own. 0 when neither is known. */
  duration: number;
  playing: boolean;
  rate: PlaybackRate;
  /** An audio element is attached and has loaded enough to seek. */
  ready: boolean;
}

const ControlsContext = createContext<PlaybackControls | null>(null);
const StateContext = createContext<PlaybackState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface PlaybackProviderProps {
  /**
   * The recording's length as the server measured it, so the timeline and
   * scrubber can be drawn before the media has loaded.
   */
  durationMs?: number | null;
  children: ReactNode;
}

interface PendingSeek {
  ms: number;
  play: boolean;
}

/** HTMLMediaElement.HAVE_METADATA, without touching the DOM global during SSR. */
const HAVE_METADATA = 1;

/**
 * What the element-bound handlers share, in one ref. Only handlers and
 * callbacks touch it, never render.
 */
interface MediaBox {
  el: HTMLAudioElement | null;
  pending: PendingSeek | null;
  frame: number | null;
  /** Mirrors `rate` state for handlers: loading a new source resets the element's own rate. */
  rate: PlaybackRate;
}

export const PlaybackProvider: FC<PlaybackProviderProps> = ({ durationMs, children }) => {
  const [store] = useState(createTimeStore);
  const boxRef = useRef<MediaBox>({ el: null, pending: null, frame: null, rate: 1 });
  const [mediaDuration, setMediaDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState<PlaybackRate>(1);
  const [ready, setReady] = useState(false);

  const knownDuration = durationMs && durationMs > 0 ? durationMs : 0;
  const duration = mediaDuration > 0 ? mediaDuration : knownDuration;

  const clampMs = useCallback(
    (ms: number) => {
      const el = boxRef.current.el;
      const limit = el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration * 1000 : knownDuration;
      const floor = Math.max(0, ms);
      return limit > 0 ? Math.min(floor, limit) : floor;
    },
    [knownDuration]
  );

  const startPlayback = useCallback((el: HTMLAudioElement) => {
    // A rejected play() is the browser's autoplay policy or a source that
    // failed; the player shows the latter, and the former needs a click the
    // user can still give. Neither is worth an unhandled rejection.
    el.play().catch(() => {});
  }, []);

  const seekTo = useCallback(
    (ms: number, options?: SeekOptions) => {
      const box = boxRef.current;
      const preroll = options?.preroll ?? 1500;
      const shouldPlay = options?.play ?? true;
      const target = clampMs(ms - preroll);
      store.set(target);
      const el = box.el;
      if (!el || el.readyState < HAVE_METADATA) {
        // The URL is still being fetched or the metadata hasn't arrived:
        // remember the request and honour it on `loadedmetadata`.
        box.pending = { ms: target, play: shouldPlay };
        return;
      }
      el.currentTime = target / 1000;
      if (shouldPlay) startPlayback(el);
    },
    [clampMs, startPlayback, store]
  );

  const seekBy = useCallback(
    (deltaMs: number) => {
      const box = boxRef.current;
      const el = box.el;
      // Until metadata arrives the element reports 0, so step from the
      // position already asked for (a queued seek) or last shown instead.
      const from = el && el.readyState >= HAVE_METADATA ? el.currentTime * 1000 : Math.max(0, box.pending?.ms ?? store.getSnapshot());
      seekTo(from + deltaMs, { preroll: 0, play: box.pending?.play ?? (el ? !el.paused : false) });
    },
    [seekTo, store]
  );

  const play = useCallback(() => {
    const el = boxRef.current.el;
    if (el) startPlayback(el);
  }, [startPlayback]);

  const pause = useCallback(() => {
    boxRef.current.el?.pause();
  }, []);

  const toggle = useCallback(() => {
    const el = boxRef.current.el;
    if (!el) return;
    if (el.paused) startPlayback(el);
    else el.pause();
  }, [startPlayback]);

  const setRate = useCallback((next: PlaybackRate) => {
    const box = boxRef.current;
    box.rate = next;
    if (box.el) {
      // `defaultPlaybackRate` too: a refreshed source resets the element to it.
      box.el.defaultPlaybackRate = next;
      box.el.playbackRate = next;
    }
    setRateState(next);
  }, []);

  const holdForReload = useCallback(() => {
    const box = boxRef.current;
    const el = box.el;
    if (box.pending || !el) return;
    // Before metadata the element's own time is meaningless (0); the store
    // still holds the last position anyone saw or asked for.
    const ms = el.readyState >= HAVE_METADATA ? el.currentTime * 1000 : store.getSnapshot();
    box.pending = { ms: Math.max(0, ms), play: !el.paused };
  }, [store]);

  const register = useCallback(
    (el: HTMLAudioElement | null) => {
      if (!el) return undefined;
      const box = boxRef.current;
      box.el = el;
      el.defaultPlaybackRate = box.rate;
      el.playbackRate = box.rate;

      // While playing, read the element every frame: `timeupdate` fires only
      // about four times a second, too coarse for a word-by-word highlight.
      const tick = () => {
        store.set(el.currentTime * 1000);
        box.frame = requestAnimationFrame(tick);
      };
      const stopTicking = () => {
        if (box.frame !== null) cancelAnimationFrame(box.frame);
        box.frame = null;
      };
      const syncTime = () => store.set(el.currentTime * 1000);

      const onLoaded = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) setMediaDuration(el.duration * 1000);
        setReady(true);
        el.playbackRate = box.rate;
        const pending = box.pending;
        box.pending = null;
        if (pending) {
          el.currentTime = pending.ms / 1000;
          store.set(pending.ms);
          if (pending.play) startPlayback(el);
        }
      };
      const onDuration = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) setMediaDuration(el.duration * 1000);
      };
      const onPlay = () => {
        setPlaying(true);
        stopTicking();
        box.frame = requestAnimationFrame(tick);
      };
      const onPause = () => {
        setPlaying(false);
        stopTicking();
        syncTime();
      };
      const onEmptied = () => {
        // A new source (a refreshed signed URL) resets the element; until its
        // metadata is back, seeks are queued rather than lost.
        setReady(false);
        setPlaying(false);
        stopTicking();
      };

      el.addEventListener("loadedmetadata", onLoaded);
      el.addEventListener("durationchange", onDuration);
      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("ended", onPause);
      el.addEventListener("seeked", syncTime);
      el.addEventListener("timeupdate", syncTime);
      el.addEventListener("emptied", onEmptied);
      if (el.readyState >= HAVE_METADATA) onLoaded();

      return () => {
        stopTicking();
        el.removeEventListener("loadedmetadata", onLoaded);
        el.removeEventListener("durationchange", onDuration);
        el.removeEventListener("play", onPlay);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("ended", onPause);
        el.removeEventListener("seeked", syncTime);
        el.removeEventListener("timeupdate", syncTime);
        el.removeEventListener("emptied", onEmptied);
        if (box.el === el) box.el = null;
        setReady(false);
        setPlaying(false);
      };
    },
    [startPlayback, store]
  );

  const controls = useMemo<PlaybackControls>(
    () => ({ seekTo, seekBy, play, pause, toggle, setRate, holdForReload, currentMs: store, register }),
    [seekTo, seekBy, play, pause, toggle, setRate, holdForReload, store, register]
  );
  const state = useMemo<PlaybackState>(() => ({ duration, playing, rate, ready }), [duration, playing, rate, ready]);

  return (
    <ControlsContext.Provider value={controls}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ControlsContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const identity = (ms: number) => ms;
const serverSnapshot = () => -1;

/**
 * The playback position, or a value derived from it.
 *
 * With no selector the caller re-renders every frame while audio plays, so
 * keep that to small leaves. With a selector that returns a primitive (an
 * index, a boolean, a rounded pixel), the caller re-renders only when that
 * value changes. -1 means nothing has played yet; selectors receive it too.
 */
export function usePlaybackTime(): number;
export function usePlaybackTime<T extends string | number | boolean | null>(select: (ms: number) => T): T;
export function usePlaybackTime<T>(select?: (ms: number) => T): T | number {
  const controls = useContext(ControlsContext);
  const store = controls?.currentMs ?? IDLE_STORE;
  const pick = (select ?? identity) as (ms: number) => T | number;
  return useSyncExternalStore(
    store.subscribe,
    () => pick(store.getSnapshot()),
    () => pick(serverSnapshot())
  );
}

/**
 * `seekTo`, or null outside a PlaybackProvider (an in-memory demo session has
 * no recording, so the chips that would call it don't render).
 */
export function useSeek(): PlaybackControls["seekTo"] | null {
  return useContext(ControlsContext)?.seekTo ?? null;
}

/** All controls; null outside a provider. */
export function usePlaybackControls(): PlaybackControls | null {
  return useContext(ControlsContext);
}

/** Duration, playing, rate and readiness; null outside a provider. */
export function usePlaybackState(): PlaybackState | null {
  return useContext(StateContext);
}

export default PlaybackProvider;
