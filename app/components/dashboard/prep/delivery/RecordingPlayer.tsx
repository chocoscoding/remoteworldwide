"use client";

import { useCallback, useEffect, useRef, useState, type FC, type KeyboardEvent } from "react";
import { AlertTriangle, Loader2, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiMessage } from "@/app/lib/api/core";
import { ariaTime, formatClock } from "@/app/lib/voice/format";
import type { PlaybackLink } from "@/app/lib/voice/types";
import {
  PLAYBACK_RATES,
  usePlaybackControls,
  usePlaybackState,
  usePlaybackTime,
  type PlaybackControls,
  type PlaybackRate,
  type PlaybackState,
} from "./PlaybackProvider";

/**
 * The one player for a session's recording, pinned while the report scrolls
 * so every chip below it has somewhere visible to play.
 *
 * The URL is a presigned S3 GET that expires, and that the service may have to
 * reissue early (role credentials end sooner than the link says). So:
 *  - it is fetched on mount, never baked into the page;
 *  - a fresh one is fetched a minute before `expiresAt`;
 *  - a media error (S3 answers an expired link with 403, which the element
 *    reports only as a failed load) fetches a fresh one once, resuming where
 *    playback was; a second failure in a row shows a retry instead of looping.
 *
 * Nothing plays until the user asks: no autoplay, `preload="metadata"` only,
 * so opening a report costs a few kilobytes, not the recording.
 */
export interface RecordingPlayerProps {
  /** The session's playback link (`GET …/playback`). Called on mount, before expiry and after a failed load. */
  getUrl: () => Promise<PlaybackLink>;
  /** The label over the scrubber. */
  title?: string;
  className?: string;
}

/** Ask for a new link this long before the old one expires. */
const REFRESH_LEAD_MS = 60_000;
/** A link that is already (nearly) expired is refreshed after this, not in a tight loop. */
const MIN_REFRESH_MS = 5_000;
/** A background refresh that failed is tried again after this; the current link is still good meanwhile. */
const REFRESH_RETRY_MS = 15_000;
/** setTimeout overflows past 2^31 - 1 ms and fires at once. */
const MAX_TIMER_MS = 2_147_000_000;
/** The skip buttons and the scrubber's arrow keys. */
const SKIP_MS = 5_000;
const PAGE_SKIP_MS = 30_000;

type FetchReason = "initial" | "expiry" | "recover" | "retry";
type LinkStatus = "loading" | "ready" | "recovering" | "failed";

interface LoaderEvents {
  getUrl: () => Promise<PlaybackLink>;
  onLink: (url: string, reason: FetchReason) => void;
  onFail: (error: unknown) => void;
}

interface LinkLoader {
  fetch: (reason: FetchReason) => void;
  dispose: () => void;
}

/**
 * Link fetching without React: one request at a time (a newer request makes
 * an older answer irrelevant), and one refresh timer. Events are read through
 * a ref so the loader always calls the latest `getUrl` and handlers.
 */
function createLinkLoader(events: { readonly current: LoaderEvents }): LinkLoader {
  let request = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const schedule = (waitMs: number) => {
    clearTimer();
    timer = setTimeout(() => load("expiry"), Math.min(Math.max(waitMs, MIN_REFRESH_MS), MAX_TIMER_MS));
  };

  function load(reason: FetchReason) {
    const id = ++request;
    clearTimer();
    events.current.getUrl().then(
      (link) => {
        if (disposed || id !== request) return;
        events.current.onLink(link.url, reason);
        const expiresAt = Date.parse(link.expiresAt);
        if (Number.isFinite(expiresAt)) schedule(expiresAt - Date.now() - REFRESH_LEAD_MS);
      },
      (error: unknown) => {
        if (disposed || id !== request) return;
        // A background refresh failing isn't the user's problem yet: the
        // current link still works for another minute. Try again quietly;
        // if the link does run out, the media error path takes over.
        if (reason === "expiry") schedule(REFRESH_RETRY_MS);
        else events.current.onFail(error);
      }
    );
  }

  return {
    fetch: load,
    dispose: () => {
      disposed = true;
      clearTimer();
    },
  };
}

function useRequiredPlayback(): { controls: PlaybackControls; state: PlaybackState } {
  const controls = usePlaybackControls();
  const state = usePlaybackState();
  if (!controls || !state) throw new Error("RecordingPlayer must be rendered inside a PlaybackProvider.");
  return { controls, state };
}

