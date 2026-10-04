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
  type RefObject,
  type TouchEvent,
  type WheelEvent,
} from "react";
import { cn } from "@/lib/utils";
import { FLAG_KIND_META, SEVERITY_LABELS, ariaTime, formatClock, formatDuration, formatMeasure, formatSigned, numberAnswers, type DeliveryTurn } from "@/app/lib/voice/format";
import type { DeliveryReport } from "@/app/lib/voice/types";
import {
  CHART_COLORS,
  answerFigures,
  buildChart,
  chartDuration,
  readingAt,
  type AnswerBand,
  type ChartGeometry,
  type ChartReading,
  type FlagMark,
} from "../report/deliveryChart";
import { usePlaybackControls, usePlaybackState, usePlaybackTime } from "./PlaybackProvider";
import TimestampChip from "./TimestampChip";

/**
 * The whole session on one chart: pitch, pace and energy, each against the
 * speaker's own usual in this session, around one dashed "usual" line. Pace
 * (wpm), pitch (semitones) and energy (dB) have nothing in common but time,
 * so none is drawn in its own unit: each line says how far above or below
 * the speaker's usual it was, and the readout beside the playhead gives the
 * numbers. The answers are shaded bands, labelled under the axis; a click
 * anywhere plays from there. The same figures per answer are one toggle away
 * (Table), for anyone who would rather read than look.
 *
 * Hand-drawn SVG on a measured width, with no chart library. The curves come
 * from deliveryCurves.ts through report/deliveryChart.ts: pooled into bins
 * sized to the width, short pauses bridged with a dotted span rather than
 * cutting the line, a monotone cubic that never overshoots the data. Answers
 * too short for a pace window show their own pace, flat across the answer,
 * so the chart agrees with the Pace figure and the table.
 *
 * Performance: the drawing is memoised and never follows playback. The
 * playhead, the readout, the lit answer and the lit findings each subscribe
 * to the time store with a selector, so a frame of playback re-renders only
 * what moved.
 *
 * Narrow screens: the chart keeps a 560 px minimum inside its own horizontal
 * scroller; the page never scrolls sideways. While playing, the scroller
 * follows the playhead until the reader scrolls it themselves.
 */
