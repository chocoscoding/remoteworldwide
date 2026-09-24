"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type TouchEvent,
  type WheelEvent,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FLAG_KIND_META,
  SEVERITY_LABELS,
  ariaTime,
  clip,
  formatClock,
  formatDuration,
  formatMeasure,
  formatMeasureValue,
  formatSigned,
  numberAnswers,
  questionsByAnswer,
  type DeliveryTurn,
} from "@/app/lib/voice/format";
import { DELIVERY_FLAG_KINDS, type DeliveryAnswer, type DeliveryFlag, type DeliveryFlagKind, type DeliveryReport } from "@/app/lib/voice/types";
import { LONG_GAP_MS, buildPace, buildWave, px, type PaceGeometry, type WaveGeometry } from "./deliveryCurves";
import { usePlaybackControls, usePlaybackState, usePlaybackTime } from "./PlaybackProvider";
import TimestampChip from "./TimestampChip";

/**
 * The whole session on one time axis: how fast, how varied and how loud the
 * user spoke, where each answer sat, and where the findings are.
 *
 * Small multiples, not one chart: pace (wpm), pitch (semitones) and energy
 * (dB) have nothing in common but time, so each gets its own row and its own
 * scale over a shared x-axis. Every row is a single series, so the row label
 * names it and no legend box is needed; the key under the chart explains the
 * line styles. Findings sit in one lane per kind: position, not colour, tells
 * the kinds apart.
 *
 * Colour follows the dashboard's own tokens and was checked with the dataviz
 * palette validator: the blue measure line and the red finding markers stay
 * apart under protanopia and deuteranopia on the white card (#ffffff), the
 * rows' panel (#fbfbf7) and the ink surfaces (#222325, #292a2c). The 140-160
 * wpm band is the brand lime and is context only: the scores never use it.
 *
 * Hand-drawn SVG on a measured width, with no chart library. The lines come
 * from deliveryCurves.ts: pitch and energy (every 250 ms) are pooled into
 * bins sized to the width, short pauses inside an answer are bridged with a
 * dotted span rather than cutting the line, and the curve is a monotone cubic
 * that never overshoots the data. Answers too short for a pace window show
 * their own pace, so the chart agrees with the Pace figure and the table.
 *
 * Performance: the rows are memoised and never follow playback. The playhead,
 * the lit answer and the lit findings each subscribe to the time store with a
 * selector, so a frame of playback re-renders only what moved.
 *
 * Narrow screens: the label column stays put (sticky) and the plot keeps a
 * 480 px minimum inside its own horizontal scroller; the page never scrolls
 * sideways. While playing, the scroller follows the playhead until the reader
 * scrolls it themselves.
 */
