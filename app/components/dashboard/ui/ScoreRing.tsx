import { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Circular score indicator — a conic-gradient ring with an inset circle
 * showing the number. Extracted from the one-off version in
 * `app/(pages)/(dashboard)/dashboard/ats/Client.tsx` (left untouched) once
 * Interview Prep needed the same shape in three places.
 *
 * Everything here is sized off the INNER circle rather than the outer
 * diameter, because the number has to fit the hole, not the ring. The first
 * version scaled type from the outer size with ratios tuned at 164px; at the
 * 56-72px call sites that put the caption at 4px and the number at 13px —
 * a ring you couldn't read.
 *
 * Uses an inline `style` for the gradient rather than a literal Tailwind
 * class, matching the ATS screen's own precedent — a conic-gradient needs a
 * continuous 0-100 value, which a closed literal-class union can't express.
 */
export interface ScoreRingProps {
  /** 0-100 */
  value: number;
  /** Diameter in px. Defaults to 164 (the ATS screen's size). */
  size?: number;
  /** Replaces the default "big number + out of 100" label. */
  label?: ReactNode;
  /** `dark` renders the inset circle in ink instead of white, for use on dark cards. */
  tone?: "light" | "dark";
  /**
   * Overrides the unfilled part of the ring. The default `#f0f0ea` sits close
   * enough to the lime arc that on a small ring a 60 and a 95 read the same
   * from a distance; call sites that show many rings side by side pass
   * something darker so the arc has an edge to be seen against.
   */
  trackColor?: string;
  className?: string;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Slim by design — the ring is the frame, the number is the content. */
const STROKE_RATIO = 0.055;
const MIN_STROKE = 4;
const MAX_STROKE = 10;

/**
 * Below this diameter the "out of 100" caption can't render above ~10px, so
 * it's dropped and the number takes the whole hole. A ring already reads as
 * "out of 100" without being told.
 */
const CAPTION_MIN_SIZE = 140;

const ScoreRing: FC<ScoreRingProps> = ({ value, size = 164, label, tone = "light", trackColor, className }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const track = trackColor ?? (tone === "dark" ? "rgba(255,255,255,.14)" : "#f0f0ea");

  const stroke = Math.round(clamp(size * STROKE_RATIO, MIN_STROKE, MAX_STROKE));
  const inner = size - stroke * 2;
  const withCaption = size >= CAPTION_MIN_SIZE;

  // Three digits have to fit the hole, so the number is a share of the inner
  // circle — generous when it's alone, tighter when a caption sits under it.
  const numberSize = Math.round(inner * (withCaption ? 0.26 : 0.44));

  return (
    <div
      className={cn("relative flex-none rounded-full", className)}
      style={{ height: size, width: size, background: `conic-gradient(#e1f073 0% ${pct}%, ${track} ${pct}% 100%)` }}>
      <div
        className={cn("absolute rounded-full flex flex-col items-center justify-center", tone === "dark" ? "bg-[#222325]" : "bg-white")}
        style={{ inset: stroke }}>
        {label ?? (
          <>
            <span
              className={cn("font-bold leading-none tabular-nums", tone === "dark" ? "text-white" : "text-primary")}
              style={{ fontSize: numberSize }}>
              {pct}
            </span>
            {withCaption && (
              <span
                className={cn("font-medium mt-1.5", tone === "dark" ? "text-white/45" : "text-black/45")}
                style={{ fontSize: Math.round(inner * 0.075) }}>
                out of 100
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ScoreRing;
