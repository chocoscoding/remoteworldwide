"use client";

import { type FC } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

/**
 * Discrete stepped slider — the workhorse of the Font Size and Spacing
 * customize panels ("Base Font Size … 11pt", "Full Name … +8pt",
 * "Left & Right Margin … 14mm").
 *
 * The Radix slider runs in INDEX space (`0 … steps.length - 1`, step 1) and
 * the index is mapped back through `steps` before it reaches the caller, so
 * only allowed values are ever emitted — no rounding drift on fractional
 * step tables like `[8, 8.5, 9, …]`.
 *
 * ## Why the two callbacks matter
 *
 * Radix's `Slider` exposes both `onValueChange` (fires on every pixel of a
 * drag) and `onValueCommit` (fires once, on pointer-up / key-up). Undo
 * granularity in this feature is *commit-based, not time-debounced*, so this
 * component surfaces the distinction rather than flattening it:
 *
 * - drag in progress  → `onChange(value, { transient: true })`
 * - drag settled      → `onChange(value, { transient: false })` then `onCommit?.(value)`
 * - −/+ button press  → `onChange(value, { transient: false })` then `onCommit?.(value)`
 *
 * A parent that pipes `transient` straight into its reducer gets exactly one
 * history entry per drag, by construction — no timers, no `Date.now()`.
 *
 * `onChange` is always the single source of truth for *applying* the value;
 * `onCommit` is a pure notification for parents that want a separate hook
 * (analytics, an explicit history push). Never apply the value in `onCommit`
 * alone — parents that ignore it must still work.
 *
 * Presentational and fully prop-driven: no design types, no context.
 */

/** Options passed alongside every value emitted by {@link StepperSlider}. */
export interface StepperSliderChangeOptions {
  /** `true` while a drag is in flight (replace state, do not push history). */
  transient?: boolean;
}

export interface StepperSliderProps {
  /** Left-hand label, e.g. `"Base Font Size"`. */
  label: string;
  /** Allowed values, ascending. The slider can only ever emit one of these. */
  steps: number[];
  /** Current value. Snapped to the nearest entry in `steps` for display. */
  value: number;
  /** Called for every change. `opts.transient` is `true` mid-drag only. */
  onChange: (value: number, opts?: StepperSliderChangeOptions) => void;
  /** Optional extra notification fired *after* every non-transient change. */
  onCommit?: (value: number) => void;
  /** Renders the right-hand readout. Defaults to the raw number. */
  format?: (value: number) => string;
  /** Optional muted helper line under the label row. */
  description?: string;
  disabled?: boolean;
  /** Draw the tick marks under the track. Defaults to `true`. */
  showTicks?: boolean;
  className?: string;
}

const STEP_BUTTON_CLASS =
  "grid h-7 w-7 flex-none place-content-center rounded-lg border border-black/12 bg-white text-primary transition-colors cursor-pointer hover:border-black/25 hover:bg-[#f9f9f6] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-black/12 disabled:hover:bg-white";

/** Index of the entry in `steps` closest to `value`. `-1` for an empty table. */
function nearestIndex(steps: number[], value: number): number {
  if (steps.length === 0) return -1;
  let best = 0;
  let bestDelta = Math.abs(steps[0] - value);
  for (let i = 1; i < steps.length; i += 1) {
    const delta = Math.abs(steps[i] - value);
    if (delta < bestDelta) {
      best = i;
      bestDelta = delta;
    }
  }
  return best;
}

const StepperSlider: FC<StepperSliderProps> = ({
  label,
  steps,
  value,
  onChange,
  onCommit,
  format,
  description,
  disabled = false,
  showTicks = true,
  className,
}) => {
  const count = steps.length;
  const index = nearestIndex(steps, value);
  const safeIndex = index < 0 ? 0 : index;
  const inert = disabled || count < 2;

  const emitTransient = (nextIndex: number) => {
    const next = steps[nextIndex];
    if (next === undefined) return;
    onChange(next, { transient: true });
  };

  const emitCommit = (nextIndex: number) => {
    const next = steps[nextIndex];
    if (next === undefined) return;
    onChange(next, { transient: false });
    onCommit?.(next);
  };

  const step = (delta: number) => {
    const nextIndex = Math.min(Math.max(safeIndex + delta, 0), Math.max(count - 1, 0));
    if (nextIndex === safeIndex) return;
    emitCommit(nextIndex);
  };

  const readout = format ? format(value) : String(value);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-black/55">{label}</span>
        <span className="text-xs font-bold tabular-nums text-primary">{readout}</span>
      </div>

      {description && <p className="-mt-1 text-[11px] text-black/45">{description}</p>}

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={inert || safeIndex <= 0}
          aria-label={`Decrease ${label}`}
          className={STEP_BUTTON_CLASS}>
          <Minus className="h-3.5 w-3.5" />
        </button>

        <div className="relative min-w-0 flex-1">
          <Slider
            value={[safeIndex]}
            min={0}
            max={Math.max(count - 1, 0)}
            step={1}
            disabled={inert}
            aria-label={label}
            onValueChange={(next) => emitTransient(next[0])}
            onValueCommit={(next) => emitCommit(next[0])}
            className={cn("relative z-10", inert && "pointer-events-none opacity-45")}
          />
          {showTicks && count > 1 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-between">
              {steps.map((tickValue, i) => (
                <span key={`${tickValue}-${i}`} className="h-2.5 w-px flex-none rounded-full bg-black/20" />
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={inert || safeIndex >= count - 1}
          aria-label={`Increase ${label}`}
          className={STEP_BUTTON_CLASS}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default StepperSlider;
