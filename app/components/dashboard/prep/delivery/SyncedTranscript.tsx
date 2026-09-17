"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type FC, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import { ariaTime, formatClock, numberAnswers, type DeliveryTurn } from "@/app/lib/voice/format";
import type { DeliveryTranscriptSegment, DeliveryTranscriptWord } from "@/app/lib/voice/types";
import { usePlaybackControls, usePlaybackState, usePlaybackTime } from "./PlaybackProvider";

/**
 * The transcript that follows the recording: the word being spoken is lit,
 * a click on any word plays from it, and "Follow along" keeps the current
 * line in view.
 *
 * Words are matched onto each segment's own text rather than rendered from
 * the word list, because the transcript may carry punctuation on the words,
 * as separate tokens or not at all; the text is always what the user reads.
 * A word the matcher can't place is simply not clickable.
 *
 * Playback touches one segment at a time: each segment subscribes to the time
 * store with a selector that returns its current word index (or "not me"), so
 * a frame re-renders at most the segment being spoken, and only when the word
 * changes.
 *
 * Without segments (a locked report withholds them; a typed session has
 * none) the turns' own text is shown, playable from each answer's start when
 * its time is known.
 */
export interface SyncedTranscriptProps {
  segments: readonly DeliveryTranscriptSegment[];
  words: readonly DeliveryTranscriptWord[];
  turns: readonly DeliveryTurn[];
  /** "Follow along" starts on. Default true. */
  defaultFollow?: boolean;
  className?: string;
}

/** Start a word this far early so its first sound isn't clipped. */
const WORD_PREROLL_MS = 250;
const SEGMENT_PREROLL_MS = 500;
/** A segment stays lit this long after its last word, so short gaps don't flicker. */
const SEGMENT_TAIL_MS = 300;
/** Words are matched to a segment within this much of its edges. */
const WORD_SLACK_MS = 60;
/** How far ahead in the word list the matcher looks for a token before giving up on it. */
const MATCH_LOOKAHEAD = 3;

/** The selector's "this segment isn't playing". */
const OUTSIDE = -2;
/** Inside the segment, before its first word, or a segment without word times. */
const WHOLE = -1;

// ---------------------------------------------------------------------------
// Preparing the text
// ---------------------------------------------------------------------------

interface Token {
  text: string;
  /** Index into the segment's `times`, or -1 for text that isn't a timed word. */
  word: number;
}

interface PreparedSegment {
  id: string;
  startMs: number;
  endMs: number;
  tokens: Token[];
  /** Word start/end times in token order. */
  times: Array<{ s: number; e: number }>;
}

type Block =
  | { kind: "ai"; key: string; turn: DeliveryTurn }
  | { kind: "answer"; key: string; turn: DeliveryTurn; number: number; segments: PreparedSegment[] }
  | { kind: "loose"; key: string; segments: PreparedSegment[] };

/**
 * Letters and digits only, so "Sure." matches "sure" and "I'd" matches "Id".
 * Latin, Greek and Cyrillic letters are kept by range: the `u` flag's `\p{L}`
 * needs an ES2018 target, and this app compiles for ES2017.
 */
const normalize = (text: string) => text.toLowerCase().replace(/[^0-9a-zÀ-ɏͰ-ϿЀ-ӿ]+/g, "");

/** Words and the spaces and hyphens between them, kept in order so the text reads exactly as written. */
function tokenize(text: string): string[] {
  return text.split(/(\s+|[-–—]+)/).filter((part) => part.length > 0);
}

function prepareSegment(segment: DeliveryTranscriptSegment, words: readonly DeliveryTranscriptWord[]): PreparedSegment {
  const times: Array<{ s: number; e: number }> = [];
  let next = 0;
  const tokens = tokenize(segment.text).map((text): Token => {
    const key = normalize(text);
    if (!key) return { text, word: -1 };
    for (let k = next; k < Math.min(words.length, next + MATCH_LOOKAHEAD + 1); k++) {
      if (normalize(words[k].w) !== key) continue;
      next = k + 1;
      times.push({ s: words[k].s, e: words[k].e });
      return { text, word: times.length - 1 };
    }
    return { text, word: -1 };
  });
  return { id: segment.id, startMs: segment.startMs, endMs: segment.endMs, tokens, times };
}

