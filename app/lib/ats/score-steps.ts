// The ATS report's score colours (owner, 2026-10-18): four steps, red to amber to yellow to a real
// green, on the ring and on every metric bar. Red and amber are the interview prep report's bands
// (`prep/report/reportScales.ts`), the green is its "went well" green (`prep/Chip.tsx`), never the
// theme lime. The steps break where `scanTier` does (65 and 85), with red under 50.

export interface ScoreStep {
  /** Scores under this take the step. */
  below: number;
  color: string;
  /** The same colour as a literal class, so Tailwind's scan keeps it (ProgressBar's `fillClassName`). */
  fill: string;
}

export const SCORE_STEPS: readonly ScoreStep[] = [
  { below: 50, color: "#e02d2d", fill: "bg-[#e02d2d]" },
  { below: 65, color: "#d99a00", fill: "bg-[#d99a00]" },
  { below: 85, color: "#e6c229", fill: "bg-[#e6c229]" },
  { below: Infinity, color: "#3fa66a", fill: "bg-[#3fa66a]" },
];

export function scoreStep(score: number): ScoreStep {
  const value = Number.isFinite(score) ? score : 0;
  return SCORE_STEPS.find((step) => value < step.below) ?? SCORE_STEPS[SCORE_STEPS.length - 1];
}

/** The step's colour, faint: the ring's unfilled part, so the whole ring reads red, amber, yellow or green. */
export function scoreStepTrack(score: number): string {
  return `${scoreStep(score).color}26`;
}
