"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Custom-colour picker: a Radix popover holding a native `<input type="color">`
 * and a validated hex field.
 *
 * ## Why the debounce lives here
 *
 * Undo granularity in this feature is commit-based — one history entry per
 * gesture. The slider gets that for free from Radix's `onValueCommit`, but a
 * colour wheel and a text field have no equivalent "settled" event: dragging
 * the OS picker streams dozens of values and typing `#2f5d50` fires seven
 * times. So this component debounces internally and emits exactly one
 * committed `onChange` when the value stops moving:
 *
 * - every intermediate value → `onPreview?.(hex)` immediately (transient)
 * - once settled (or on Enter / blur / popover close) → `onChange(hex)` once
 *
 * The debounce is a `setTimeout` ref whose callback fires the commit; nothing
 * is ever set from an effect body (`react-hooks/set-state-in-effect` is an
 * error for new files). The only effect here registers a cleanup.
 *
 * Presentational and fully prop-driven: no design types, no context.
 */

const HEX_PATTERN = /^([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Accepts `#rgb` / `rgb` / `#rrggbb` / `rrggbb` (any case), expands the short
 * form, and returns a lowercased `#rrggbb`. Returns `null` for anything else —
 * garbage never reaches the caller.
 */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (!HEX_PATTERN.test(raw)) return null;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => `${c}${c}`)
          .join("")
      : raw;
  return `#${full.toLowerCase()}`;
}

/** Static because arbitrary Tailwind values must be literals in source. */
const RAINBOW_CLASS =
  "bg-[image:conic-gradient(from_180deg,#ff0000,#ffa500,#ffff00,#00c853,#00bcd4,#3f51b5,#9c27b0,#ff0000)]";

const COLOR_INPUT_CLASS =
  "h-10 w-full cursor-pointer rounded-xl border border-black/10 bg-white p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-0";

export interface ColorWheelPopoverProps {
  /** Current colour as `#rrggbb`. Seeds the fields each time the popover opens. */
  value: string;
  /** Committed change — debounced to one call per settled gesture. Push history here. */
  onChange: (hex: string) => void;
  /** Live/transient change — fires on every valid intermediate value. */
  onPreview?: (hex: string) => void;
  /** Heading inside the popover. Defaults to `"Custom colour"`. */
  label?: string;
  /** Debounce window in ms before `onChange` fires. Defaults to `250`. */
  debounceMs?: number;
  /** Draws the selected ring on the default trigger chip. */
  selected?: boolean;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  /** Replaces the default rainbow chip trigger. Rendered via `asChild`. */
  children?: ReactNode;
  /** Applied to the default trigger chip (ignored when `children` is given). */
  triggerClassName?: string;
  className?: string;
}

export default function ColorWheelPopover({
  value,
  onChange,
  onPreview,
  label = "Custom colour",
  debounceMs = 250,
  selected = false,
  disabled = false,
  align = "start",
  side = "bottom",
  children,
  triggerClassName,
  className,
}: ColorWheelPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalizeHex(value) ?? value);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);
  // Keeps the deferred commit pointed at the newest callback without ever
  // writing a ref during render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Effect body only registers a cleanup — no state is set here.
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    []
  );

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /** Queue a single committed change once the value stops moving. */
  const schedule = (hex: string) => {
    clearTimer();
    pendingRef.current = hex;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const hexToCommit = pendingRef.current;
      pendingRef.current = null;
      if (hexToCommit !== null) onChangeRef.current(hexToCommit);
    }, debounceMs);
  };

  /** Commit immediately, cancelling any queued commit. */
  const commitNow = (hex: string) => {
    clearTimer();
    pendingRef.current = null;
    onChangeRef.current(hex);
  };

  /** Fire whatever the debounce still owes, if anything. */
  const flushPending = () => {
    const hexToCommit = pendingRef.current;
    clearTimer();
    pendingRef.current = null;
    if (hexToCommit !== null) onChangeRef.current(hexToCommit);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(normalizeHex(value) ?? value);
    } else {
      flushPending();
    }
    setOpen(next);
  };

  const handleWheelChange = (raw: string) => {
    const hex = normalizeHex(raw);
    setDraft(hex ?? raw);
    if (!hex) return;
    onPreview?.(hex);
    schedule(hex);
  };

  const handleTextChange = (raw: string) => {
    setDraft(raw);
    const hex = normalizeHex(raw);
    if (!hex) return;
    onPreview?.(hex);
    schedule(hex);
  };

  const handleTextBlur = () => {
    const hex = normalizeHex(draft);
    if (hex) {
      setDraft(hex);
      commitNow(hex);
    } else {
      // Garbage never commits — snap the field back to the live value.
      setDraft(normalizeHex(value) ?? value);
    }
  };

  const normalizedDraft = normalizeHex(draft);
  const isValid = normalizedDraft !== null;
  const wheelValue = normalizedDraft ?? normalizeHex(value) ?? "#000000";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {children ?? (
          <button
            type="button"
            aria-label={label}
            className={cn(
              "relative grid h-7 w-7 flex-none place-content-center rounded-full transition-shadow cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
              RAINBOW_CLASS,
              selected ? "ring-2 ring-black/70 ring-offset-2" : "ring-1 ring-black/10 hover:ring-black/25",
              triggerClassName
            )}>
            <span className="grid h-4 w-4 place-content-center rounded-full bg-white">
              <Plus className="h-2.5 w-2.5 text-[#222325]" strokeWidth={3} />
            </span>
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align={align}
        side={side}
        className={cn("w-60 rounded-2xl border-black/10 bg-white p-3 shadow-lg", className)}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-black/40">{label}</p>

        <input
          type="color"
          aria-label={`${label} wheel`}
          value={wheelValue}
          onChange={(e) => handleWheelChange(e.target.value)}
          className={COLOR_INPUT_CLASS}
        />

        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-semibold text-black/45">Hex</span>
          <input
            type="text"
            inputMode="text"
            spellCheck={false}
            autoComplete="off"
            maxLength={7}
            value={draft}
            placeholder="#222325"
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={handleTextBlur}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const hex = normalizeHex(draft);
              if (!hex) return;
              setDraft(hex);
              commitNow(hex);
            }}
            className={cn(
              "w-full rounded-lg border bg-white px-2.5 py-1.5 font-mono text-xs text-primary outline-none transition-colors",
              isValid ? "border-black/12 focus:border-black/35" : "border-[#b3261e] focus:border-[#b3261e]"
            )}
          />
        </label>

        <p className={cn("mt-1.5 text-[10.5px]", isValid ? "text-black/40" : "text-[#b3261e]")}>
          {isValid ? "Accepts #rgb or #rrggbb." : "Enter a hex colour like #2f5d50."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
