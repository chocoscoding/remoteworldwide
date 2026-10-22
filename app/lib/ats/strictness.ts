// How hard the ATS score goes on a resume (owner, 2026-10-21), mirrored from the AI service's
// src/config/strictness.ts: the same levels, the same table and the same level in use. Its contract
// test (frontend-types.test.ts) fails if they drift, so a level changed there is changed here too.
//
// The table sets the projection's arithmetic (REQUIREMENT_WEIGHTS in score.ts); the copy below sets
// what the person reads: the score's band labels, its colours, and the nudge beside an AI-added
// number or a picked keyword.

export const STRICTNESS_LEVELS = ["encouraging", "balanced", "strict"] as const;
export type StrictnessLevel = (typeof STRICTNESS_LEVELS)[number];

export interface Strictness {
  partialCredit: number;
  mentionCredit: number;
  titleUnrelated: number;
  parseLossShare: number;
  maxStuffingPenalty: number;
}

export const STRICTNESS: Record<StrictnessLevel, Strictness> = {
  encouraging: { partialCredit: 0.6, mentionCredit: 0.7, titleUnrelated: -1, parseLossShare: 0.5, maxStuffingPenalty: 0 },
  balanced: { partialCredit: 0.45, mentionCredit: 0.5, titleUnrelated: -2, parseLossShare: 0.75, maxStuffingPenalty: 2 },
  strict: { partialCredit: 0.3, mentionCredit: 0.25, titleUnrelated: -3, parseLossShare: 1, maxStuffingPenalty: 4 },
};

/** The level every score uses (owner, 2026-10-21: balanced). */
export const SCORE_STRICTNESS: StrictnessLevel = "balanced";

export const strictness = (): Strictness => STRICTNESS[SCORE_STRICTNESS];

export interface StrictnessCopy {
  /** The band labels, from the top band down (85 and over, 65 and over, under 65). */
  bands: readonly [string, string, string];
  /** Whether a score under 50 shows red. Encouraging shows amber instead. */
  redUnder50: boolean;
  /** Beside a number the AI added to a line. */
  numberNudge: string;
  /** Beside a picked keyword the resume did not show before. */
  termNudge: string;
}

export const STRICTNESS_COPY: Record<StrictnessLevel, StrictnessCopy> = {
  encouraging: {
    bands: ["Strong", "Getting there", "Good start"],
    redUnder50: false,
    numberNudge: "Nice. Be ready to talk about it.",
    termNudge: "Nice. Have a real example ready.",
  },
  balanced: {
    bands: ["Strong match", "Good, not yet great", "Needs work"],
    redUnder50: true,
    numberNudge: "Make sure you can back this up in an interview.",
    termNudge: "Have a real example ready.",
  },
  // Strict keeps balanced's labels: a blank band beside the number read as broken.
  strict: {
    bands: ["Strong match", "Good, not yet great", "Needs work"],
    redUnder50: true,
    numberNudge: "Nothing on your resume shows this yet.",
    termNudge: "Nothing on your resume shows this yet.",
  },
};

export const strictnessCopy = (): StrictnessCopy => STRICTNESS_COPY[SCORE_STRICTNESS];