export interface DeliveryTimelineProps {
  delivery: DeliveryReport;
  turns: readonly DeliveryTurn[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Layout constants. Heights exist twice, as numbers for the SVG and as literal
// classes for the label column, so both columns line up without measuring.
// ---------------------------------------------------------------------------

const PACE_H = 76;
const WAVE_H = 64;
const ANSWERS_H = 28;
const LANE_H = 24;
const AXIS_H = 22;
const ROW_PAD = 6;
/** The rows' `gap-1.5`. */
const ROW_GAP = 6;

/** Crosshair keyboard steps. */
const KEY_STEP_MS = 5_000;
const KEY_PAGE_MS = 30_000;
/** The minimum distance between time-axis labels. */
const MIN_TICK_PX = 60;
const TICK_STEPS_S = [15, 30, 60, 120, 300, 600, 900, 1800, 3600];
/** A sideways swipe this long is the reader scrolling the chart, not tapping it. */
const SWIPE_PX = 8;

const PACE_BAND = { low: 140, high: 160 } as const;

/** Tokens, light and dark, as literal classes; SVG marks paint with `currentColor`. */
const TONE = {
  surface: "bg-white dark:bg-[#222325]",
  /** The measure rows sit on a panel a step off the card, so the three small multiples read as three. */
  panel: "fill-[#fbfbf7] dark:fill-[#292a2c]",
  line: "text-[#2f5bb7] dark:text-[#5b8def]",
  flag: "text-[#b23c26] dark:text-[#e5533d]",
  band: "text-[#e1f073]",
  grid: "text-[#ecece6] dark:text-white/10",
  /** "You, typically": the pace average and the pitch and energy medians. */
  reference: "text-black/40 dark:text-white/30",
  muted: "fill-black/45 dark:fill-white/50",
  ring: "stroke-white dark:stroke-[#222325]",
  panelRing: "stroke-[#fbfbf7] dark:stroke-[#292a2c]",
} as const;

// ---------------------------------------------------------------------------
// Geometry — pure, rebuilt only when the data or the width changes
// ---------------------------------------------------------------------------

interface AnswerMark {
  turnId: string;
  number: number;
  startMs: number;
  endMs: number;
  x0: number;
  x1: number;
  question: string | null;
  /** The question, cut to fit inside the bar; null when there's no room. */
  caption: string | null;
}

interface FlagMark {
  flag: DeliveryFlag;
  number: number | null;
  x0: number;
  x1: number;
}

interface Lane {
  kind: DeliveryFlagKind;
  flags: FlagMark[];
}

interface Geometry {
  width: number;
  durationMs: number;
  pace: PaceGeometry;
  pitch: WaveGeometry;
  energy: WaveGeometry;
  answers: AnswerMark[];
  lanes: Lane[];
  ticks: Array<{ ms: number; x: number }>;
}

const clampTo = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/** The recording's length, trusting the report but never cutting off data it carries. */
function timelineDuration(delivery: DeliveryReport): number {
  let end = delivery.durationMs > 0 ? delivery.durationMs : 0;
  for (const answer of delivery.answers) end = Math.max(end, answer.endMs);
  if (end === 0) end = Math.max(delivery.series.pitchSt.length, delivery.series.energyDb.length) * delivery.series.stepMs;
  return end;
}

// Rough glyph widths at the bar's type sizes, a little over the average for
// a sans at that size, so a caption is cut short rather than running past
// the end of its bar. Under a dozen characters a caption says too little to
// be worth the noise; the number alone stays.
const DIGIT_PX = 6.5;
const CAPTION_CHAR_PX = 5.4;
const MIN_CAPTION_CHARS = 12;

/** The question an answer replied to, as much as fits beside its number. */
function answerCaption(number: number, question: string | null, width: number): string | null {
  if (!question) return null;
  const room = width - 16 - String(number).length * DIGIT_PX - 6;
  const chars = Math.floor(room / CAPTION_CHAR_PX);
  return chars >= MIN_CAPTION_CHARS ? clip(question, chars) : null;
}

function buildTicks(durationMs: number, width: number): Array<{ ms: number; x: number }> {
  const stepS = TICK_STEPS_S.find((s) => ((s * 1000) / durationMs) * width >= MIN_TICK_PX) ?? TICK_STEPS_S[TICK_STEPS_S.length - 1];
  const ticks: Array<{ ms: number; x: number }> = [];
  for (let ms = 0; ms < durationMs; ms += stepS * 1000) ticks.push({ ms, x: px((ms / durationMs) * width) });
  return ticks;
}

function buildGeometry(delivery: DeliveryReport, turns: readonly DeliveryTurn[], width: number): Geometry {
  const durationMs = timelineDuration(delivery);
  const x = (ms: number) => (clampTo(ms, 0, durationMs) / durationMs) * width;
  const answers = [...delivery.answers].sort((a, b) => a.startMs - b.startMs);
  const numbers = numberAnswers(turns);
  const questions = questionsByAnswer(turns);

  const answerMarks: AnswerMark[] = answers.map((a, i) => {
    // The user's own count when the turn is known, so "Answer 3" means the same everywhere.
    const number = numbers.get(a.turnId) ?? i + 1;
    // 1 px of surface either side keeps neighbouring answers apart.
    const x0 = px(x(a.startMs) + 1);
    const x1 = px(Math.max(x(a.startMs) + 3, x(a.endMs) - 1));
    const question = questions.get(a.turnId) ?? null;
    return { turnId: a.turnId, number, startMs: a.startMs, endMs: a.endMs, x0, x1, question, caption: answerCaption(number, question, x1 - x0) };
  });
  const numberOf = new Map(answerMarks.map((a) => [a.turnId, a.number]));

  const lanes: Lane[] = DELIVERY_FLAG_KINDS.map((kind) => ({
    kind,
    flags: delivery.flags
      .filter((f) => f.kind === kind)
      .sort((a, b) => a.atMs - b.atMs)
      .map((flag) => ({
        flag,
        number: numberOf.get(flag.turnId) ?? null,
        x0: px(x(flag.atMs)),
        x1: px(Math.max(x(flag.atMs) + 3, x(flag.endMs))),
      })),
  })).filter((lane) => lane.flags.length > 0);

  const wave = { stepMs: delivery.series.stepMs, durationMs, width, height: WAVE_H, pad: ROW_PAD, answers };
  return {
    width,
    durationMs,
    pace: buildPace({
      points: delivery.series.pace,
      answers,
      words: delivery.transcript?.words ?? [],
      wpmMean: delivery.metrics.wpmMean,
      band: PACE_BAND,
      x,
      height: PACE_H,
      pad: ROW_PAD,
    }),
    pitch: buildWave(delivery.series.pitchSt, { ...wave, minLimit: 4, maxLimit: 12, limitStep: 2 }),
    energy: buildWave(delivery.series.energyDb, { ...wave, minLimit: 6, maxLimit: 18, limitStep: 3 }),
    answers: answerMarks,
    lanes,
    ticks: buildTicks(durationMs, width),
  };
}

// ---------------------------------------------------------------------------
// Reading a moment, for the tooltip
// ---------------------------------------------------------------------------

interface Reading {
  ms: number;
  pace: number | null;
  /** The pace is the answer's own, over its spoken span: the answer had no 15 s window. */
  paceWhole: boolean;
  pitch: number | null;
  energy: number | null;
  answer: AnswerMark | null;
  /** The answer's own figures, the same the table shows. */
  answerStats: DeliveryAnswer | null;
  /** Inside an answer, at a step with no speech. */
  pause: boolean;
  interviewer: boolean;
  flags: FlagMark[];
}

/** The series' mean over ±1 s, so the tooltip reads a moment, not one noisy sample. */
function seriesAt(values: ReadonlyArray<number | null>, stepMs: number, ms: number): number | null {
  const step = stepMs > 0 ? stepMs : 250;
  const centre = Math.floor(ms / step);
  const reach = Math.max(0, Math.round(1000 / step));
  let sum = 0;
  let n = 0;
  for (let i = Math.max(0, centre - reach); i <= Math.min(values.length - 1, centre + reach); i++) {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    sum += v;
    n++;
  }
  return n === 0 ? null : sum / n;
}

function readAt(ms: number, delivery: DeliveryReport, geometry: Geometry, turns: readonly DeliveryTurn[], pinned: string | null): Reading {
  const answer = geometry.answers.find((a) => ms >= a.startMs && ms < a.endMs) ?? null;
  let pace: number | null = null;
  let paceWhole = false;
  if (answer) {
    let best = Infinity;
    for (const p of delivery.series.pace) {
      const distance = Math.abs(p.atMs - ms);
      if (p.atMs >= answer.startMs && p.atMs < answer.endMs && distance <= 10_000 && distance < best) {
        best = distance;
        pace = p.wpm;
      }
    }
    // An answer the chart draws at its own pace reads the same number here.
    const span = pace === null ? geometry.pace.spans.find((s) => s.turnId === answer.turnId) : undefined;
    if (span) {
      pace = span.wpm;
      paceWhole = true;
    }
  }
  const step = delivery.series.stepMs > 0 ? delivery.series.stepMs : 250;
  const energy = delivery.series.energyDb;
  const index = Math.floor(ms / step);
  const interviewer = !answer && turns.some((t) => t.who === "ai" && t.startMs !== undefined && t.endMs !== undefined && ms >= t.startMs && ms < t.endMs);
  const flags = geometry.lanes.flatMap((lane) => lane.flags).filter((f) => f.flag.id === pinned || (ms >= f.flag.atMs && ms <= f.flag.endMs));
  return {
    ms,
    pace,
    paceWhole,
    pitch: seriesAt(delivery.series.pitchSt, delivery.series.stepMs, ms),
    energy: seriesAt(energy, delivery.series.stepMs, ms),
    answer,
    answerStats: answer ? (delivery.answers.find((a) => a.turnId === answer.turnId) ?? null) : null,
    // Energy is null exactly where the recording had no speech; without the series there's no telling.
    pause: answer !== null && index < energy.length && (energy[index] === null || energy[index] === undefined),
    interviewer,
    flags,
  };
}

function readingSentence(r: Reading): string {
  const parts = [formatClock(r.ms)];
  if (r.answer) {
    parts.push(`answer ${r.answer.number}, ${ariaTime(r.ms - r.answer.startMs)} in`);
    if (r.pause) parts.push("a pause");
  } else if (r.interviewer) parts.push("interviewer speaking");
  if (r.pace !== null) parts.push(`pace ${Math.round(r.pace)} words a minute${r.paceWhole ? " over the whole answer" : ""}`);
  if (r.pitch !== null) parts.push(`pitch ${formatSigned(r.pitch)} semitones`);
  if (r.energy !== null) parts.push(`energy ${formatSigned(r.energy)} decibels`);
  for (const f of r.flags) parts.push(`${FLAG_KIND_META[f.flag.kind].label}: ${formatMeasure(f.flag.measure)}`);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Cursor {
  ms: number;
  source: "pointer" | "keyboard" | "marker";
  /** The finding a hovered or focused marker points at, shown even at its edge. */
  flagId: string | null;
}

const DeliveryTimeline: FC<DeliveryTimelineProps> = ({ delivery, turns, className }) => {
  const controls = usePlaybackControls();
  const seekTo = controls?.seekTo ?? null;
  const hintId = useId();
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  // Handlers read the cursor from here: two key presses can arrive before a
  // re-render, and the second must step from where the first left it.
  const cursorRef = useRef<Cursor | null>(null);
  const moveCursor = useCallback((next: Cursor | null) => {
    cursorRef.current = next;
    setCursor(next);
  }, []);
  const [tableOpen, setTableOpen] = useState(false);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Whether the scroller follows the playhead while playing. Scrolling the
  // chart by hand means the reader wants to look elsewhere, as it does for
  // the transcript, so it stops pulling them back; pressing play again, or
  // playing from a point on the chart, picks it up again.
  const followRef = useRef(true);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const measure = useCallback((el: HTMLDivElement | null) => {
    plotRef.current = el;
    if (!el) return undefined;
    // Measured now, as the element attaches, so the chart is drawn in the
    // same commit; the observer only reports from the next rendering update.
    const style = window.getComputedStyle(el);
    const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
    setWidth(Math.max(0, Math.round(el.clientWidth - padding)));
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === w ? prev : w));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      plotRef.current = null;
    };
  }, []);

