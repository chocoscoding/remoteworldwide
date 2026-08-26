import { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Circular score indicator — a conic-gradient ring with an inset circle
 * showing the number. Extracted from the one-off version in
 * `app/(pages)/(dashboard)/dashboard/ats/Client.tsx` (left untouched) once
 * Interview Prep needed the same shape in three places.
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
  className?: string;
}

const ScoreRing: FC<ScoreRingProps> = ({ value, size = 164, label, tone = "light", className }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const inset = Math.round(size * 0.073); // matches the ATS ring's 12px-at-164px ratio

  return (
    <div
      className={cn("relative flex-none rounded-full", className)}
      style={{ height: size, width: size, background: `conic-gradient(#e1f073 0% ${pct}%, ${tone === "dark" ? "rgba(255,255,255,.14)" : "#f0f0ea"} ${pct}% 100%)` }}>
      <div
        className={cn("absolute rounded-full flex flex-col items-center justify-center", tone === "dark" ? "bg-[#222325]" : "bg-white")}
        style={{ inset }}>
        {label ?? (
          <>
            <span className={cn("font-bold leading-none", tone === "dark" ? "text-white" : "text-primary")} style={{ fontSize: size * 0.23 }}>
              {pct}
            </span>
            <span className={cn("font-medium mt-1", tone === "dark" ? "text-white/45" : "text-black/40")} style={{ fontSize: size * 0.067 }}>
              out of 100
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default ScoreRing;
