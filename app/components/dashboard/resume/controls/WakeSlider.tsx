"use client";

// WakeSlider, from React Bits (owner, 2026-10-17), ported to TypeScript and adapted:
//
// - The bar at the value stands taller at rest (`markHeight`), so the value reads by position
//   and by height even when nothing moves (owner, 2026-10-17). It glides with the handle.
// - `onCommit` fires once a drag ends or a key steps the value, so a parent can keep one undo
//   step per drag (see StepperSlider); `onChange` fires on every change along the way.
//
// Bars rise in a wake around the handle as it moves, wider behind it than ahead.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  frame,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useVelocity,
} from "motion/react";
import { cn } from "@/lib/utils";
import "./WakeSlider.css";

const SETTLE = 9.23;
const FULL_SPEED = 320;
const MIN_REACH = 1.5;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const smoothstep = (s: number) => s * s * (3 - 2 * s);
const toPct = (v: number, min: number, max: number) =>
  max > min ? ((v - min) / (max - min)) * 100 : 0;
const snap = (v: number, min: number, max: number, step: number) => {
  if (!(max > min)) return min;
  if (!(step > 0)) return clamp(v, min, max);
  const lastWhole = min + Math.floor(+((max - min) / step).toFixed(6)) * step;
  const grid = clamp(Math.round((v - min) / step) * step + min, min, lastWhole);
  return +(
    lastWhole < max && Math.abs(v - max) <= Math.abs(v - grid) ? max : grid
  ).toFixed(6);
};

