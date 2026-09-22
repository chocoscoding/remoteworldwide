// What is left of the ATS scoring seam — no scoring.
//
// THE REAL SCORER HAS LANDED EVERYWHERE A SCORE IS SHOWN. `/dashboard/ats`
// calls `app/lib/ats/api.ts`, which streams a real scan from the AI service —
// requirements read out of the posting, evidence retrieved from the resume's
// own bullets, a weighted score and a grounded write-up. The resume editor's
// ATS card runs the same scan on the document on screen
// (`hooks/mutations/useCheckResume.ts`) and shows nothing until one has run.
//
// The last estimate is gone too. Logging an application used to stamp a
// keyword-overlap guess (against mock keywords) on the application, which the
// payoff panel then banded and presented as the match. The payoff now reads
// the latest scan the user already ran against that posting
// (`POST /api/ai/scan/lookup`, free) and says "not scanned yet" when there is
// none — so `scoreApplication` has been retired rather than left to be reached
// for again.
//
// What remains is not an estimate:
//  - `ApplicationScore` is the shape a score summary takes. The AI service's
//    `ScanResult` extends its mirror of it, and its contract test reads this
//    file to hold the two field-for-field.
//  - `scoreTier` is the banding the whole dashboard shares, mirrored by
//    `scanTier` in `app/lib/ats/api.ts` and by `ScoringService.scoreTier` in
//    the AI service, with a contract test over all three. `fit.ts` bands with it.
//  - `hash01`, which `fit.ts` borrows for its deterministic spread.

import type { AtsKeyword, AtsMetric } from "./types";

export interface ApplicationScore {
  /** 0-100 overall match. */
  score: number;
  metrics: AtsMetric[];
  /** Missing keywords, highest impact first. The panel shows the top 3. */
  gaps: AtsKeyword[];
}

/** Deterministic 0-1 from a string, so the same input always lands in the same place. */
export function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const x = Math.sin(h) * 43758.5453;
  return x - Math.floor(x);
}

/** Matches the ATS screen's own banding, so every surface agrees about the same number. */
export function scoreTier(score: number): { label: string; tone: "positive" | "neutral" | "urgent" } {
  if (score >= 85) return { label: "Strong match", tone: "positive" };
  if (score >= 65) return { label: "Good, not yet great", tone: "neutral" };
  return { label: "Needs work", tone: "urgent" };
}