  // Nothing to place on a zero-length axis; the placeholder keeps the space.
  const geometry = useMemo(
    () => (width > 0 && timelineDuration(delivery) > 0 ? buildGeometry(delivery, turns, width) : null),
    [delivery, turns, width]
  );
  const durationMs = geometry?.durationMs ?? timelineDuration(delivery);
  // Known before the plot is measured, so the label column and the
  // placeholder already have their final height.
  const laneKinds = useMemo(() => DELIVERY_FLAG_KINDS.filter((kind) => delivery.flags.some((f) => f.kind === kind)), [delivery.flags]);
  const plotHeight = PACE_H + WAVE_H * 2 + ANSWERS_H + AXIS_H + laneKinds.length * LANE_H + (4 + laneKinds.length) * ROW_GAP;
  const reading = useMemo(
    () => (cursor && geometry ? readAt(cursor.ms, delivery, geometry, turns, cursor.flagId) : null),
    [cursor, geometry, delivery, turns]
  );
  const hasAverage = delivery.metrics.wpmMean !== null;

  const msAtClientX = (clientX: number): number | null => {
    const el = plotRef.current;
    if (!el || durationMs <= 0) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return clampTo(((clientX - rect.left) / rect.width) * durationMs, 0, durationMs);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const ms = msAtClientX(e.clientX);
    if (ms === null) return;
    // A marker under the pointer keeps its own reading.
    if (cursorRef.current?.source !== "marker") moveCursor({ ms, source: "pointer", flagId: null });
  };
  const onPointerLeave = () => {
    if (cursorRef.current?.source !== "keyboard") moveCursor(null);
  };

