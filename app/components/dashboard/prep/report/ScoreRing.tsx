import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { ScoreDisplay } from "@/app/lib/voice/mapSession";
import { BAND_COLOR, overallBand } from "./reportScales";

/**
 * The report header's score: a donut around the 0-100 number, its arc
 * coloured by band (red under 50, amber to 74, lime-green from 75).
 *
 * How the score reads is mapSession's `scoreDisplayOf`, the hub's answer
 * too: a provisional score shows its number and says "provisional" to a
 * screen reader (the line beside it says why); a report with no score shows
 * an empty ring and "n/a", never a 0 that would read as a result.
 */
export interface ScoreRingProps {
  display: ScoreDisplay;
  className?: string;
}

/** Drawn in a 68-unit box: radius 29 with a 7-unit stroke leaves a 1.5-unit margin for the round caps. */
const R = 29;
const CIRCUMFERENCE = 2 * Math.PI * R;

const ScoreRing: FC<ScoreRingProps> = ({ display, className }) => {
  const score = display.kind === "unscored" ? null : Math.max(0, Math.min(100, Math.round(display.score)));
  const label =
    score === null
      ? "No overall score"
      : display.kind === "provisional"
        ? `Score ${score} out of 100, provisional`
        : `Score ${score} out of 100`;
  const arc = score === null ? 0 : (score / 100) * CIRCUMFERENCE;

  return (
    <span role="img" aria-label={label} className={cn("relative h-16 w-16 flex-none", className)}>
      <svg aria-hidden width={64} height={64} viewBox="0 0 68 68" fill="none" className="block">
        <circle cx={34} cy={34} r={R} stroke="#e4e4dd" strokeWidth={7} />
        {score !== null && score > 0 && (
          <circle
            cx={34}
            cy={34}
            r={R}
            stroke={BAND_COLOR[overallBand(score)]}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${arc.toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
            transform="rotate(-90 34 34)"
          />
        )}
      </svg>
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        {score === null ? (
          <span className="text-[15px] font-bold text-black/40">n/a</span>
        ) : (
          <span className="text-[20px] font-extrabold tabular-nums text-[#222325]">{score}</span>
        )}
      </span>
    </span>
  );
};

export default ScoreRing;