const RecordingPlayer: FC<RecordingPlayerProps> = ({ getUrl, title = "Your recording", className }) => {
  const { controls, state } = useRequiredPlayback();
  const { register, holdForReload } = controls;

  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<LinkStatus>("loading");
  const [failure, setFailure] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const loaderRef = useRef<LinkLoader | null>(null);
  /** A media error already spent its one refetch; cleared once audio loads again. */
  const recoveringRef = useRef(false);

  const onLink = useCallback(
    (next: string, reason: FetchReason) => {
      const el = audioRef.current;
      if (next === urlRef.current) {
        // Same link (the service rounds signing time, so a refetch often
        // matches). After a failure the element must be told to try again;
        // on a timed refresh there is nothing to do.
        if (reason !== "expiry" && el) {
          holdForReload();
          el.load();
        }
      } else {
        if (urlRef.current !== null) holdForReload();
        urlRef.current = next;
        setUrl(next);
      }
      setFailure(null);
      setStatus("ready");
    },
    [holdForReload]
  );

  const onFail = useCallback((error: unknown) => {
    setFailure(apiMessage(error));
    setStatus("failed");
  }, []);

  const eventsRef = useRef<LoaderEvents>({ getUrl, onLink, onFail });
  useEffect(() => {
    eventsRef.current = { getUrl, onLink, onFail };
  }, [getUrl, onLink, onFail]);

  // Created in the effect, not in state: a strict-mode remount disposes the
  // first loader, and a disposed loader must never be reused.
  useEffect(() => {
    const loader = createLinkLoader(eventsRef);
    loaderRef.current = loader;
    loader.fetch("initial");
    return () => {
      loader.dispose();
      if (loaderRef.current === loader) loaderRef.current = null;
    };
  }, []);

  const setAudio = useCallback(
    (el: HTMLAudioElement | null) => {
      audioRef.current = el;
      const detach = register(el);
      return () => {
        audioRef.current = null;
        detach?.();
      };
    },
    [register]
  );

  const onMediaError = () => {
    if (urlRef.current === null) return;
    if (recoveringRef.current) {
      setFailure("The recording didn't load.");
      setStatus("failed");
      return;
    }
    recoveringRef.current = true;
    holdForReload();
    setStatus("recovering");
    loaderRef.current?.fetch("recover");
  };

  const onMediaLoaded = () => {
    recoveringRef.current = false;
  };

  const retry = () => {
    recoveringRef.current = false;
    setFailure(null);
    setStatus(urlRef.current === null ? "loading" : "recovering");
    loaderRef.current?.fetch("retry");
  };

  const hasSource = url !== null;
  const failed = status === "failed";
  const disabled = !hasSource || failed;

  return (
    <section
      aria-label="Recording player"
      className={cn(
        "sticky top-3 z-30 rounded-2xl border-[1.5px] border-[#222325] bg-[#222325] px-3.5 py-3 text-white shadow-[4px_4px_0_0_#e1f073] sm:px-5",
        className
      )}>
      {/* No `controls`: this bar is the interface. No `crossOrigin`: playback
          needs no CORS, and asking for it would make S3 refuse the GET. */}
      <audio ref={setAudio} src={url ?? undefined} preload="metadata" onError={onMediaError} onLoadedData={onMediaLoaded} className="hidden" />

      <div className="flex items-center gap-2 sm:gap-3">
        <SkipButton direction={-1} disabled={disabled} onSkip={controls.seekBy} />
        <button
          type="button"
          onClick={controls.toggle}
          disabled={disabled}
          aria-label={state.playing ? "Pause recording" : "Play recording"}
          className="inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full border-[1.5px] border-[#222325] bg-[#e1f073] text-[#222325] shadow-[2px_2px_0_0_#ffffff] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#222325] disabled:cursor-default disabled:opacity-40 disabled:shadow-none">
          {status === "loading" ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : state.playing ? (
            <Pause aria-hidden className="h-4 w-4 fill-current" strokeWidth={0} />
          ) : (
            <Play aria-hidden className="ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
          )}
        </button>
        <SkipButton direction={1} disabled={disabled} onSkip={controls.seekBy} />

        <div className="min-w-0 flex-1 pl-1 sm:pl-2">
          <Scrubber title={title} durationMs={state.duration} playing={state.playing} disabled={disabled} controls={controls} />
        </div>

        <RateControl rate={state.rate} disabled={disabled} onRate={controls.setRate} />
      </div>

      {/* Mounted before it has anything to say, so the change is announced. */}
      <div role="status" aria-live="polite" className={cn("text-xs", (failed || status === "recovering" || status === "loading") && "mt-2.5")}>
        {status === "loading" && <span className="text-white/60">Loading your recording…</span>}
        {status === "recovering" && (
          <span className="inline-flex items-center gap-1.5 text-white/60">
            <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
            Reconnecting to the recording…
          </span>
        )}
        {failed && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-white/80">
              <AlertTriangle aria-hidden className="h-3.5 w-3.5 flex-none text-[#f5a898]" />
              {failure ?? "The recording didn't load."}
            </span>
            <button
              type="button"
              onClick={retry}
              className="cursor-pointer font-bold text-[#e1f073] underline decoration-2 underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
              Try again
            </button>
          </span>
        )}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const ICON_ON_DARK =
  "relative inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent";

const SkipButton: FC<{ direction: -1 | 1; disabled: boolean; onSkip: (deltaMs: number) => void }> = ({ direction, disabled, onSkip }) => {
  const Icon = direction < 0 ? RotateCcw : RotateCw;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSkip(direction * SKIP_MS)}
      aria-label={direction < 0 ? "Back 5 seconds" : "Forward 5 seconds"}
      className={ICON_ON_DARK}>
      <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      <span aria-hidden className="absolute text-[8px] font-bold leading-none">
        5
      </span>
    </button>
  );
};