export interface DeliveryTimelineProps {
  delivery: DeliveryReport;
  turns: readonly DeliveryTurn[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Layout. Every y is from the top of the drawing.
// ---------------------------------------------------------------------------

/** The "higher / usual / lower" column at the left of the drawing. */
const LABEL_W = 46;
const RIGHT_PAD = 10;
const TOP = 16;
const PLOT_H = 164;
/** Room above and below the lines inside the plot. */
const PLOT_PAD = 12;
/** The answer labels under the plot. */
const ROW_Y = TOP + PLOT_H + 8;
const ROW_H = 18;
const AXIS_Y = 228;
const HEIGHT = 236;
/** The playhead runs from just above the plot to its floor. */
const PLAYHEAD_H = PLOT_H + 4;
/** Dots, not dashes: a span joined across a pause, never mistaken for a measured one. */
const BRIDGE_DASH = "0 4";

/** Crosshair keyboard steps. */
const KEY_STEP_MS = 5_000;
const KEY_PAGE_MS = 30_000;
/** A sideways swipe this long is the reader scrolling the chart, not tapping it. */
const SWIPE_PX = 8;
/** The readout's width, for flipping it to the left of the line near the right edge. */
const READOUT_W = 168;
/** Below these widths an answer's label shortens, then goes. */
const FULL_LABEL_PX = 104;
const SHORT_LABEL_PX = 22;

const clampTo = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

interface Cursor {
  ms: number;
  source: "pointer" | "keyboard";
}

type View = "chart" | "table";

const DeliveryTimeline: FC<DeliveryTimelineProps> = ({ delivery, turns, className }) => {
  const controls = usePlaybackControls();
  const seekTo = controls?.seekTo ?? null;
  const hintId = useId();
  const [view, setView] = useState<View>("chart");
  const numbers = useMemo(() => numberAnswers(turns), [turns]);
  const durationMs = chartDuration(delivery);

  const pitchEmpty = delivery.series.pitchSt.every((v) => v === null);
  const energyEmpty = delivery.series.energyDb.every((v) => v === null);
  const paceEmpty = delivery.series.pace.length === 0 && delivery.answers.every((a) => a.wpm === null);

  return (
    <section aria-label="Delivery over time" className={cn("overflow-hidden rounded-[14px] border border-black/[0.16] bg-white", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3">
        <h2 className="text-sm font-extrabold text-[#222325]">
          Delivery over time{" "}
          <span className="font-semibold text-[#5f6062]">· {seekTo ? "click anywhere to play from there" : "pitch, pace and energy across the session"}</span>
        </h2>
        <div role="group" aria-label="Show as" className="flex gap-[3px] rounded-[9px] bg-[#f0f0ea] p-[3px]">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "h-[26px] cursor-pointer rounded-[7px] px-2.5 text-xs font-bold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]",
                view === v ? "bg-[#222325] text-white" : "text-[#44453f] hover:text-[#222325]"
              )}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <ul aria-label="Key" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pt-1.5 text-xs font-bold text-[#222325]">
        <LegendItem color={CHART_COLORS.pitch} label="Pitch" missing={pitchEmpty} />
        <LegendItem color={CHART_COLORS.pace} label="Pace" missing={paceEmpty} />
        <LegendItem color={CHART_COLORS.energy} label="Energy" missing={energyEmpty} />
        <li className="font-medium text-[#5f6062]">Each line is measured against your own usual in this session.</li>
      </ul>

      {durationMs <= 0 ? (
        <p className="px-4 pb-4 pt-3 text-sm leading-relaxed text-black/55">Nothing was measured over time in this recording.</p>
      ) : view === "chart" ? (
        <Chart delivery={delivery} numbers={numbers} hintId={hintId} />
      ) : (
        <FiguresTable delivery={delivery} numbers={numbers} />
      )}
    </section>
  );
};

const LegendItem: FC<{ color: string; label: string; missing: boolean }> = ({ color, label, missing }) => (
  <li className="flex items-center gap-1.5">
    <svg aria-hidden width={14} height={4} className="flex-none">
      <rect width={14} height={3} y={0.5} rx={1.5} fill={color} />
    </svg>
    {label}
    {missing && <span className="font-medium text-[#5f6062]">(not measured)</span>}
  </li>
);

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

interface ChartProps {
  delivery: DeliveryReport;
  numbers: ReadonlyMap<string, number>;
  hintId: string;
}

const Chart: FC<ChartProps> = ({ delivery, numbers, hintId }) => {
  const controls = usePlaybackControls();
  const seekTo = controls?.seekTo ?? null;
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  // Handlers read the cursor from here: two key presses can arrive before a
  // re-render, and the second must step from where the first left it.
  const cursorRef = useRef<Cursor | null>(null);
  const moveCursor = useCallback((next: Cursor | null) => {
    cursorRef.current = next;
    setCursor(next);
  }, []);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Whether the scroller follows the playhead while playing. Scrolling the
  // chart by hand means the reader wants to look elsewhere, so it stops
  // pulling them back; pressing play again, or playing from a point on the
  // chart, picks it up again.
  const followRef = useRef(true);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const measure = useCallback((el: HTMLDivElement | null) => {
    plotRef.current = el;
    if (!el) return undefined;
    // Measured now, as the element attaches, so the chart is drawn in the
    // same commit; the observer only reports from the next rendering update.
    setWidth(Math.max(0, Math.round(el.clientWidth)));
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

  const plotW = Math.max(0, width - LABEL_W - RIGHT_PAD);
  const chart = useMemo(() => (plotW > 0 ? buildChart(delivery, numbers, { width: plotW, height: PLOT_H, pad: PLOT_PAD }) : null), [delivery, numbers, plotW]);
  const durationMs = chart?.durationMs ?? chartDuration(delivery);
  const keyboardReading = useMemo(
    () => (cursor?.source === "keyboard" && chart ? readingAt(cursor.ms, delivery, chart) : null),
    [cursor, chart, delivery]
  );

  const msAtClientX = (clientX: number): number | null => {
    const el = plotRef.current;
    if (!el || durationMs <= 0 || plotW <= 0) return null;
    const rect = el.getBoundingClientRect();
    return clampTo(((clientX - rect.left - LABEL_W) / plotW) * durationMs, 0, durationMs);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const ms = msAtClientX(e.clientX);
    if (ms !== null) moveCursor({ ms, source: "pointer" });
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
    moveCursor({ ms: clampTo(next, 0, durationMs), source: "keyboard" });
  };

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
  // The scroller's own box is only its scrollbar and padding; the plot covers the rest.
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

  return (
    <div
      ref={scrollerRef}
      onWheel={onScrollerWheel}
      onTouchStart={onScrollerTouchStart}
      onTouchMove={onScrollerTouchMove}
      onPointerDown={onScrollerPointerDown}
      onClickCapture={onScrollerClickCapture}
      onKeyDownCapture={onScrollerKeyDownCapture}
      className="overflow-x-auto overscroll-x-contain px-4 pb-3 pt-1">
      <p id={hintId} className="sr-only">
        Pitch, pace and energy, each against your own usual in this session, with the answers marked.
        {seekTo ? " Click anywhere to play from that moment. With the chart focused, the arrow keys move through it and Enter plays." : ""}
      </p>
      <div
        ref={measure}
        role="group"
        aria-roledescription="timeline"
        aria-label={`Delivery over time, ${ariaTime(durationMs)}`}
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
          "relative min-w-[560px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2",
          seekTo ? "cursor-crosshair" : "cursor-default"
        )}
        style={{ height: HEIGHT }}>
        {chart && (
          <>
            <ChartDrawing chart={chart} width={width} />
            {chart.answers.map((band) => (
              <AnswerLabel key={band.turnId} band={band} />
            ))}
            {chart.flags.map((mark) => (
              <FlagMarker key={mark.flag.id} mark={mark} />
            ))}
            <Playhead chart={chart} scrollerRef={scrollerRef} followRef={followRef} />
            {cursor && <CursorLine x={(cursor.ms / Math.max(1, chart.durationMs)) * chart.width} />}
            <Readout chart={chart} delivery={delivery} cursorMs={cursor?.ms ?? null} />
          </>
        )}
        {/* The keyboard cursor's reading, spoken; hover readings are not, they'd be noise. */}
        <p aria-live="polite" className="sr-only">
          {keyboardReading ? readingSentence(keyboardReading) : ""}
        </p>
      </div>
    </div>
  );
};

/** The static drawing: the plot, the answer bands, the three lines and the time axis. Never follows playback. */
const ChartDrawing = memo(function ChartDrawing({ chart, width }: { chart: ChartGeometry; width: number }) {
  const clipId = useId();
  const mid = TOP + PLOT_H / 2;
  const { pitch, pace, energy } = chart;
  return (
    <svg aria-hidden width={width} height={HEIGHT} className="pointer-events-none absolute inset-0 block font-sans">
      <defs>
        <clipPath id={clipId}>
          <rect x={LABEL_W} y={TOP} width={chart.width} height={PLOT_H} rx={8} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={LABEL_W} y={TOP} width={chart.width} height={PLOT_H} fill="#fafaf6" />
        {chart.answers.map((a) => (
          <rect key={a.turnId} x={LABEL_W + a.x0} y={TOP} width={Math.max(2, a.x1 - a.x0)} height={PLOT_H} fill="#f1f1ea" />
        ))}
      </g>
      <line x1={LABEL_W} x2={LABEL_W + chart.width} y1={TOP + PLOT_H * 0.25} y2={TOP + PLOT_H * 0.25} stroke="#deded7" strokeWidth={1} shapeRendering="crispEdges" />
      <line x1={LABEL_W} x2={LABEL_W + chart.width} y1={TOP + PLOT_H * 0.75} y2={TOP + PLOT_H * 0.75} stroke="#deded7" strokeWidth={1} shapeRendering="crispEdges" />
      <line x1={LABEL_W} x2={LABEL_W + chart.width} y1={mid} y2={mid} stroke="#9a9b95" strokeWidth={1} strokeDasharray="4 4" shapeRendering="crispEdges" />
      <line x1={LABEL_W} x2={LABEL_W + chart.width} y1={TOP + PLOT_H} y2={TOP + PLOT_H} stroke="#222325" strokeWidth={1} shapeRendering="crispEdges" />
      <text x={LABEL_W - 6} y={TOP + 14} textAnchor="end" fontSize={10} fill="#5f6062">
        higher
      </text>
      <text x={LABEL_W - 6} y={mid + 3.5} textAnchor="end" fontSize={10} fontWeight={800} fill="#222325">
        usual
      </text>
      <text x={LABEL_W - 6} y={TOP + PLOT_H - 6} textAnchor="end" fontSize={10} fill="#5f6062">
        lower
      </text>

      <g transform={`translate(${LABEL_W} ${TOP})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke={CHART_COLORS.energy}>
          <path d={energy.bridge} strokeWidth={2} strokeDasharray={BRIDGE_DASH} opacity={0.75} />
          <path d={energy.line} strokeWidth={2} />
        </g>
        {energy.dots.map((d, i) => (
          <circle key={`e${i}`} cx={d.x} cy={d.y} r={2} fill={CHART_COLORS.energy} />
        ))}
        <g stroke={CHART_COLORS.pace}>
          {/* An answer's own pace across its spoken span, bracketed at both ends so it reads as one figure for the whole stretch. */}
          {pace.spans.map((s) => (
            <path key={s.turnId} d={`M${s.x0} ${s.y}H${s.x1}M${s.x0} ${s.y - 4}V${s.y + 4}M${s.x1} ${s.y - 4}V${s.y + 4}`} strokeWidth={2} />
          ))}
          <path d={pace.bridge} strokeWidth={2} strokeDasharray={BRIDGE_DASH} opacity={0.75} />
          <path d={pace.line} strokeWidth={2} />
        </g>
        {pace.dots.map((d, i) => (
          <circle key={`p${i}`} cx={d.x} cy={d.y} r={2.5} fill={CHART_COLORS.pace} />
        ))}
        <g stroke={CHART_COLORS.pitch}>
          <path d={pitch.bridge} strokeWidth={2.5} strokeDasharray={BRIDGE_DASH} opacity={0.75} />
          <path d={pitch.line} strokeWidth={2.5} />
        </g>
        {pitch.dots.map((d, i) => (
          <circle key={`s${i}`} cx={d.x} cy={d.y} r={2.25} fill={CHART_COLORS.pitch} />
        ))}
      </g>

      {pitch.empty && energy.empty && pace.empty && (
        <text x={LABEL_W + chart.width / 2} y={TOP + 22} textAnchor="middle" fontSize={11} fill="#5f6062">
          Nothing was measured from your voice in this recording
        </text>
      )}

      {chart.ticks.map((t, i) => (
        <text
          key={t.ms}
          x={LABEL_W + t.x}
          y={AXIS_Y}
          textAnchor={i === 0 ? "start" : t.x > chart.width - 18 ? "end" : "middle"}
          fontSize={10}
          fill="#5f6062"
          className="tabular-nums">
          {formatClock(t.ms)}
        </text>
      ))}
    </svg>
  );
});

// ---------------------------------------------------------------------------
// What can be pressed: the answers and the findings
// ---------------------------------------------------------------------------

const AnswerLabel: FC<{ band: AnswerBand }> = ({ band }) => {
  const seekTo = usePlaybackControls()?.seekTo ?? null;
  const current = usePlaybackTime((ms) => ms >= band.startMs && ms < band.endMs);
  const w = Math.max(2, band.x1 - band.x0);
  const length = formatDuration(band.endMs - band.startMs);
  const text = w >= FULL_LABEL_PX ? `Answer ${band.number} · ${length}` : w >= SHORT_LABEL_PX ? String(band.number) : "";
  const label = `Answer ${band.number}, ${formatClock(band.startMs)} to ${formatClock(band.endMs)}, ${length}`;
  const classes = cn(
    "absolute flex items-center justify-center overflow-hidden whitespace-nowrap rounded text-[10px] font-extrabold tabular-nums",
    current ? "bg-[#e1f073] text-[#222325] ring-1 ring-inset ring-[#222325]" : "bg-[#222325] text-white"
  );
  const style = { left: LABEL_W + band.x0, width: w, top: ROW_Y, height: ROW_H };
  if (!seekTo) {
    return (
      <span role="img" aria-label={label} className={classes} style={style}>
        {text}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Play ${label}`}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        // Playing an answer starts a moment before it, on the end of the question.
        seekTo(band.startMs);
      }}
      className={cn(classes, "cursor-pointer hover:bg-[#44453f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-1", current && "hover:bg-[#d4e35f]")}
      style={style}>
      {text}
    </button>
  );
};

const FlagMarker: FC<{ mark: FlagMark }> = ({ mark }) => {
  const seekTo = usePlaybackControls()?.seekTo ?? null;
  const { flag } = mark;
  const current = usePlaybackTime((ms) => ms >= flag.atMs && ms <= flag.endMs);
  const label = `${FLAG_KIND_META[flag.kind].label} (${SEVERITY_LABELS[flag.severity].toLowerCase()}) at ${formatClock(flag.atMs)}${mark.number !== null ? `, answer ${mark.number}` : ""}: ${formatMeasure(flag.measure)}`;
  const size = flag.severity === 3 ? "h-3 w-3" : flag.severity === 2 ? "h-2.5 w-2.5" : "h-2 w-2";
  const diamond = <span aria-hidden className={cn("rotate-45 border border-white", size, current ? "bg-[#e1f073] ring-1 ring-[#222325]" : "bg-[#222325]")} />;
  const style = { left: LABEL_W + mark.x - 11, top: TOP + PLOT_H - 22 };
  if (!seekTo) {
    return (
      <span role="img" aria-label={label} title={label} className="absolute flex h-[22px] w-[22px] items-center justify-center" style={style}>
        {diamond}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Play: ${label}`}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        seekTo(flag.atMs);
      }}
      className="absolute flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]"
      style={style}>
      {diamond}
    </button>
  );
};

// ---------------------------------------------------------------------------
// The playhead, the crosshair and the readout
// ---------------------------------------------------------------------------

interface PlayheadProps {
  chart: ChartGeometry;
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Cleared when the reader scrolls the chart themselves. */
  followRef: RefObject<boolean>;
}

/** Re-renders only when the playhead crosses a whole pixel. */
const Playhead: FC<PlayheadProps> = ({ chart, scrollerRef, followRef }) => {
  const { width, durationMs } = chart;
  const x = usePlaybackTime((ms) => (ms < 0 || durationMs <= 0 ? -1 : Math.round((Math.min(ms, durationMs) / durationMs) * width)));
  const playing = usePlaybackState()?.playing ?? false;

  // Pressing play means "watch it": follow again, even after scrolling away.
  // Declared before the effect below, so it has run by the time that one does.
  useEffect(() => {
    if (playing) followRef.current = true;
  }, [playing, followRef]);

  // On a narrow screen the chart scrolls; keep the playhead in view while
  // playing, but leave the reader's own scrolling alone while paused, and
  // once they have scrolled by hand.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!playing || !followRef.current || x < 0 || !scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    // The scroller's padding, then the label column, sit before the plot.
    const at = (Number.parseFloat(window.getComputedStyle(scroller).paddingLeft) || 0) + LABEL_W + x;
    const left = scroller.scrollLeft;
    if (at >= left + 16 && at <= left + scroller.clientWidth - 32) return;
    // Near the end the scroller is already as far as it goes; don't ask again every pixel.
    const target = clampTo(at - scroller.clientWidth / 3, 0, scroller.scrollWidth - scroller.clientWidth);
    if (Math.abs(target - left) < 1) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" });
  }, [x, playing, scrollerRef, followRef]);

  if (x < 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 z-10 -ml-px w-0.5 bg-[#222325]"
      style={{ top: TOP - 4, height: PLAYHEAD_H, transform: `translateX(${LABEL_W + x}px)` }}>
      <span className="absolute -left-[4px] -top-[4px] h-2.5 w-2.5 rounded-full border-[1.5px] border-[#222325] bg-[#e1f073]" />
    </div>
  );
};

const CursorLine: FC<{ x: number }> = ({ x }) => (
  <div aria-hidden className="pointer-events-none absolute left-0 z-10 w-px bg-black/40" style={{ top: TOP, height: PLOT_H, transform: `translateX(${LABEL_W + x}px)` }} />
);

/** Readings move every quarter second at most: finer than that, the numbers only flicker. */
const READOUT_STEP_MS = 250;

/**
 * The figures at the moment under the pointer or the keyboard cursor, else
 * at the playhead, beside its line: each measure against usual, and the
 * answer's own figures between answers, where nothing was measured.
 */
const Readout: FC<{ chart: ChartGeometry; delivery: DeliveryReport; cursorMs: number | null }> = ({ chart, delivery, cursorMs }) => {
  const step = usePlaybackTime((ms) => (ms < 0 ? -1 : Math.floor(ms / READOUT_STEP_MS)));
  const ms = cursorMs ?? (step < 0 ? null : step * READOUT_STEP_MS);
  const reading = useMemo(() => (ms === null ? null : readingAt(ms, delivery, chart)), [ms, delivery, chart]);
  if (!reading) return null;
  const x = (clampTo(reading.ms, 0, chart.durationMs) / Math.max(1, chart.durationMs)) * chart.width;
  const flip = x + 12 + READOUT_W > chart.width + RIGHT_PAD;
  const left = LABEL_W + (flip ? Math.max(0, x - 12 - READOUT_W) : x + 12);
  const { figures } = reading;
  const pitch = reading.pitch !== null ? `${formatSigned(reading.pitch)} st` : figures?.pitchRangeSt != null ? `${figures.pitchRangeSt.toFixed(1)} st range` : "Not measured";
  const pace = reading.pace !== null ? `${Math.round(reading.pace)} wpm` : figures?.wpm != null ? `${Math.round(figures.wpm)} wpm` : "Not measured";
  const energy = reading.energy !== null ? `${formatSigned(reading.energy)} dB` : "Not measured";
  const where = reading.answer ? `Answer ${reading.answer.number}` : "Between answers";
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute z-20 flex flex-col gap-1 rounded-lg bg-white/85 px-1.5 py-1 backdrop-blur-[1px]", flip && "items-end text-right")}
      style={{ left, top: TOP + 30, width: READOUT_W }}>
      <span className="text-[10px] font-semibold tabular-nums text-[#5f6062]">
        {formatClock(reading.ms)} · {where}
      </span>
      <ReadoutLine name="Pitch" value={pitch} />
      <ReadoutLine name="Pace" value={pace} />
      <ReadoutLine name="Energy" value={energy} />
    </div>
  );
};

const ReadoutLine: FC<{ name: string; value: string }> = ({ name, value }) => (
  <span className="flex items-baseline gap-1.5 whitespace-nowrap">
    <span className="text-[13px] font-extrabold text-[#222325]">{name}</span>
    <span className="text-[11px] tabular-nums text-[#5f6062]">{value}</span>
  </span>
);

/** The keyboard cursor's reading, as a sentence. */
function readingSentence(r: ChartReading): string {
  const parts = [formatClock(r.ms)];
  parts.push(r.answer ? `answer ${r.answer.number}, ${ariaTime(r.ms - r.answer.startMs)} in` : "between answers");
  if (r.pitch !== null) parts.push(`pitch ${formatSigned(r.pitch)} semitones against your usual`);
  if (r.pace !== null) parts.push(`pace ${Math.round(r.pace)} words a minute${r.paceWhole ? " over the whole answer" : ""}`);
  if (r.energy !== null) parts.push(`energy ${formatSigned(r.energy)} decibels against your usual`);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// The same, per answer, as a table
// ---------------------------------------------------------------------------

const FiguresTable: FC<{ delivery: DeliveryReport; numbers: ReadonlyMap<string, number> }> = ({ delivery, numbers }) => {
  const rows = answerFigures(delivery, numbers, delivery.metrics.wpmMean);
  const dash = <span className="text-black/30">–</span>;
  if (rows.length === 0) return <p className="px-4 pb-4 pt-3 text-sm leading-relaxed text-black/55">No answers were measured in this recording.</p>;
  return (
    <div className="px-4 pb-4 pt-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <caption className="sr-only">Pitch, pace and energy for each answer, against your usual in this session</caption>
          <thead>
            <tr className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-black/45">
              <th scope="col" className="py-2 pr-3 font-bold">Answer</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Pitch</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Pace</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Energy</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Findings</th>
              <th scope="col" className="py-2 font-bold">
                <span className="sr-only">Play</span>
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-[#222325]">
            {rows.map((row) => (
              <tr key={row.turnId} className="border-t border-black/[0.08]">
                <th scope="row" className="py-2 pr-3 font-bold">
                  {row.number} <span className="ml-1 font-normal text-black/50">· {formatDuration(row.endMs - row.startMs)}</span>
                </th>
                <td className="py-2 pr-3 text-right">
                  {row.pitch === null ? dash : `${formatSigned(row.pitch)} st`}
                  {row.pitchRangeSt !== null && <span className="text-black/45"> · {row.pitchRangeSt.toFixed(1)} st range</span>}
                </td>
                <td className="py-2 pr-3 text-right">
                  {row.wpm === null ? dash : `${Math.round(row.wpm)} wpm`}
                  {row.paceVsUsual !== null && <span className="text-black/45"> · {formatSigned(row.paceVsUsual, 0)}</span>}
                </td>
                <td className="py-2 pr-3 text-right">{row.energy === null ? dash : `${formatSigned(row.energy)} dB`}</td>
                <td className="py-2 pr-3 text-right">{row.flags}</td>
                <td className="py-2 text-right">
                  <TimestampChip atMs={row.startMs} endMs={row.endMs} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-black/50">
        Pitch and energy are each answer&apos;s average against your usual in this session; pace is the answer&apos;s own, then how far it was from your average.
      </p>
    </div>
  );
};

export default DeliveryTimeline;
