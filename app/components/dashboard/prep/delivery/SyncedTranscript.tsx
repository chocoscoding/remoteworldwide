"use client";

import { Fragment, memo, useCallback, useEffect, useId, useMemo, useRef, useState, type FC, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionQuestionRef } from "@/app/components/dashboard/prep/report/answerNotes";
import RewritePopover from "@/app/components/dashboard/prep/report/RewritePopover";
import type { DimensionScore, Rewrite, TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import { ariaTime, clip, formatClock, formatDuration } from "@/app/lib/voice/format";
import type { DeliveryTranscriptSegment, DeliveryTranscriptWord, DictionSection } from "@/app/lib/voice/types";
import { usePlaybackControls, usePlaybackState, usePlaybackTime } from "./PlaybackProvider";
import TranscriptNote from "./transcriptNote";
import { buildTranscript, stretchAt, wordAt, type InterviewerRow, type PickUpRow, type Piece, type SpeechRow } from "./transcriptModel";

/**
 * The Transcript tab: every line of the session in order, the interviewer's
 * and the candidate's, with what the report found written onto the words.
 *
 * - The word being spoken is a dark pill, and a click on any word plays from
 *   it. Filler words sit in a dashed box. A phrase the analysis left a note on
 *   is underlined, and its note opens on hover, keyboard focus or a tap.
 * - Under each answer: its flags and "How you could have said it".
 * - Where a question went unanswered, or the session ended before the next
 *   one, a line offers to pick up from there.
 *
 * It never scrolls by itself. It used to follow along inside its own capped
 * scroll box, and that box fought the reader: it took the wheel from the page
 * and would not hand it back at its end, and a scrollbar drag didn't count as
 * the reader taking over, so the next line pulled them back. Now it is part of
 * the page, scrolled with the page, and while the word being played is off
 * screen a button offers the way back to it.
 *
 * Playback touches one row at a time: each row subscribes to the time store
 * with selectors that return its current stretch and word (or -1), so a frame
 * re-renders at most the row being spoken, and only when the word changes.
 *
 * For a screen reader the words are plain running text, not a button each:
 * the row's clock is the button that plays it, and each noted phrase is a
 * button (Enter plays from it) described by its note.
 *
 * Without word timings (a locked report withholds them; a typed session has
 * none; older sessions lack them) the turns' own text is shown, with the same
 * notes, fillers and flags wherever the quotes match.
 */
export interface SyncedTranscriptProps {
  segments: readonly DeliveryTranscriptSegment[];
  words: readonly DeliveryTranscriptWord[];
  turns: readonly TranscriptTurn[];
  /** The session's questions, in order. */
  questions?: readonly SessionQuestionRef[];
  dimensions?: readonly DimensionScore[];
  rewrites?: readonly Rewrite[];
  diction?: DictionSection | null;
  /** "Pick up from this question": practise from this unanswered question on. */
  onPickUp?: (questionId: string) => void;
  /** Under the transcript card: the accuracy rating. */
  footer?: ReactNode;
  className?: string;
}

/** Start a word this far early so its first sound isn't clipped. */
const WORD_PREROLL_MS = 250;
const ROW_PREROLL_MS = 500;

/**
 * The part of the screen a word counts as seen in: below the recording player,
 * which sticks to the top of the report (RecordingPlayer, about 80px with its
 * offset), and above the "back to what's playing" button at the bottom.
 */
const SEEN_MARGIN = "-96px 0px -64px 0px";

const NO_QUESTIONS: readonly SessionQuestionRef[] = [];
const NO_DIMENSIONS: readonly DimensionScore[] = [];
const NO_REWRITES: readonly Rewrite[] = [];

/** Where the word being played is when it is off screen. */
type Offscreen = "above" | "below" | null;

type Seek = ((ms: number, preroll: number) => void) | null;

/** Called by a row as it is being spoken: the word to watch, and the row it is in. */
type Activate = (target: HTMLElement, row: HTMLElement) => void;

const SyncedTranscript: FC<SyncedTranscriptProps> = ({
  segments,
  words,
  turns,
  questions = NO_QUESTIONS,
  dimensions = NO_DIMENSIONS,
  rewrites = NO_REWRITES,
  diction = null,
  onPickUp,
  footer,
  className,
}) => {
  const titleId = useId();
  const controls = usePlaybackControls();
  const canPlay = controls !== null;
  const playing = usePlaybackState()?.playing ?? false;
  const [offscreen, setOffscreen] = useState<Offscreen>(null);
  const watched = useRef<HTMLElement | null>(null);
  const watchedRow = useRef<HTMLElement | null>(null);
  const watcher = useRef<IntersectionObserver | null>(null);

  const model = useMemo(
    () => buildTranscript({ segments, words, turns, questions, dimensions, rewrites, diction }),
    [segments, words, turns, questions, dimensions, rewrites, diction]
  );
  const follows = model.timed && canPlay;

  // Watches the word being played, so the way back to it shows only while it
  // is off screen. It only ever offers: the page is the reader's to move.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        // A report queued for the word before is stale once another is playing.
        const entry = entries.filter((e) => e.target === watched.current).pop();
        if (!entry) return;
        if (!entry.target.isConnected || entry.isIntersecting) setOffscreen(null);
        else setOffscreen(entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) ? "above" : "below");
      },
      { rootMargin: SEEN_MARGIN }
    );
    watcher.current = observer;
    if (watched.current) observer.observe(watched.current);
    return () => {
      observer.disconnect();
      watcher.current = null;
    };
  }, []);

  // Stable, so a row's memoised props never change with play state.
  const onActivate = useCallback<Activate>((target, row) => {
    watchedRow.current = row;
    if (watched.current === target) return;
    const observer = watcher.current;
    if (watched.current && observer) observer.unobserve(watched.current);
    watched.current = target;
    observer?.observe(target);
  }, []);

  const backToPlaying = () => {
    const target = watched.current;
    if (!target?.isConnected) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // The one scroll this component makes, and only on the reader's click.
    target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    // The button goes once the word is in view; focus lands on the row's own
    // play button rather than falling back to the top of the page.
    watchedRow.current?.querySelector<HTMLElement>("[data-row-play]")?.focus({ preventScroll: true });
  };

  const seek = useCallback((ms: number, preroll: number) => controls?.seekTo(ms, { preroll }), [controls]);
  const onSeek: Seek = canPlay ? seek : null;

  const intro = [
    follows ? "Click any word to hear it." : "What was said in the session.",
    model.notes ? "Notes sit beside the line they are about." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <section aria-labelledby={titleId} className="rounded-2xl border border-black/10 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 border-b border-black/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 id={titleId} className="text-[15px] font-bold text-[#222325]">
              Transcript
            </h3>
            <p className="mt-0.5 text-[12.5px] text-black/55">{intro}</p>
          </div>
          <Legend playing={follows} filler={model.fillers} note={model.notes} />
        </header>

        {/* No height cap and no scroll box of its own: the page is the only
            thing that scrolls, so the wheel always moves the page. */}
        <div>
          {model.rows.length === 0 && <p className="px-5 py-6 text-sm text-black/50 sm:px-6">There&apos;s no transcript for this session.</p>}
          {model.rows.map((row, i) => {
            if (row.kind === "pickup") return <PickUpLine key={row.key} row={row} onPickUp={onPickUp} />;
            if (row.kind === "interviewer") return <InterviewerLine key={row.key} row={row} ruled={i > 0} onSeek={onSeek} />;
            return <SpeechLine key={row.key} row={row} ruled={i > 0} onSeek={onSeek} onActivate={onActivate} />;
          })}
        </div>

        {follows && (
          // Sticks to the bottom of the screen while the transcript runs past
          // it, and takes no room of its own, so the card ends at its last row.
          // Clicks pass through everything but the button.
          <div className="pointer-events-none sticky bottom-3 z-20 h-0">
            {playing && offscreen && (
              <div className="absolute inset-x-0 bottom-0 flex justify-center">
                <button
                  type="button"
                  onClick={backToPlaying}
                  className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#e1f073] px-3.5 py-1.5 text-xs font-bold text-[#222325] br-shadow-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325] focus-visible:ring-offset-2">
                  {offscreen === "above" ? <ArrowUp aria-hidden className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden className="h-3.5 w-3.5" />}
                  Back to what&apos;s playing
                </button>
              </div>
            )}
          </div>
        )}
      </section>
      {footer}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/** What the marks on the words mean; each shows only where it can appear. For the eye: the marks themselves aren't read out. */
const Legend: FC<{ playing: boolean; filler: boolean; note: boolean }> = ({ playing, filler, note }) => {
  if (!playing && !filler && !note) return null;
  return (
    <div aria-hidden className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-black/60">
      {playing && (
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded-[4px] bg-[#222325] px-1.5 py-px text-[11px] font-bold text-[#e1f073]">now</span>
          Playing
        </span>
      )}
      {filler && (
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded-[4px] border border-dashed border-[#222325]/60 px-1 text-[11px] font-semibold text-[#222325]">uh</span>
          Filler
        </span>
      )}
      {note && (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[#222325] underline decoration-[#222325] decoration-[1.5px] underline-offset-[4px]">text</span>
          Has a note
        </span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Who and when on the left, the words on the right; stacked on a phone. */
const Row: FC<{ ruled: boolean; tinted?: boolean; rowRef?: (el: HTMLDivElement | null) => void; children: ReactNode }> = ({
  ruled,
  tinted = false,
  rowRef,
  children,
}) => (
  <div
    ref={rowRef}
    className={cn(
      "grid gap-x-5 gap-y-1.5 px-5 py-4 last:rounded-b-2xl sm:grid-cols-[108px_minmax(0,1fr)] sm:px-6",
      ruled && "border-t border-black/[0.08]",
      tinted && "bg-[#f9faf2]"
    )}>
    {children}
  </div>
);

const RowLabel: FC<{ title: string; meta: ReactNode[] }> = ({ title, meta }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#222325]/80">{title}</p>
    {meta.length > 0 && (
      <p className="mt-0.5 text-[11.5px] leading-snug text-black/45 tabular-nums">
        {meta.map((part, i) => (
          <Fragment key={i}>
            {i > 0 && " · "}
            {part}
          </Fragment>
        ))}
      </p>
    )}
  </div>
);

/** The time a row starts: the button that plays it when there is a recording, plain text otherwise. */
const Clock: FC<{ atMs: number; onSeek: Seek; label: string; current?: boolean }> = ({ atMs, onSeek, label, current = false }) =>
  onSeek ? (
    <button
      type="button"
      data-row-play
      onClick={() => onSeek(atMs, ROW_PREROLL_MS)}
      aria-label={`${label} ${ariaTime(atMs)}`}
      className={cn(
        "-mx-1 cursor-pointer rounded-[4px] px-1 tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325]",
        current ? "bg-[#e1f073] text-[#222325]" : "hover:bg-black/[0.06] hover:text-[#222325]"
      )}>
      {formatClock(atMs)}
    </button>
  ) : (
    <span>{formatClock(atMs)}</span>
  );

const InterviewerLine = memo(function InterviewerLine({ row, ruled, onSeek }: { row: InterviewerRow; ruled: boolean; onSeek: Seek }) {
  return (
    <Row ruled={ruled}>
      <RowLabel title="Interviewer" meta={row.startMs !== undefined ? [<Clock key="at" atMs={row.startMs} onSeek={onSeek} label="Play the interviewer from" />] : []} />
      <p className="min-w-0 text-[14.5px] leading-[1.65] text-black/60">{row.text}</p>
    </Row>
  );
});

/** Each word's box: padding drawn out over a negative margin, so lighting a word never moves the text. */
const WORD = "-mx-[3px] rounded-[5px] px-[3px] py-[1px] box-decoration-clone transition-colors";
const PLAYING = "bg-[#222325] text-[#e1f073]";

interface SpeechLineProps {
  row: SpeechRow;
  ruled: boolean;
  onSeek: Seek;
  onActivate: Activate;
}

const SpeechLine = memo(function SpeechLine({ row, ruled, onSeek, onActivate }: SpeechLineProps) {
  const { speech } = row;
  const { tokens, times } = speech;
  const stretch = usePlaybackTime((ms) => stretchAt(speech, ms));
  const playingWord = usePlaybackTime((ms) => wordAt(speech, stretchAt(speech, ms), ms));
  const rowEl = useRef<HTMLDivElement | null>(null);
  const setRowEl = useCallback((el: HTMLDivElement | null) => {
    rowEl.current = el;
  }, []);
  const seekable = onSeek !== null && times.length > 0;
  const answer = row.role === "answer";

  // Hands the word being spoken (or, before its first word, the stretch's
  // first) to the transcript's watcher.
  useEffect(() => {
    const el = rowEl.current;
    if (stretch < 0 || !el) return;
    const { firstWord, lastWord } = speech.stretches[stretch];
    const word = playingWord >= 0 ? playingWord : lastWord >= firstWord ? firstWord : -1;
    onActivate(el.querySelector<HTMLElement>(`[data-word="${word}"]`) ?? el, el);
  }, [stretch, playingWord, speech, onActivate]);

  const onClick = (e: MouseEvent<HTMLParagraphElement>) => {
    if (!seekable || !onSeek) return;
    // Selecting text to copy it ends in a click too; that isn't a request to play.
    if ((window.getSelection()?.toString() ?? "").length > 0) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-word]");
    const time = target ? times[Number(target.dataset.word)] : undefined;
    if (time) onSeek(time.s, WORD_PREROLL_MS);
  };

  const word = (i: number, withLead = true, withTrail = true): ReactNode => {
    const token = tokens[i];
    if (!token.core) return <Fragment key={i}>{token.text}</Fragment>;
    const timed = seekable && token.word >= 0;
    return (
      <Fragment key={i}>
        {withLead && token.lead}
        {timed ? (
          <span data-word={token.word} className={cn(WORD, token.word === playingWord ? PLAYING : "cursor-pointer hover:bg-black/[0.07]")}>
            {token.core}
          </span>
        ) : (
          token.core
        )}
        {withTrail && token.trail}
      </Fragment>
    );
  };

  /** Where a noted phrase plays from: its first timed word, else the time the note gives. */
  const playFrom = (from: number, to: number, atMs?: number): (() => void) | null => {
    if (!onSeek) return null;
    for (let i = from; i <= to; i++) {
      const time = tokens[i].word >= 0 ? times[tokens[i].word] : undefined;
      if (time) return () => onSeek(time.s, WORD_PREROLL_MS);
    }
    return atMs !== undefined ? () => onSeek(atMs, WORD_PREROLL_MS) : null;
  };

  const render = (pieces: readonly Piece[]): ReactNode[] =>
    pieces.map((piece) => {
      if (piece.kind === "token") return word(piece.index);
      if (piece.kind === "filler") {
        const inner: ReactNode[] = [];
        for (let i = piece.from; i <= piece.to; i++) inner.push(word(i, i !== piece.from, i !== piece.to));
        return (
          <Fragment key={`filler-${piece.from}`}>
            {tokens[piece.from].lead}
            <span className="rounded-[5px] border border-dashed border-[#222325]/60 px-[3px] box-decoration-clone">{inner}</span>
            {tokens[piece.to].trail}
          </Fragment>
        );
      }
      return (
        <TranscriptNote key={`note-${piece.from}`} note={piece.note} onPlay={playFrom(piece.from, piece.to, piece.note.atMs)}>
          {render(piece.inner)}
        </TranscriptNote>
      );
    });

  const meta: ReactNode[] = [];
  if (row.startMs !== undefined) {
    const label = answer && row.number !== null ? `Play answer ${row.number} from` : "Play from";
    meta.push(<Clock key="at" atMs={row.startMs} onSeek={onSeek} current={stretch >= 0} label={label} />);
  }
  if (!answer) meta.unshift("Between answers");
  if (row.durationMs !== undefined) meta.push(formatDuration(row.durationMs));
  if (row.wordCount > 0) meta.push(`${row.wordCount} ${row.wordCount === 1 ? "word" : "words"}`);

  return (
    <Row ruled={ruled} tinted={answer} rowRef={setRowEl}>
      <RowLabel title={answer && row.number !== null ? `You · Answer ${row.number}` : "You"} meta={meta} />
      <div className="min-w-0">
        {row.wordCount === 0 ? (
          <p className="text-sm text-black/40">Nothing was said here.</p>
        ) : (
          <p onClick={onClick} className={cn("text-base leading-[1.8]", answer ? "text-[#222325]" : "text-black/55")}>
            {render(row.pieces)}
          </p>
        )}
        {(row.flags.length > 0 || row.rewrite) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {row.flags.map((flag) => (
              <span key={flag} className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-semibold text-[#222325]">
                <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[#222325]" />
                {flag}
              </span>
            ))}
            {row.rewrite && <RewritePopover text={row.rewrite} />}
          </div>
        )}
      </div>
    </Row>
  );
});

/** Where the session left a question: say so, and offer to practise from it. */
const PickUpLine: FC<{ row: PickUpRow; onPickUp?: (questionId: string) => void }> = ({ row, onPickUp }) => {
  const line = !row.asked
    ? `The session ended here, before question ${row.number}.`
    : row.atEnd
      ? "The session ended here, before you answered this question."
      : "You moved on before answering this question.";
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-dashed border-black/25 px-5 py-4 last:rounded-b-2xl sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-black/60">{line}</p>
        {/* A question never asked has no line above to say what it was. */}
        {!row.asked && row.text && <p className="mt-0.5 text-xs text-black/45">{clip(row.text, 140)}</p>}
      </div>
      {onPickUp && (
        <button
          type="button"
          onClick={() => onPickUp(row.questionId)}
          aria-label={`Pick up from this question, question ${row.number}`}
          className="br-plain-press flex-none rounded-lg border-[#222325] bg-white px-3.5 py-2 text-[13px] font-bold text-[#222325] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325] focus-visible:ring-offset-2">
          Pick up from this question
        </button>
      )}
    </div>
  );
};

export default SyncedTranscript;