interface ScrubberProps {
  title: string;
  durationMs: number;
  playing: boolean;
  disabled: boolean;
  controls: PlaybackControls;
}

/**
 * The only part of the bar that follows playback, and only to the second:
 * a whole-second selector re-renders it once a second, not every frame.
 */
const Scrubber: FC<ScrubberProps> = ({ title, durationMs, playing, disabled, controls }) => {
  const seconds = usePlaybackTime((ms) => (ms > 0 ? Math.floor(ms / 1000) : 0));
  const max = Math.max(1, Math.floor(durationMs / 1000));
  const value = Math.min(seconds, max);
  const pct = durationMs > 0 ? (value / max) * 100 : 0;
  const unknownLength = durationMs <= 0;

  // Arrows move 5 s, not the native 1 s step (too slow to cross a 14-minute
  // recording), and Page keys 30 s. Home and End keep the native behaviour.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const step = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -SKIP_MS : e.key === "ArrowRight" || e.key === "ArrowUp" ? SKIP_MS : e.key === "PageDown" ? -PAGE_SKIP_MS : e.key === "PageUp" ? PAGE_SKIP_MS : 0;
    if (step === 0) return;
    e.preventDefault();
    controls.seekBy(step);
  };

  return (
    <>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#e1f073]">{title}</p>
        <p className="flex-none text-xs font-semibold tabular-nums text-white/70">
          <span className="text-white">{formatClock(value * 1000)}</span>
          <span aria-hidden> / </span>
          <span className="sr-only"> of </span>
          {unknownLength ? "–:––" : formatClock(durationMs)}
        </p>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled || unknownLength}
        aria-label="Seek in the recording"
        aria-valuetext={unknownLength ? ariaTime(value * 1000) : `${ariaTime(value * 1000)} of ${ariaTime(durationMs)}`}
        onChange={(e) => controls.seekTo(Number(e.target.value) * 1000, { preroll: 0, play: playing })}
        onKeyDown={onKeyDown}
        // The filled part of the track is the one continuous value on this
        // bar; a literal class can't hold a percentage, so it is inline.
        style={{ background: `linear-gradient(to right, #e1f073 ${pct}%, rgba(255,255,255,0.18) ${pct}%)` }}
        className="block h-1.5 w-full cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2 focus-visible:ring-offset-[#222325] disabled:cursor-default disabled:opacity-40 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#222325] [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#222325] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_1.5px_#e1f073]"
      />
    </>
  );
};

const RATE_LABEL: Record<PlaybackRate, string> = { 1: "1×", 1.25: "1.25×", 1.5: "1.5×" };

/** Three pressed-state buttons on wide screens; one cycling button where the bar is narrow. */
const RateControl: FC<{ rate: PlaybackRate; disabled: boolean; onRate: (rate: PlaybackRate) => void }> = ({ rate, disabled, onRate }) => {
  const next = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length];
  return (
    <>
      <div role="group" aria-label="Playback speed" className="hidden flex-none items-center gap-0.5 rounded-lg bg-white/10 p-1 sm:inline-flex">
        {PLAYBACK_RATES.map((r) => (
          <button
            key={r}
            type="button"
            disabled={disabled}
            aria-pressed={r === rate}
            onClick={() => onRate(r)}
            className={cn(
              "cursor-pointer rounded-md px-2 py-1 text-[11px] font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] disabled:cursor-default disabled:opacity-40",
              r === rate ? "bg-white text-[#222325]" : "text-white/60 hover:text-white"
            )}>
            {RATE_LABEL[r]}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRate(next)}
        aria-label={`Playback speed ${RATE_LABEL[rate]}. Change to ${RATE_LABEL[next]}`}
        className="inline-flex h-9 min-w-[44px] flex-none cursor-pointer items-center justify-center rounded-lg bg-white/10 px-2 text-[11px] font-bold tabular-nums text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] disabled:cursor-default disabled:opacity-40 sm:hidden">
        {RATE_LABEL[rate]}
      </button>
    </>
  );
};

export default RecordingPlayer;
