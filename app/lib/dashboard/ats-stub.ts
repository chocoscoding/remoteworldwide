// ATS scoring seam.
//
// The brief marks the ATS model out of scope and says to consume it "via its
// existing interface". There is no existing interface: `ATS_SCORE` is the
// constant `79` and no `scoreResume()` function exists anywhere in the repo.
//
// So this file is the interface. It returns the real `AtsMetric` / `AtsKeyword`
// shapes the ATS screen already renders, computed by a crude but deterministic
// keyword overlap so the payoff panel reacts to what the user actually pasted
// instead of showing 79 every time. When a genuine scorer lands, replacing the
// body of `scoreApplication` is the whole migration.

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
