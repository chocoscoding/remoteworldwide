// ATS scoring seam — for the screens that are not the ATS screen.
//
// THE REAL SCORER HAS LANDED. `/dashboard/ats` no longer comes anywhere near
// this file: it calls `app/lib/ats/api.ts`, which streams a real scan from the
// AI service — requirements read out of the posting, evidence retrieved from
// the resume's own bullets, a weighted score and a grounded write-up.
//
// What is left here is the estimate the OTHER surfaces still run on, where a
// number is wanted but a charged scan is not: the resume card's general score,
// the payoff panel's banding, `fit.ts`. A real scan costs a credit, so a
// screen that wants a figure for every resume it lists cannot have one, and
// these callers each need their own decision about that — either to show
// nothing until scanned, the way the ATS screen now does, or to read a stored
// score once one is persisted. Until then they keep the keyword overlap below,
// which at least reacts to what the user actually pasted.
//
// `scoreTier` is the exception and is NOT an estimate: it is the banding the
// whole dashboard shares, mirrored by `scanTier` in `app/lib/ats/api.ts` and
// by `ScoringService.scoreTier` in the AI service, with a contract test over
// all three.

import { ATS_KEYWORDS, ATS_METRICS } from "./mock-data";
import type { AtsKeyword, AtsMetric } from "./types";

export interface ApplicationScore {
  /** 0-100 overall match. */
  score: number;
  metrics: AtsMetric[];
  /** Missing keywords, highest impact first. The panel shows the top 3. */
  gaps: AtsKeyword[];
}

/** Deterministic 0-1 from a string, so the same JD always scores the same. */
export function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const x = Math.sin(h) * 43758.5453;
  return x - Math.floor(x);
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

/**
 * Scores a resume against a job description.
 *
 * `resumeId` is accepted and folded into the result so different saved resumes
 * score differently — it is not yet used to read real resume content, because
 * the resume documents live in screen-local state with no cross-screen access.
 */
export function scoreApplication(resumeId: string, jdText: string | undefined): ApplicationScore {
  const jd = (jdText ?? "").trim();

  // No JD to score against — report the resume's standing general score rather
  // than inventing a match number.
  if (!jd) {
    const base = 70 + Math.round(hash01(resumeId) * 12);
    return {
      score: base,
      metrics: ATS_METRICS,
      gaps: ATS_KEYWORDS.filter((k) => !k.present).slice(0, 3),
    };
  }

  const jdTokens = tokens(jd);
  const present: AtsKeyword[] = [];
  const missing: AtsKeyword[] = [];

  for (const kw of ATS_KEYWORDS) {
    const kwTokens = tokens(kw.label);
    const hit = [...kwTokens].some((t) => jdTokens.has(t));
    (hit ? present : missing).push({ ...kw, present: hit });
  }

  const coverage = ATS_KEYWORDS.length > 0 ? present.length / ATS_KEYWORDS.length : 0;
  // Resume identity nudges the result a few points either way so switching
  // resumes visibly changes the number.
  const nudge = Math.round(hash01(resumeId) * 8) - 4;
  const score = Math.max(0, Math.min(100, Math.round(45 + coverage * 50) + nudge));

  const metrics: AtsMetric[] = ATS_METRICS.map((m) =>
    m.id === "keyword-match"
      ? { ...m, value: Math.round(coverage * 100) }
      : m
  );

  return { score, metrics, gaps: missing.slice(0, 3) };
}

/** Matches the ATS screen's own banding, so the two surfaces agree. */
export function scoreTier(score: number): { label: string; tone: "positive" | "neutral" | "urgent" } {
  if (score >= 85) return { label: "Strong match", tone: "positive" };
  if (score >= 65) return { label: "Good, not yet great", tone: "neutral" };
  return { label: "Needs work", tone: "urgent" };
}