function buildBlocks(segments: readonly DeliveryTranscriptSegment[], words: readonly DeliveryTranscriptWord[], turns: readonly DeliveryTurn[]): Block[] {
  const sortedWords = [...words].filter((w) => Number.isFinite(w.s)).sort((a, b) => a.s - b.s);
  // Punctuation-only words carry no time worth lighting; drop them before matching.
  const spoken = sortedWords.filter((w) => normalize(w.w).length > 0);
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);

  let cursor = 0;
  const prepared = sorted.map((segment) => {
    while (cursor < spoken.length && spoken[cursor].s < segment.startMs - WORD_SLACK_MS) cursor++;
    let end = cursor;
    while (end < spoken.length && spoken[end].s < segment.endMs + WORD_SLACK_MS) end++;
    const own = spoken.slice(cursor, end);
    cursor = end;
    return { segment, prepared: prepareSegment(segment, own) };
  });

  const turnIds = new Set(turns.map((t) => t.id));
  const byTurn = new Map<string, PreparedSegment[]>();
  const loose: Array<{ at: number; segment: PreparedSegment }> = [];
  for (const { segment, prepared: p } of prepared) {
    if (segment.turnId !== null && turnIds.has(segment.turnId)) {
      const list = byTurn.get(segment.turnId) ?? [];
      list.push(p);
      byTurn.set(segment.turnId, list);
    } else {
      loose.push({ at: segment.startMs, segment: p });
    }
  }

  const numbers = numberAnswers(turns);
  const blocks: Block[] = [];
  let looseAt = 0;
  // Speech outside every answer is placed by time between the turns around it.
  const flushLoose = (before: number) => {
    const run: PreparedSegment[] = [];
    while (looseAt < loose.length && loose[looseAt].at < before) run.push(loose[looseAt++].segment);
    if (run.length > 0) blocks.push({ kind: "loose", key: `loose-${run[0].id}`, segments: run });
  };
  for (const turn of turns) {
    if (turn.startMs !== undefined) flushLoose(turn.startMs);
    if (turn.who === "ai") blocks.push({ kind: "ai", key: turn.id, turn });
    else blocks.push({ kind: "answer", key: turn.id, turn, number: numbers.get(turn.id) ?? 0, segments: byTurn.get(turn.id) ?? [] });
  }
  flushLoose(Infinity);
  return blocks;
}