  // A click on the plot is an exact "play from here", so no preroll.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const ms = msAtClientX(e.clientX);
    if (ms !== null && seekTo) seekTo(ms, { preroll: 0 });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || durationMs <= 0) return;
    const from = cursorRef.current?.ms ?? Math.max(0, controls?.currentMs.getSnapshot() ?? 0);
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
        next = from + (e.shiftKey ? KEY_PAGE_MS : KEY_STEP_MS);
        break;
      case "ArrowLeft":
        next = from - (e.shiftKey ? KEY_PAGE_MS : KEY_STEP_MS);
        break;
      case "PageDown":
        next = from + KEY_PAGE_MS;
        break;
      case "PageUp":
        next = from - KEY_PAGE_MS;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = durationMs;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (seekTo) seekTo(from, { preroll: 0 });
        return;
      case "Escape":
        moveCursor(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    moveCursor({ ms: clampTo(next, 0, durationMs), source: "keyboard", flagId: null });
  };

  const onMarkerEnter = useCallback((ms: number, flagId: string | null) => moveCursor({ ms, source: "marker", flagId }), [moveCursor]);
  const onMarkerLeave = useCallback(() => {
    if (cursorRef.current?.source === "marker") moveCursor(null);
  }, [moveCursor]);

  // A reader's own sideways scroll: a trackpad swipe or shift-wheel, a
  // sideways touch swipe, or a drag on the scrollbar. The scroller's own
  // scrollTo fires none of these, so following never cancels itself.
  const onScrollerWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) followRef.current = false;
  };
  const onScrollerTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onScrollerTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const from = touchRef.current;
    const t = e.touches[0];
    if (!from || !t) return;
    const dx = Math.abs(t.clientX - from.x);
    // A vertical swipe is scrolling the page, not the chart.
    if (dx > SWIPE_PX && dx > Math.abs(t.clientY - from.y)) followRef.current = false;
  };
  // The scroller's own box is only its scrollbar and padding; the rows cover the rest.
  const onScrollerPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) followRef.current = false;
  };
  // A click or Enter on the plot, an answer or a finding plays from a point
  // the reader is looking at, so following it from there is what they expect.
  const onScrollerClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) followRef.current = true;
  };
  const onScrollerKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") followRef.current = true;
  };

  const answerCount = delivery.answers.length;

  return (
    <section aria-label="Delivery over time" className={cn("rounded-2xl border border-black/10 dark:border-white/15", TONE.surface, className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pb-3 pt-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-[14.5px] font-bold text-primary dark:text-white">Delivery over time</h3>
            {durationMs > 0 && (
              <span className="text-xs text-black/40 dark:text-white/45">
                {answerCount} {answerCount === 1 ? "answer" : "answers"} · {formatDuration(durationMs)}
              </span>
            )}
          </div>
          <p id={hintId} className="mt-0.5 text-xs leading-relaxed text-black/50 dark:text-white/55">
            {seekTo ? "Click anywhere to play from that moment. With the chart focused, arrow keys move through it and Enter plays." : "Pace, pitch and energy across the session."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTableOpen((v) => !v)}
          aria-expanded={tableOpen}
          className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-md text-xs font-bold text-black/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] dark:text-white/60 dark:hover:text-white">
          {tableOpen ? "Hide numbers" : "Show as a table"}
          <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 transition-transform motion-reduce:transition-none", tableOpen && "rotate-180")} />
        </button>
      </header>

      <div
        ref={scrollerRef}
        onWheel={onScrollerWheel}
        onTouchStart={onScrollerTouchStart}
        onTouchMove={onScrollerTouchMove}
        onPointerDown={onScrollerPointerDown}
        onClickCapture={onScrollerClickCapture}
        onKeyDownCapture={onScrollerKeyDownCapture}
        className="overflow-x-auto overscroll-x-contain pb-3">
        <div className="flex">
          {/* Label column: stays in view while the plot scrolls under it. */}
          <div className={cn("sticky left-0 z-20 flex w-[104px] flex-none flex-col gap-1.5 pl-5 pr-2 sm:w-[132px] sm:pl-6", TONE.surface)}>
            <RowLabel
              height="h-[76px]"
              name="Pace"
              unit="wpm"
              notes={hasAverage ? [["band", `${PACE_BAND.low}–${PACE_BAND.high} band`], ["reference", "your average"]] : [["band", `${PACE_BAND.low}–${PACE_BAND.high} band`]]}
            />
            <RowLabel height="h-[64px]" name="Pitch" unit="semitones" notes={[["reference", "your median"]]} />
            <RowLabel height="h-[64px]" name="Energy" unit="dB" notes={[["reference", "your median"]]} />
            <RowLabel height="h-[28px]" name="Answers" />
            {laneKinds.map((kind) => (
              <RowLabel key={kind} height="h-[24px]" name={FLAG_KIND_META[kind].short} tone="flag" />
            ))}
            <div className="h-[22px]" />
          </div>

          <div
            ref={measure}
            role="group"
            aria-roledescription="timeline"
            aria-label={`Delivery timeline, ${ariaTime(durationMs)}`}
            aria-describedby={hintId}
            tabIndex={0}
            onPointerMove={onPointerMove}
            onPointerDown={onPointerMove}
            onPointerLeave={onPointerLeave}
            onClick={onClick}
            onKeyDown={onKeyDown}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) moveCursor(null);
            }}
            className={cn(
              "relative min-w-[480px] flex-1 rounded-lg pr-5 outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] sm:pr-6",
              seekTo ? "cursor-crosshair" : "cursor-default"
            )}>
            <div className="flex flex-col gap-1.5">
              {geometry ? (
                <>
                  <StaticRows geometry={geometry} />
                  <AnswerRow geometry={geometry} onEnter={onMarkerEnter} onLeave={onMarkerLeave} />
                  {geometry.lanes.map((lane) => (
                    <FlagLane key={lane.kind} lane={lane} width={geometry.width} onEnter={onMarkerEnter} onLeave={onMarkerLeave} />
                  ))}
                  <TimeAxis geometry={geometry} />
                </>
              ) : (
                // Before the first measurement: the same height, so nothing jumps.
                <div aria-hidden style={{ height: plotHeight }} />
              )}
            </div>

            {geometry && <Playhead width={geometry.width} durationMs={geometry.durationMs} scrollerRef={scrollerRef} plotRef={plotRef} followRef={followRef} />}
            {geometry && reading && <CursorLayer reading={reading} width={geometry.width} durationMs={geometry.durationMs} />}
            {/* The keyboard cursor's reading, spoken; hover readings are not, they'd be noise. */}
            <p aria-live="polite" className="sr-only">
              {cursor?.source === "keyboard" && reading ? readingSentence(reading) : ""}
            </p>
          </div>
        </div>
      </div>

      <ReadingGuide geometry={geometry} hasFlags={laneKinds.length > 0} />

      {tableOpen && <AnswersTable delivery={delivery} turns={turns} />}
    </section>
  );
};

// ---------------------------------------------------------------------------
// Label column
// ---------------------------------------------------------------------------

type Swatch = "band" | "reference";

/** A key for a row's context marks, drawn as the mark itself: a lime block for the band, a hairline for "you, typically". */
const SwatchMark: FC<{ kind: Swatch }> = ({ kind }) =>
  kind === "band" ? (
    <span aria-hidden className="h-2 w-2 flex-none rounded-[2px] bg-[#e1f073]/60" />
  ) : (
    <span aria-hidden className="h-px w-2.5 flex-none bg-black/35 dark:bg-white/40" />
  );

