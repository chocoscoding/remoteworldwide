// Recommendation fit — computed, never stored.
//
// The cards used to carry literal percentages (Supabase 88, Raycast 64) while
// Settings → Preferences claimed it "drives your recommendations". This module
// makes that claim true: fit is a function of what you told us you want, so
// changing a preference moves every score on the screen.
//
// Pure and deterministic — safe to call during render. A real matching service
// replaces the body of `computeFit` and nothing else.

import { hash01, scoreTier } from "./ats-stub";
import type { RecommendationTarget } from "./types";

export interface FitPrefs {
  targetRoles: string[];
  minSalary: number;
  remotePolicy: "anywhere" | "overlap" | "region";
}

export interface FitProfile {
  skills: string[];
  /** "GMT+1" */
  timezone: string;
}

export type FitFactorId = "role" | "salary" | "skills" | "timezone";

export interface FitFactor {
  id: FitFactorId;
  label: string;
  /** 0-100 for this factor alone. */
  score: number;
  /** Drives the check vs. neutral glyph. */
  met: boolean;
  detail: string;
}

export interface FitResult {
  score: number;
  tier: ReturnType<typeof scoreTier>;
  /** Always four, always in this order. */
  factors: FitFactor[];
  /** Lowest-scoring factor — what the "close the gap" hint names. */
  weakest: FitFactor;
}

const WEIGHTS: Record<FitFactorId, number> = { role: 0.35, salary: 0.25, skills: 0.25, timezone: 0.15 };

/** "GMT+1" -> 1, "GMT-5" -> -5, "GMT" -> 0. */
export function parseGmtOffset(tz: string): number {
  const m = /GMT([+-]\d{1,2})/i.exec(tz);
  return m ? Number(m[1]) : 0;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Words worth matching on — mirrors the ATS stub's tokeniser. */
function words(s: string): Set<string> {
  return new Set(
    norm(s)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function roleFactor(target: RecommendationTarget, prefs: FitPrefs): FitFactor {
  const wanted = prefs.targetRoles.map(norm);
  if (wanted.includes(norm(target.role))) {
    return { id: "role", label: "Role match", score: 100, met: true, detail: `"${target.role}" is one of your target roles.` };
  }
  if (wanted.length === 0) {
    return { id: "role", label: "Role match", score: 50, met: false, detail: "You haven't set any target roles yet." };
  }

  // Best token overlap across all target roles — "Senior Product Designer" vs
  // "Product Designer, Growth" should read as close, not as a miss.
  const targetWords = words(target.role);
  let best = 0;
  for (const role of prefs.targetRoles) {
    const rw = words(role);
    if (rw.size === 0) continue;
    let shared = 0;
    for (const w of rw) if (targetWords.has(w)) shared++;
    best = Math.max(best, shared / rw.size);
  }
  const score = Math.round(best * 85);
  return {
    id: "role",
    label: "Role match",
    score,
    met: score >= 60,
    detail: score >= 60 ? `Close to "${prefs.targetRoles[0]}".` : `"${target.role}" isn't one of your target roles.`,
  };
}

function salaryFactor(target: RecommendationTarget, prefs: FitPrefs): FitFactor {
  if (target.salaryUsd == null) {
    return { id: "salary", label: "Salary", score: 70, met: false, detail: "They don't publish a band for this role." };
  }
  if (target.salaryUsd >= prefs.minSalary) {
    return {
      id: "salary",
      label: "Salary",
      score: 100,
      met: true,
      detail: `${target.salaryText ?? "The band"} clears your $${prefs.minSalary.toLocaleString()} floor.`,
    };
  }
  const ratio = target.salaryUsd / Math.max(prefs.minSalary, 1);
  const score = ratio >= 0.9 ? 70 : Math.max(10, Math.round(ratio * 60));
  return {
    id: "salary",
    label: "Salary",
    score,
    met: false,
    detail:
      ratio >= 0.9
        ? `Just under your $${prefs.minSalary.toLocaleString()} floor.`
        : `Below your $${prefs.minSalary.toLocaleString()} floor.`,
  };
}

function skillsFactor(target: RecommendationTarget, profile: FitProfile): FitFactor {
  if (target.skills.length === 0) {
    return { id: "skills", label: "Skills", score: 70, met: false, detail: "They haven't listed what they're looking for." };
  }
  const mine = new Set(profile.skills.map(norm));
  const matched = target.skills.filter((s) => mine.has(norm(s)));
  const score = Math.round((matched.length / target.skills.length) * 100);
  const missing = target.skills.filter((s) => !mine.has(norm(s)));
  return {
    id: "skills",
    label: "Skills",
    score,
    met: score >= 60,
    detail:
      missing.length === 0
        ? `You have all ${target.skills.length} skills they list.`
        : `${matched.length} of ${target.skills.length} matched — missing ${missing.slice(0, 2).join(", ")}.`,
  };
}

function timezoneFactor(target: RecommendationTarget, prefs: FitPrefs, profile: FitProfile): FitFactor {
  if (prefs.remotePolicy === "anywhere") {
    return { id: "timezone", label: "Timezone", score: 100, met: true, detail: "You're open to any timezone." };
  }
  const gap = Math.abs(target.timezoneOffset - parseGmtOffset(profile.timezone));
  const score = gap <= 3 ? 100 : Math.max(10, Math.round(100 - (gap - 3) * 18));
  const hrs = `${gap}h`;
  return {
    id: "timezone",
    label: "Timezone",
    score,
    met: score >= 60,
    detail:
      gap <= 3
        ? `${hrs} from you — comfortable overlap.`
        : prefs.remotePolicy === "region"
          ? `${hrs} away, outside your region.`
          : `${hrs} apart — thin overlap with your working day.`,
  };
}

export function computeFit(target: RecommendationTarget, prefs: FitPrefs, profile: FitProfile): FitResult {
  const factors: FitFactor[] = [
    roleFactor(target, prefs),
    salaryFactor(target, prefs),
    skillsFactor(target, profile),
    timezoneFactor(target, prefs, profile),
  ];

  const weighted = factors.reduce((sum, f) => sum + f.score * WEIGHTS[f.id], 0);
  // A small stable nudge so equally-weighted companies don't tie visually.
  const nudge = Math.round(hash01(target.id) * 6) - 3;
  const score = Math.max(0, Math.min(100, Math.round(weighted) + nudge));

  const weakest = factors.reduce((lowest, f) => (f.score < lowest.score ? f : lowest), factors[0]);

  return { score, tier: scoreTier(score), factors, weakest };
}