/** The current word's index in `times`, WHOLE, or OUTSIDE. */
function activeWord(segment: PreparedSegment, ms: number): number {
  if (ms < segment.startMs || ms >= segment.endMs + SEGMENT_TAIL_MS) return OUTSIDE;
  const { times } = segment;
  if (times.length === 0 || ms < times[0].s) return WHOLE;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid].s <= ms) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SyncedTranscript: FC<SyncedTranscriptProps> = ({ segments, words, turns, defaultFollow = true, className }) => {
  const controls = usePlaybackControls();
  const canPlay = controls !== null;
  const playing = usePlaybackState()?.playing ?? false;
  const [follow, setFollow] = useState(defaultFollow);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(follow);
  const playingRef = useRef(playing);
  useEffect(() => {
    followRef.current = follow;
    playingRef.current = playing;
  }, [follow, playing]);

  const blocks = useMemo(() => buildBlocks(segments, words, turns), [segments, words, turns]);
  const synced = segments.length > 0;

  const scrollToRow = useCallback((row: HTMLElement) => {
    const box = scrollRef.current;
    if (!box) return;
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: reduce ? "auto" : "smooth" });
  }, []);

  // Called by a segment as it becomes the one being spoken. Reads refs, so a
  // segment's memoised props never change with follow or play state.
  const onActivate = useCallback(
    (row: HTMLElement) => {
      if (followRef.current && playingRef.current) scrollToRow(row);
    },
    [scrollToRow]
  );

  // Turning follow back on (or pressing play with it on) catches up at once.
  useEffect(() => {
    if (!follow || !playing) return;
    const row = scrollRef.current?.querySelector<HTMLElement>('[data-current="true"]');
    if (row) scrollToRow(row);
  }, [follow, playing, scrollToRow]);

  // Scrolling by hand means the user wants to read elsewhere; stop pulling
  // them back. Programmatic scrolls fire none of these events.
  const stopFollowing = () => {
    if (followRef.current) setFollow(false);
  };

  const seek = useCallback((ms: number, preroll: number) => controls?.seekTo(ms, { preroll }), [controls]);

  return (
    <section aria-label="Transcript" className={cn("rounded-2xl border border-black/10 bg-white", className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-black/10 px-5 py-3.5 sm:px-6">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-bold text-primary">Transcript</h3>
          <p className="mt-0.5 text-xs text-black/50">
            {synced && canPlay ? "Click any word to hear it." : "What you said, as transcribed from the recording."}
          </p>
        </div>
        {synced && canPlay && (
          <button
            type="button"
            role="switch"
            aria-checked={follow}
            onClick={() => setFollow((v) => !v)}
            className="group inline-flex flex-none cursor-pointer items-center gap-2 rounded-md text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2">
            <NeoCheckbox checked={follow} size="sm" />
            Follow along
          </button>
        )}
      </header>

      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Transcript text"
        role="region"
        onWheel={stopFollowing}
        onTouchMove={stopFollowing}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) stopFollowing();
        }}
        className="flex max-h-[520px] flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e1f073] sm:px-6">
        {blocks.length === 0 && <p className="text-sm text-black/50">There&apos;s no transcript for this session.</p>}
        {blocks.map((block) => {
          if (block.kind === "ai") return <InterviewerTurn key={block.key} turn={block.turn} onSeek={canPlay ? seek : null} />;
          if (block.kind === "loose") {
            return (
              <div key={block.key} className="flex flex-col gap-1">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-black/35">Between answers</p>
                {block.segments.map((segment) => (
                  <SegmentRow key={segment.id} segment={segment} muted onSeek={canPlay ? seek : null} onActivate={onActivate} />
                ))}
              </div>
            );
          }
          return (
            <div key={block.key} className="flex flex-col gap-1">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-black/35">
                You{block.number > 0 && <span className="text-black/30"> · Answer {block.number}</span>}
              </p>
              {block.segments.length > 0 ? (
                block.segments.map((segment) => <SegmentRow key={segment.id} segment={segment} onSeek={canPlay ? seek : null} onActivate={onActivate} />)
              ) : (
                <PlainTurn turn={block.turn} onSeek={canPlay ? seek : null} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

type Seek = ((ms: number, preroll: number) => void) | null;

/** The clock at the start of a row: a button when there is a recording, plain text otherwise. */
const RowClock: FC<{ atMs: number; current?: boolean; onSeek: Seek; label: string }> = ({ atMs, current = false, onSeek, label }) =>
  onSeek ? (
    <button
      type="button"
      onClick={() => onSeek(atMs, SEGMENT_PREROLL_MS)}
      aria-label={`Play from ${ariaTime(atMs)}: ${label}`}
      className={cn(
        "mt-[3px] w-11 flex-none cursor-pointer rounded-md px-1 py-0.5 text-left text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]",
        current ? "bg-[#e1f073] text-[#222325]" : "text-black/35 hover:bg-[#f0f0ea] hover:text-primary"
      )}>
      {formatClock(atMs)}
    </button>
  ) : (
    <span className="mt-[3px] w-11 flex-none px-1 py-0.5 text-[11px] font-semibold tabular-nums text-black/35">{formatClock(atMs)}</span>
  );

const InterviewerTurn: FC<{ turn: DeliveryTurn; onSeek: Seek }> = ({ turn, onSeek }) => (
  <div className="flex flex-col gap-1">
    <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-black/35">Interviewer</p>
    <div className="flex gap-2">
      {turn.startMs !== undefined ? <RowClock atMs={turn.startMs} onSeek={onSeek} label="interviewer" /> : <span className="w-11 flex-none" />}
      <p className="min-w-0 flex-1 border-l-2 border-black/10 pl-3 text-sm leading-relaxed text-black/55">{turn.text}</p>
    </div>
  </div>
);

const PlainTurn: FC<{ turn: DeliveryTurn; onSeek: Seek }> = ({ turn, onSeek }) => (
  <div className="flex gap-2">
    {turn.startMs !== undefined ? <RowClock atMs={turn.startMs} onSeek={onSeek} label="your answer" /> : <span className="w-11 flex-none" />}
    <p className="min-w-0 flex-1 text-sm leading-relaxed text-primary">{turn.text.trim() || <span className="text-black/40">Nothing was said here.</span>}</p>
  </div>
);

interface SegmentRowProps {
  segment: PreparedSegment;
  muted?: boolean;
  onSeek: Seek;
  onActivate: (row: HTMLElement) => void;
}

const SegmentRow = memo(function SegmentRow({ segment, muted = false, onSeek, onActivate }: SegmentRowProps) {
  const active = usePlaybackTime((ms) => activeWord(segment, ms));
  const current = active !== OUTSIDE;
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (current && rowRef.current) onActivate(rowRef.current);
  }, [current, onActivate]);

  const onClick = (e: MouseEvent<HTMLParagraphElement>) => {
    if (!onSeek) return;
    // Selecting text to copy it ends in a click too; that isn't a request to play.
    if ((window.getSelection()?.toString() ?? "").length > 0) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-word]");
    const index = target ? Number(target.dataset.word) : -1;
    const time = segment.times[index];
    if (time) onSeek(time.s, WORD_PREROLL_MS);
    else onSeek(segment.startMs, SEGMENT_PREROLL_MS);
  };

  const text = segment.tokens.map((t) => t.text).join("");

  return (
    <div ref={rowRef} data-current={current} className={cn("-mx-2 flex gap-2 rounded-lg px-2 py-1 transition-colors", current && "bg-[#f6faea]")}>
      <RowClock atMs={segment.startMs} current={current} onSeek={onSeek} label={text} />
      <p onClick={onClick} className={cn("min-w-0 flex-1 text-sm leading-relaxed", muted ? "text-black/50" : "text-primary", onSeek && "cursor-pointer")}>
        {segment.tokens.map((token, i) => {
          if (token.word < 0) return <span key={i}>{token.text}</span>;
          const lit = current && token.word === active;
          const ahead = current && active !== WHOLE && token.word > active;
          return (
            <span
              key={i}
              data-word={token.word}
              className={cn(
                "rounded-[3px] transition-colors",
                lit ? "bg-[#e1f073] text-[#222325] shadow-[0_0_0_2px_#e1f073]" : ahead ? "text-black/55" : undefined,
                onSeek && !lit && "hover:bg-[#f0f0ea]"
              )}>
              {token.text}
            </span>
          );
        })}
      </p>
    </div>
  );
});

export default SyncedTranscript;