const RowLabel: FC<{ height: string; name: string; unit?: string; notes?: ReadonlyArray<readonly [Swatch, string]>; tone?: "flag" }> = ({
  height,
  name,
  unit,
  notes,
  tone,
}) => (
  <div className={cn("flex flex-col justify-center overflow-hidden", height)}>
    <span className={cn("flex items-center gap-1.5 truncate text-[11px] font-bold leading-tight", tone === "flag" ? "text-[#b23c26] dark:text-[#f08a74]" : "text-primary dark:text-white")}>
      {tone === "flag" && <span aria-hidden className="h-1.5 w-1.5 flex-none rotate-45 bg-current" />}
      {name}
    </span>
    {unit && <span className="truncate text-[10px] leading-tight text-black/45 dark:text-white/50">{unit}</span>}
    {notes?.map(([kind, text]) => (
      <span key={text} className="mt-0.5 inline-flex items-center gap-1 truncate text-[10px] leading-tight text-black/45 dark:text-white/50">
        <SwatchMark kind={kind} />
        {text}
      </span>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Static rows
// ---------------------------------------------------------------------------

const Panel: FC<{ width: number; height: number }> = ({ width, height }) => <rect x={0} y={0} width={width} height={height} rx={6} className={TONE.panel} />;

const GridLines: FC<{ ticks: Geometry["ticks"]; height: number }> = ({ ticks, height }) => (
  <g aria-hidden className={TONE.grid}>
    {ticks.map((t) => (
      <line key={t.ms} x1={t.x} x2={t.x} y1={0} y2={height} stroke="currentColor" strokeWidth={1} shapeRendering="crispEdges" />
    ))}
  </g>
);

/** A value label inside the plot, haloed in the panel colour so a line under it can't swallow it. */
const PlotLabel: FC<{ x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end" }> = ({ x, y, children, anchor = "start" }) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    dominantBaseline="middle"
    paintOrder="stroke"
    strokeWidth={3}
    strokeLinejoin="round"
    className={cn("text-[9.5px] font-semibold tabular-nums", TONE.muted, TONE.panelRing)}>
    {children}
  </text>
);

/** Dots, not dashes: a span joined across a pause, never mistaken for a measured one. */
const BRIDGE_DASH = "0 4";

const StaticRows = memo(function StaticRows({ geometry }: { geometry: Geometry }) {
  const { width, pace, pitch, energy, ticks } = geometry;
  return (
    <>
      <PaceRow pace={pace} width={width} ticks={ticks} />
      <WaveRow wave={pitch} width={width} ticks={ticks} unit="st" />
      <WaveRow wave={energy} width={width} ticks={ticks} unit="dB" />
    </>
  );
});

const PaceRow: FC<{ pace: PaceGeometry; width: number; ticks: Geometry["ticks"] }> = ({ pace, width, ticks }) => {
  const charted = pace.line !== "" || pace.dots.length > 0 || pace.spans.length > 0;
  // The average's label sits above its line unless that would crowd the top label.
  const avgLabelY = pace.avgY - 7 < pace.hiY + 12 ? pace.avgY + 7 : pace.avgY - 7;
  if (pace.empty) {
    // No word timings at all: a band and a scale with nothing on them would only suggest there should be.
    return (
      <svg width={width} height={PACE_H} className="block overflow-visible" aria-hidden>
        <Panel width={width} height={PACE_H} />
        <GridLines ticks={ticks} height={PACE_H} />
        <PlotLabel x={width / 2} y={PACE_H / 2} anchor="middle">
          Unavailable
        </PlotLabel>
      </svg>
    );
  }
  return (
    <svg width={width} height={PACE_H} className="block overflow-visible" aria-hidden>
      <Panel width={width} height={PACE_H} />
      <GridLines ticks={ticks} height={PACE_H} />
      <rect x={0} y={pace.bandY0} width={width} height={Math.max(1, pace.bandY1 - pace.bandY0)} fill="currentColor" className={cn(TONE.band, "opacity-50 dark:opacity-20")} />
      {pace.avg !== null && (
        <line x1={0} x2={width} y1={pace.avgY} y2={pace.avgY} stroke="currentColor" strokeWidth={1} shapeRendering="crispEdges" className={TONE.reference} />
      )}
      <g className={TONE.line}>
        {/* An answer's own pace across its spoken span, bracketed at both ends so it reads as one figure for the whole stretch. */}
        {pace.spans.map((s) => (
          <path
            key={s.turnId}
            d={`M${s.x0} ${s.y}H${s.x1}M${s.x0} ${s.y - 4}V${s.y + 4}M${s.x1} ${s.y - 4}V${s.y + 4}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        <path d={pace.bridge} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={BRIDGE_DASH} opacity={0.75} />
        <path d={pace.line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* One dot per 15 s window: the line between them is only the join. */}
        {pace.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={3} fill="currentColor" strokeWidth={1.5} className={TONE.panelRing} />
        ))}
      </g>
      <PlotLabel x={4} y={pace.hiY + 4}>
        {pace.hi}
      </PlotLabel>
      <PlotLabel x={4} y={pace.loY - 4}>
        {pace.lo}
      </PlotLabel>
      {pace.avg !== null && (
        <PlotLabel x={width - 4} y={avgLabelY} anchor="end">
          {`your avg ${Math.round(pace.avg)}`}
        </PlotLabel>
      )}
      {!charted && (
        <PlotLabel x={width / 2} y={ROW_PAD + 8} anchor="middle">
          No answer was long enough to chart; your average is shown
        </PlotLabel>
      )}
    </svg>
  );
};

const WaveRow: FC<{ wave: WaveGeometry; width: number; ticks: Geometry["ticks"]; unit: string }> = ({ wave, width, ticks, unit }) => (
  <svg width={width} height={WAVE_H} className="block overflow-visible" aria-hidden>
    <Panel width={width} height={WAVE_H} />
    <GridLines ticks={ticks} height={WAVE_H} />
    {wave.empty ? (
      // No prosody at all (or none in this series): say so rather than draw an empty row.
      <PlotLabel x={width / 2} y={WAVE_H / 2} anchor="middle">
        Unavailable
      </PlotLabel>
    ) : (
      <>
        {/* Zero is the user's own median: the one reference line this row needs. */}
        <line x1={0} x2={width} y1={wave.zeroY} y2={wave.zeroY} stroke="currentColor" strokeWidth={1} shapeRendering="crispEdges" className={TONE.reference} />
        <g className={TONE.line}>
          <path d={wave.area} fill="currentColor" fillOpacity={0.12} />
          <path d={wave.bridge} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={BRIDGE_DASH} opacity={0.75} />
          <path d={wave.line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {wave.dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={1.75} fill="currentColor" />
          ))}
        </g>
        <PlotLabel x={4} y={ROW_PAD + 3}>
          {`+${wave.limit} ${unit}`}
        </PlotLabel>
        <PlotLabel x={4} y={WAVE_H - ROW_PAD - 3}>
          {`${formatSigned(-wave.limit, 0)} ${unit}`}
        </PlotLabel>
      </>
    )}
  </svg>
);

const TimeAxis = memo(function TimeAxis({ geometry }: { geometry: Geometry }) {
  const { width, ticks } = geometry;
  return (
    <svg width={width} height={AXIS_H} className="block overflow-visible" aria-hidden>
      <line x1={0} x2={width} y1={0.5} y2={0.5} stroke="currentColor" strokeWidth={1} className="text-black/15 dark:text-white/20" />
      {ticks.map((t, i) => (
        <text
          key={t.ms}
          x={t.x}
          y={14}
          textAnchor={i === 0 ? "start" : t.x > width - 16 ? "end" : "middle"}
          className={cn("text-[10px] font-semibold tabular-nums", TONE.muted)}>
          {formatClock(t.ms)}
        </text>
      ))}
    </svg>
  );
});

// ---------------------------------------------------------------------------
// Interactive marks
// ---------------------------------------------------------------------------

interface MarkHandlers {
  onEnter: (ms: number, flagId: string | null) => void;
  onLeave: () => void;
}

/** SVG buttons: Enter and Space press them, like the HTML kind. */
function pressOnKey(e: KeyboardEvent<SVGGElement>, press: () => void) {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  e.stopPropagation();
  press();
}

const AnswerRow = memo(function AnswerRow({ geometry, onEnter, onLeave }: { geometry: Geometry } & MarkHandlers) {
  return (
    <svg width={geometry.width} height={ANSWERS_H} className="block overflow-visible">
      {geometry.answers.map((a) => (
        <AnswerSpan key={a.turnId} mark={a} onEnter={onEnter} onLeave={onLeave} />
      ))}
    </svg>
  );
});

const AnswerSpan: FC<{ mark: AnswerMark } & MarkHandlers> = ({ mark, onEnter, onLeave }) => {
  const seekTo = usePlaybackControls()?.seekTo ?? null;
  const current = usePlaybackTime((ms) => ms >= mark.startMs && ms < mark.endMs);
  const w = Math.max(3, mark.x1 - mark.x0);
  const label = `Answer ${mark.number}, ${formatClock(mark.startMs)} to ${formatClock(mark.endMs)}${mark.question ? `: ${clip(mark.question, 90)}` : ""}`;
  // Playing an answer starts a moment before it, on the end of the question.
  const press = () => seekTo?.(mark.startMs);
  return (
    <g
      role={seekTo ? "button" : "img"}
      tabIndex={seekTo ? 0 : undefined}
      onClick={(e) => {
        e.stopPropagation();
        press();
      }}
      onKeyDown={(e) => pressOnKey(e, press)}
      onPointerEnter={() => onEnter(mark.startMs, null)}
      onPointerLeave={onLeave}
      onFocus={() => onEnter(mark.startMs, null)}
      onBlur={onLeave}
      className={cn("group outline-none", seekTo && "cursor-pointer")}>
      <title>{label}</title>
      <rect
        x={mark.x0}
        y={3}
        width={w}
        height={ANSWERS_H - 6}
        rx={4}
        className={cn(
          "transition-colors motion-reduce:transition-none",
          current ? "fill-[#e1f073]" : "fill-[#f0f0ea] group-hover:fill-[#e6e6de] dark:fill-white/10 dark:group-hover:fill-white/20"
        )}
      />
      <rect aria-hidden x={mark.x0 - 1} y={2} width={w + 2} height={ANSWERS_H - 4} rx={5} fill="none" strokeWidth={2} className="stroke-[#222325] opacity-0 group-focus-visible:opacity-100 dark:stroke-[#e1f073]" />
      {mark.caption ? (
        // Number, then the question it answered, cut to the bar: the row reads as the interview's running order.
        <text x={mark.x0 + 8} y={ANSWERS_H / 2 + 0.5} dominantBaseline="middle" className="pointer-events-none text-[10.5px] tabular-nums">
          <tspan className={cn("font-bold", current ? "fill-[#222325]" : "fill-[#222325] dark:fill-white")}>{mark.number}</tspan>
          <tspan dx={6} className={cn("text-[10px] font-semibold", current ? "fill-[#222325]/70" : "fill-black/50 dark:fill-white/55")}>
            {mark.caption}
          </tspan>
        </text>
      ) : (
        w >= 16 && (
          <text x={mark.x0 + w / 2} y={ANSWERS_H / 2 + 0.5} textAnchor="middle" dominantBaseline="middle" className={cn("pointer-events-none text-[10.5px] font-bold tabular-nums", current ? "fill-[#222325]" : "fill-[#222325] dark:fill-white")}>
            {mark.number}
          </text>
        )
      )}
    </g>
  );
};

const FlagLane = memo(function FlagLane({ lane, width, onEnter, onLeave }: { lane: Lane; width: number } & MarkHandlers) {
  return (
    <svg width={width} height={LANE_H} className="block overflow-visible">
      <line aria-hidden x1={0} x2={width} y1={LANE_H / 2} y2={LANE_H / 2} stroke="currentColor" strokeWidth={1} className={TONE.grid} shapeRendering="crispEdges" />
      {lane.flags.map((f) => (
        <FlagMarker key={f.flag.id} mark={f} onEnter={onEnter} onLeave={onLeave} />
      ))}
    </svg>
  );
});

/** Marker half-size by severity: a stronger finding is a bigger diamond (never less than 8 px across). */
const DIAMOND: Record<1 | 2 | 3, number> = { 1: 4, 2: 5, 3: 6.5 };

const FlagMarker: FC<{ mark: FlagMark } & MarkHandlers> = ({ mark, onEnter, onLeave }) => {
  const seekTo = usePlaybackControls()?.seekTo ?? null;
  const { flag } = mark;
  const current = usePlaybackTime((ms) => ms >= flag.atMs && ms <= flag.endMs);
  const meta = FLAG_KIND_META[flag.kind];
  const r = DIAMOND[flag.severity] + (current ? 1 : 0);
  const cy = LANE_H / 2;
  const cx = mark.x0;
  const label = `${meta.label} (${SEVERITY_LABELS[flag.severity].toLowerCase()}) at ${formatClock(flag.atMs)}${mark.number !== null ? `, answer ${mark.number}` : ""}: ${formatMeasure(flag.measure)}`;
  const press = () => seekTo?.(flag.atMs);
  return (
    <g
      role={seekTo ? "button" : "img"}
      tabIndex={seekTo ? 0 : undefined}
      onClick={(e) => {
        e.stopPropagation();
        press();
      }}
      onKeyDown={(e) => pressOnKey(e, press)}
      onPointerEnter={() => onEnter(flag.atMs, flag.id)}
      onPointerLeave={onLeave}
      onFocus={() => onEnter(flag.atMs, flag.id)}
      onBlur={onLeave}
      className={cn("group outline-none", TONE.flag, seekTo && "cursor-pointer")}>
      <title>{label}</title>
      {/* The span the finding covers, as a wash; the diamond marks where it starts. */}
      <rect x={mark.x0} y={cy - 3} width={Math.max(3, mark.x1 - mark.x0)} height={6} rx={3} fill="currentColor" fillOpacity={current ? 0.45 : 0.2} />
      {/* A hit area wider than the mark: nobody should have to land on 8 px. */}
      <rect x={cx - 12} y={0} width={24} height={LANE_H} fill="transparent" />
      <path
        d={`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`}
        fill="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        className={TONE.ring}
      />
      <circle aria-hidden cx={cx} cy={cy} r={r + 4} fill="none" strokeWidth={2} className="stroke-[#222325] opacity-0 group-focus-visible:opacity-100 dark:stroke-[#e1f073]" />
    </g>
  );
};

// ---------------------------------------------------------------------------
// Playhead and crosshair
// ---------------------------------------------------------------------------

interface PlayheadProps {
  width: number;
  durationMs: number;
  scrollerRef: RefObject<HTMLDivElement | null>;
  plotRef: RefObject<HTMLDivElement | null>;
  /** Cleared when the reader scrolls the chart themselves. */
  followRef: RefObject<boolean>;
}

/** Re-renders only when the playhead crosses a whole pixel. */
const Playhead: FC<PlayheadProps> = ({ width, durationMs, scrollerRef, plotRef, followRef }) => {
  const x = usePlaybackTime((ms) => (ms < 0 || durationMs <= 0 ? -1 : Math.round((Math.min(ms, durationMs) / durationMs) * width)));
  const playing = usePlaybackState()?.playing ?? false;

  // Pressing play means "watch it": follow again, even after scrolling away.
  // Declared before the effect below, so it has run by the time that one does.
  useEffect(() => {
    if (playing) followRef.current = true;
  }, [playing, followRef]);

  // On a narrow screen the plot scrolls; keep the playhead in view while
  // playing, but leave the user's own scrolling alone while paused, and once
  // they have scrolled by hand.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const plot = plotRef.current;
    if (!playing || !followRef.current || x < 0 || !scroller || !plot || scroller.scrollWidth <= scroller.clientWidth) return;
    // Where the plot starts in the scroller's content: the width of the
    // sticky label column that covers the start of every scrolled view.
    const gutter = plot.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    const visible = scroller.clientWidth - gutter;
    const left = scroller.scrollLeft;
    if (x >= left + 16 && x <= left + visible - 32) return;
    // Near the end the scroller is already as far as it goes; don't ask again every pixel.
    const target = clampTo(x - visible / 3, 0, scroller.scrollWidth - scroller.clientWidth);
    if (Math.abs(target - left) < 1) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" });
  }, [x, playing, scrollerRef, plotRef, followRef]);

  if (x < 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-[22px] left-0 top-0 z-10 -ml-px w-0.5 bg-[#222325] dark:bg-white"
      style={{ transform: `translateX(${x}px)` }}>
      <span className="absolute -left-[4px] -top-[3px] h-2.5 w-2.5 rounded-full border-2 border-[#222325] bg-[#e1f073] dark:border-white" />
    </div>
  );
};

const TOOLTIP_W = 236;

const CursorLayer: FC<{ reading: Reading; width: number; durationMs: number }> = ({ reading, width, durationMs }) => {
  const x = Math.round((reading.ms / Math.max(1, durationMs)) * width);
  const flip = x + 14 + TOOLTIP_W > width;
  const left = flip ? Math.max(0, x - 14 - TOOLTIP_W) : x + 14;
  const { answer, answerStats } = reading;
  const context = answer ? `Answer ${answer.number}` : reading.interviewer ? "Interviewer speaking" : "Between answers";
  const measured = reading.pace !== null || reading.pitch !== null || reading.energy !== null;
  // The answer's own figures, as the table has them; its pace is left out when the line above already is it.
  const whole: string[] = [];
  if (answerStats) {
    // Non-breaking spaces: a unit wrapped onto a line of its own reads as a stray word.
    if (answerStats.wpm !== null && !reading.paceWhole) whole.push(`${Math.round(answerStats.wpm)}\u00a0wpm`);
    if (answerStats.pitchRangeSt !== null) whole.push(`pitch range ${answerStats.pitchRangeSt.toFixed(1)}\u00a0st`);
  }
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute bottom-[22px] left-0 top-0 z-10 w-px bg-black/40 dark:bg-white/50" style={{ transform: `translateX(${x}px)` }} />
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-2 z-30 w-[236px] rounded-xl border-[1.5px] border-[#222325] bg-white p-3 shadow-[3px_3px_0_0_#222325] dark:border-white/30 dark:bg-[#2c2d30] dark:shadow-none"
        style={{ transform: `translateX(${left}px)` }}>
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold tabular-nums text-primary dark:text-white">{formatClock(reading.ms)}</span>
          <span className="truncate text-[11px] font-semibold text-black/45 dark:text-white/55">{context}</span>
        </p>
        {answer && (
          <p className="text-[11px] tabular-nums text-black/45 dark:text-white/50">
            {formatClock(reading.ms - answer.startMs)} into the answer
            {reading.pause && <span className="font-semibold text-black/60 dark:text-white/70"> · pause</span>}
          </p>
        )}
        {answer?.question && <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-black/55 dark:text-white/60">{answer.question}</p>}
        {measured && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-xs">
            <TooltipValue label={reading.paceWhole ? "pace, whole answer" : "pace"} value={reading.pace === null ? "—" : `${Math.round(reading.pace)} wpm`} />
            <TooltipValue label="pitch vs your median" value={reading.pitch === null ? "—" : `${formatSigned(reading.pitch)} st`} />
            <TooltipValue label="energy vs your median" value={reading.energy === null ? "—" : `${formatSigned(reading.energy)} dB`} />
          </dl>
        )}
        {whole.length > 0 && (
          <p className="mt-2 text-[11px] leading-snug text-black/50 dark:text-white/55">
            <span className="font-semibold text-black/60 dark:text-white/70">Whole answer:</span> {whole.join(" · ")}
          </p>
        )}
        {reading.flags.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5 border-t border-black/10 pt-2 dark:border-white/15">
            {reading.flags.map((f) => (
              <li key={f.flag.id} className="text-[11px] leading-snug">
                <span className="flex items-center gap-1.5 font-bold text-[#b23c26] dark:text-[#f08a74]">
                  <span className="h-1.5 w-1.5 flex-none rotate-45 bg-current" />
                  {FLAG_KIND_META[f.flag.kind].label}
                  <span className="font-semibold text-black/40 dark:text-white/45">· {SEVERITY_LABELS[f.flag.severity]}</span>
                </span>
                <span className="text-black/60 dark:text-white/65">{formatMeasure(f.flag.measure)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

/** Value first, name second: the reader already knows the row and wants the number. */
const TooltipValue: FC<{ label: string; value: string }> = ({ label, value }) => (
  <>
    <dd className="text-right font-bold tabular-nums text-primary dark:text-white">{value}</dd>
    <dt className="text-black/45 dark:text-white/50">{label}</dt>
  </>
);

// ---------------------------------------------------------------------------
// How to read it
// ---------------------------------------------------------------------------

/**
 * What each row means and what good looks like, then a key to the marks.
 * The chart has to stand on its own wherever the report puts it, so it
 * explains itself instead of leaning on the findings above it.
 */
const ReadingGuide: FC<{ geometry: Geometry | null; hasFlags: boolean }> = ({ geometry, hasFlags }) => {
  const bridged = geometry !== null && (geometry.pitch.bridged || geometry.energy.bridged || geometry.pace.bridge !== "");
  const spans = geometry !== null && geometry.pace.spans.length > 0;
  return (
    <div className="border-t border-black/10 px-5 pb-4 pt-3.5 dark:border-white/15 sm:px-6">
      <dl className="grid gap-x-6 gap-y-2 text-[11.5px] leading-relaxed sm:grid-cols-3">
        <GuideEntry name="Pace">
          Words a minute in each 15 s of an answer. Many listeners find {PACE_BAND.low}–{PACE_BAND.high} easy to follow; the band is context, not a score.
        </GuideEntry>
        <GuideEntry name="Pitch">
          How far your voice rose and fell around your usual. A line that moves, with a wide shaded band, sounds expressive; a thin, level one through a whole
          answer can sound flat.
        </GuideEntry>
        <GuideEntry name="Energy">
          Loudness around your usual. A line that slopes down through an answer is trailing off; steady or rising holds attention to the end.
        </GuideEntry>
      </dl>
      <ul aria-label="Key" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-black/50 dark:text-white/55">
        <KeyItem label="Measured">
          <path d="M1 5h16" strokeWidth={2} strokeLinecap="round" />
        </KeyItem>
        {bridged && (
          <KeyItem label="Joined across a short pause">
            <path d="M1 5h16" strokeWidth={2} strokeLinecap="round" strokeDasharray={BRIDGE_DASH} opacity={0.75} />
          </KeyItem>
        )}
        {/* Two phrases at different heights, not a dashed line: a break is where one stretch ends and the next begins. */}
        <KeyItem label={`Break: a silence over ${LONG_GAP_MS / 1000} s, or the next answer`}>
          <path d="M1 7h5M12 3h5" strokeWidth={2} strokeLinecap="round" />
        </KeyItem>
        {spans && (
          <KeyItem label="Pace of an answer too short for 15 s windows">
            <path d="M2 5h14M2 1.5v7M16 1.5v7" strokeWidth={2} strokeLinecap="round" />
          </KeyItem>
        )}
        {hasFlags && (
          <li className="inline-flex items-center gap-1.5">
            <svg aria-hidden width={18} height={10} viewBox="0 0 18 10" className={TONE.flag}>
              <path d="M4 2L7 5L4 8L1 5Z" fill="currentColor" />
              <path d="M13 0.5L17.5 5L13 9.5L8.5 5Z" fill="currentColor" />
            </svg>
            Findings; a bigger diamond is a stronger one
          </li>
        )}
      </ul>
    </div>
  );
};

const GuideEntry: FC<{ name: string; children: ReactNode }> = ({ name, children }) => (
  <div>
    <dt className="inline font-bold text-primary dark:text-white">{name} </dt>
    <dd className="inline text-black/55 dark:text-white/60">{children}</dd>
  </div>
);

/** A key entry drawn with the chart's own mark, so it matches what's on the plot. */
const KeyItem: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <li className="inline-flex items-center gap-1.5">
    <svg aria-hidden width={18} height={10} viewBox="0 0 18 10" fill="none" stroke="currentColor" className={TONE.line}>
      {children}
    </svg>
    {label}
  </li>
);

// ---------------------------------------------------------------------------
// The same numbers as a table
// ---------------------------------------------------------------------------

const AnswersTable: FC<{ delivery: DeliveryReport; turns: readonly DeliveryTurn[] }> = ({ delivery, turns }) => {
  const numbers = numberAnswers(turns);
  const answers = [...delivery.answers].sort((a, b) => a.startMs - b.startMs);
  const flagsByTurn = new Map<string, number>();
  for (const f of delivery.flags) flagsByTurn.set(f.turnId, (flagsByTurn.get(f.turnId) ?? 0) + 1);
  const first = answers.find((a) => a.energyDeltaDb !== null)?.energyDeltaDb ?? null;
  const dash = <span className="text-black/30 dark:text-white/30">—</span>;

  return (
    <div className="border-t border-black/10 px-5 pb-4 pt-3 dark:border-white/15 sm:px-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <caption className="sr-only">Delivery measures for each answer</caption>
          <thead>
            <tr className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-black/40 dark:text-white/45">
              <th scope="col" className="py-2 pr-3 font-bold">Answer</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Pace</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Pitch range</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Energy</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Lead-in</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Fillers</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Findings</th>
              <th scope="col" className="py-2 font-bold">
                <span className="sr-only">Play</span>
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-primary dark:text-white">
            {answers.map((a, i) => (
              <tr key={a.turnId} className="border-t border-black/5 dark:border-white/10">
                <th scope="row" className="py-2 pr-3 font-bold">
                  {numbers.get(a.turnId) ?? i + 1}{" "}
                  <span className="ml-1 font-normal text-black/45 dark:text-white/50">· {formatDuration(a.endMs - a.startMs)}</span>
                </th>
                <td className="py-2 pr-3 text-right">{a.wpm === null ? dash : `${Math.round(a.wpm)} wpm`}</td>
                <td className="py-2 pr-3 text-right">{a.pitchRangeSt === null ? dash : formatMeasureValue(a.pitchRangeSt, "st")}</td>
                <td className="py-2 pr-3 text-right">
                  {a.energyDeltaDb === null ? dash : `${formatSigned(a.energyDeltaDb - (first ?? 0))} dB`}
                </td>
                <td className="py-2 pr-3 text-right">{a.leadInMs === null ? dash : formatMeasureValue(a.leadInMs, "ms")}</td>
                <td className="py-2 pr-3 text-right">{delivery.metrics.fillersPer100Words === null ? dash : a.fillers}</td>
                <td className="py-2 pr-3 text-right">{flagsByTurn.get(a.turnId) ?? 0}</td>
                <td className="py-2 text-right">
                  <TimestampChip atMs={a.startMs} endMs={a.endMs} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-black/45 dark:text-white/50">
        Energy is each answer&apos;s loudness against your first answer. Pitch range is how far your pitch moved within the answer.
      </p>
    </div>
  );
};

export default DeliveryTimeline;