export interface WakeSliderProps {
  value?: number;
  defaultValue?: number;
  /** Every change, from the pointer (each notch of a drag) or the keyboard. */
  onChange?: (value: number) => void;
  /** Once per gesture: the drag let go, or a key stepped the value. */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  bars?: number;
  /** Full bar height in px, the ceiling of the wake. */
  height?: number;
  /** Bar height at rest in px. */
  restHeight?: number;
  /** The value's own bar at rest in px. */
  markHeight?: number;
  gap?: number;
  fillColor?: string;
  trackColor?: string;
  markColor?: string;
  crestColor?: string;
  sensitivity?: number;
  reach?: number;
  skew?: number;
  glide?: number;
  smoothing?: number;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const WakeSlider: FC<WakeSliderProps> = ({
  value: valueProp,
  defaultValue = 50,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  bars = 32,
  height = 34,
  restHeight = 13,
  markHeight = 22,
  gap = 3,
  fillColor = "#222325",
  trackColor = "#e4e4dd",
  markColor = "#222325",
  crestColor = "",
  sensitivity = 1,
  reach = 4.5,
  skew = 0.4,
  glide = 0.12,
  smoothing = 90,
  showValue = false,
  formatValue,
  disabled = false,
  ariaLabel = "Value",
  className,
}) => {
  const [inner, setInner] = useState(defaultValue);
  const value = clamp(valueProp ?? inner, min, max);
  const pct = toPct(value, min, max);
  const reduce = useReducedMotion();
  const format = formatValue ?? String;
  const rest = Math.min(restHeight, height - 1) / height;
  const mark = Math.min(markHeight, height) / height;

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const barEls = useRef<(HTMLSpanElement | null)[]>([]);
  const crestEls = useRef<(HTMLSpanElement | null)[]>([]);
  const pointerId = useRef<number | null>(null);
  const latest = useRef(value);
  // Mid-drag the pointer leads; the prop catches up once the parent renders.
  if (pointerId.current === null) latest.current = value;

  const target = useMotionValue(pct);
  const w0 = SETTLE / glide;
  const head = useSpring(target, {
    stiffness: w0 * w0,
    damping: 2 * w0,
    mass: 1,
  });
  const rawSpeed = useVelocity(head);
  const wv = 2000 / smoothing;
  const speed = useSpring(rawSpeed, {
    stiffness: wv * wv,
    damping: 2.5 * wv,
    mass: 1,
  });

  useEffect(() => {
    if (pointerId.current === null) target.set(pct);
  }, [pct, target]);

  const paint = () => {
    const h = ((reduce ? target.get() : head.get()) / 100) * (bars - 1);
    const v = reduce ? 0 : speed.get();
    const amp = smoothstep(
      clamp((Math.abs(v) * sensitivity) / FULL_SPEED, 0, 1),
    );
    const dir = Math.sign(v) || 1;
    const r = MIN_REACH + (reach - MIN_REACH) * amp;
    const behind = r * (1 + skew);
    const ahead = r * (1 - 0.5 * skew);
    const lit = Math.round(h);
    for (let i = 0; i < bars; i++) {
      const el = barEls.current[i];
      if (!el) continue;
      const on = i <= lit ? "true" : "false";
      if (el.dataset.on !== on) el.dataset.on = on;
      const isMark = i === lit ? "true" : "false";
      if (el.dataset.mark !== isMark) el.dataset.mark = isMark;
      const d = i - h;
      const R = d * dir < 0 ? behind : ahead;
      const lift =
        Math.abs(d) < R ? amp * Math.cos((Math.PI * d) / (2 * R)) ** 2 : 0;
      const scale = rest + lift * (1 - rest);
      el.style.transform = `scaleY(${i === lit ? Math.max(mark, scale) : scale})`;
      const crest = crestEls.current[i];
      if (crest) crest.style.opacity = String(lift);
    }
  };
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const run = useCallback(() => paintRef.current(), []);
  const schedule = useCallback(() => frame.render(run, false, true), [run]);
  useMotionValueEvent(head, "change", schedule);
  useMotionValueEvent(speed, "change", schedule);
  useLayoutEffect(() => {
    paintRef.current();
  });

  const commit = (next: number) => {
    const clean = snap(next, min, max, step);
    if (clean === latest.current) return;
    latest.current = clean;
    // The bars follow the pointer straight away, without waiting for the parent to render the
    // new value (it re-renders the whole resume, which can trail a fast drag).
    target.set(toPct(clean, min, max));
    if (valueProp === undefined) setInner(clean);
    onChange?.(clean);
  };
  const commitFromX = (x: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    let ratio = clamp((x - rect.left) / rect.width, 0, 1);
    if (getComputedStyle(track).direction === "rtl") ratio = 1 - ratio;
    commit(min + ratio * (max - min));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || pointerId.current !== null) return;
    pointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety; the drag still works inside the track.
    }
    rootRef.current?.removeAttribute("data-instant");
    handleRef.current?.focus({ preventScroll: true });
    commitFromX(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === pointerId.current) commitFromX(e.clientX);
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    pointerId.current = null;
    onCommit?.(latest.current);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const jumps: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + step * 10,
      PageDown: value - step * 10,
      Home: min,
      End: max,
    };
    if (!(e.key in jumps)) return;
    e.preventDefault();
    const clean = snap(jumps[e.key], min, max, step);
    const p = toPct(clean, min, max);
    rootRef.current?.setAttribute("data-instant", "true");
    head.jump(p);
    speed.jump(0);
    target.jump(p);
    commit(clean);
    onCommit?.(clean);
  };

  const barNodes = useMemo(() => {
    barEls.current.length = bars;
    crestEls.current.length = bars;
    return Array.from({ length: bars }, (_, i) => (
      <span
        key={i}
        ref={(el) => {
          barEls.current[i] = el;
        }}
        className="wake-slider__bar"
      >
        {crestColor ? (
          <span
            ref={(el) => {
              crestEls.current[i] = el;
            }}
            className="wake-slider__crest"
          />
        ) : null}
      </span>
    ));
  }, [bars, crestColor]);

  return (
    <div
      ref={rootRef}
      className={cn("wake-slider", className)}
      aria-disabled={disabled || undefined}
      style={
        {
          "--ws-fill": fillColor,
          "--ws-track": trackColor,
          "--ws-mark-color": markColor,
          "--ws-crest": crestColor || fillColor,
          "--ws-height": `${height}px`,
          "--ws-gap": `${gap}px`,
          "--ws-rest": rest,
        } as CSSProperties
      }
    >
      <div
        ref={trackRef}
        className="wake-slider__track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        {barNodes}
        <button
          ref={handleRef}
          type="button"
          role="slider"
          className="wake-slider__handle"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={format(value)}
          aria-disabled={disabled || undefined}
          onKeyDown={onKeyDown}
        />
      </div>
      {showValue ? (
        <span className="wake-slider__value" aria-hidden="true">
          {format(value)}
        </span>
      ) : null}
    </div>
  );
};

export default WakeSlider;
