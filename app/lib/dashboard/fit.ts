// Recommendation fit — computed, never stored.
//
// "Worth watching" ranks live Remote Worldwide listings by two things the user
// has actually told us: the roles in Settings → Preferences, and the roles they
// have been APPLYING to (the tracker). Change a preference, or log an
// application, and every score on the screen moves.
//
// Listings carry a title, a seniority and regions — no salary band and no
// skills list — so the factors are the ones those can answer: role, your
// application trend, seniority and location. Salary and skills used to be
// scored too, but every listing read "not published" for both, which put the
// same neutral 70 into two thirds of every score and let any new listing float
// to the top. A listing that relates to neither your target roles nor your
// applications is not shown at all (`relevant`), however recent it is.
//
// Pure and deterministic — safe to call during render.

import type { ExperienceBand, RemotePolicy } from "@/app/lib/settings/types";
import { scoreTier } from "./ats-stub";
import type { RecommendationTarget } from "./types";

export interface FitPrefs {
  targetRoles: string[];
  experienceLevel: ExperienceBand | "";
  remotePolicy: RemotePolicy;
}

export interface FitProfile {
  /** "GMT+1" */
  timezone: string;
}

/** One application from the tracker, as the trend reads it. */
export interface AppliedRole {
  role: string;
  company: string;
  /** When it was logged, epoch ms. */
  at: number;
}

export interface FitHistory {
  /** Applications from the last `TREND_WINDOW_DAYS`, newest first. */
  applied: AppliedRole[];
}

export type FitFactorId = "role" | "trend" | "seniority" | "timezone";

export interface FitFactor {
  id: FitFactorId;
  label: string;
  /** 0-100 for this factor alone. */
  score: number;
  /** Drives the check vs. neutral glyph. */
  met: boolean;
  /** False when there is nothing to score it from yet (no target roles, no applications): shown, not weighed. */
  available: boolean;
  detail: string;
}

export interface FitResult {
  score: number;
  tier: ReturnType<typeof scoreTier>;
  /** Always four, always in this order. */
  factors: FitFactor[];
  /** Close enough to a target role or to what you've applied to, to be worth showing at all. */
  relevant: boolean;
}

/** How far back the application trend looks. */
export const TREND_WINDOW_DAYS = 90;

const DAY_MS = 86_400_000;
const WEIGHTS: Record<FitFactorId, number> = { role: 0.35, trend: 0.3, seniority: 0.2, timezone: 0.15 };
/** A title this close (0-1) to a target role or an application counts as "like it". */
const LIKE = 0.6;
/** Below this on both role and trend, a listing isn't shown. */
const RELEVANT = 0.5;

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

/** Spellings folded to one token before comparing: "Full Stack" is "Fullstack", "Sr." is "Senior". */
const FOLDS: readonly (readonly [RegExp, string])[] = [
  [/\bfull[\s-]?stack\b/g, "fullstack"],
  [/\bfront[\s-]?end\b/g, "frontend"],
  [/\bback[\s-]?end\b/g, "backend"],
  [/\bdev[\s-]?ops\b/g, "devops"],
  [/\bsr\b\.?/g, "senior"],
  [/\bjr\b\.?/g, "junior"],
  [/\b(react|node|vue|next)\.?js\b/g, "$1"],
  [/\bmachine learning\b/g, "ml"],
  [/\bquality assurance\b/g, "qa"],
];

/** Same job, different word. */
const SYNONYMS: Record<string, string> = { developer: "engineer", dev: "engineer", programmer: "engineer", sde: "engineer", swe: "engineer", mgr: "manager" };

/** Level words say how senior, not what the job is — seniority is its own factor. */
const LEVEL_WORDS = new Set([
  "senior", "junior", "lead", "principal", "staff", "head", "chief", "intern", "internship", "entry", "mid", "level",
  "associate", "graduate", "trainee", "sr", "jr", "i", "ii", "iii", "iv",
]);

const STOP_WORDS = new Set(["and", "of", "the", "for", "to", "a", "an", "in", "at", "with", "on", "remote", "contract", "time", "part", "full"]);

/** The job's noun ("Engineer", "Designer") says less than what modifies it ("Fullstack", "Product"). */
const GENERIC = new Set([
  "engineer", "designer", "manager", "specialist", "analyst", "consultant", "officer", "representative", "coordinator", "executive",
  "director", "administrator", "assistant", "architect",
]);

/** Engineering specialisms read as neighbours: a fullstack engineer should see a software or backend opening. */
const FAMILIES: Record<string, string> = Object.fromEntries(
  ["fullstack", "frontend", "backend", "software", "web", "platform", "mobile", "ios", "android", "devops", "sre", "cloud", "infrastructure"].map((w) => [
    w,
    "engineering",
  ]),
);

const tokenWeight = (token: string) => (GENERIC.has(token) ? 0.5 : 1);

/** A title as the set of words that say what the job is. */
export function roleTokens(title: string): Set<string> {
  let text = title.toLowerCase();
  for (const [pattern, replacement] of FOLDS) text = text.replace(pattern, replacement);
  return new Set(
    text
      .replace(/[^a-z0-9+#\s]/g, " ")
      .split(/\s+/)
      .map((w) => SYNONYMS[w] ?? w)
      .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !LEVEL_WORDS.has(w) && !STOP_WORDS.has(w)),
  );
}

/**
 * How alike two titles are, 0-1: a weighted Dice overlap of what each job IS.
 * Shared generic nouns count half, and an engineering specialism earns half
 * credit against a neighbouring one, so "Senior Full Stack Developer" and
 * "Fullstack Engineer" are 1, "Software Engineer" is close, and "Premium
 * Support Engineer" is not.
 */
export function titleSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let total = 0;
  for (const t of a) total += tokenWeight(t);
  for (const t of b) total += tokenWeight(t);

  let shared = 0;
  const bFamilies = new Set([...b].filter((t) => !a.has(t)).map((t) => FAMILIES[t]).filter(Boolean));
  for (const t of a) {
    if (b.has(t)) shared += tokenWeight(t);
    else if (FAMILIES[t] && bFamilies.has(FAMILIES[t])) shared += 0.5 * tokenWeight(t);
  }
  return Math.min(1, (2 * shared) / total);
}

/**
 * What to search the listings for, for one title: the title without its level
 * words ("Senior Fullstack Developer" -> "Fullstack Developer"), and the one
 * word that says the most on its own ("Fullstack"), since the search matches
 * a substring of the listing's title.
 */
export function searchTermsFor(title: string): string[] {
  // A qualifier after a bracket, comma or dash ("(Node.js)", ", Growth") is
  // not in most listings' titles; the part before it names the job.
  const coreOf = (text: string) =>
    text
      .replace(/[^A-Za-z0-9+#\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w && w !== "-" && !LEVEL_WORDS.has(w.toLowerCase()))
      .join(" ")
      .trim();
  const core = title.split(/[(,|]|\s[-–—]\s/).map(coreOf).find(Boolean) ?? "";
  const key = [...roleTokens(core)].find((t) => !GENERIC.has(t));
  return [...new Set([core, key ?? ""].filter((t) => t.length > 1))];
}

// ---------------------------------------------------------------------------
// Seniority
// ---------------------------------------------------------------------------

const BANDS: readonly ExperienceBand[] = ["intern", "entry", "mid", "senior", "lead"];
const BAND_LABEL: Record<ExperienceBand, string> = { intern: "intern", entry: "entry", mid: "mid", senior: "senior", lead: "lead" };

/** The bands a level string covers: "Entry & mid-level" is two, "Senior ++" is senior and up. */
export function bandsOf(level: string | null | undefined): ExperienceBand[] {
  const text = (level ?? "").toLowerCase();
  const bands = new Set<ExperienceBand>();
  if (/intern/.test(text)) bands.add("intern");
  if (/entry|junior|graduate|\bjr\b/.test(text)) bands.add("entry");
  if (/\bmid/.test(text)) bands.add("mid");
  if (/senior\s*\+\+/.test(text)) {
    bands.add("senior");
    bands.add("lead");
  } else if (/senior|\bsr\b/.test(text)) bands.add("senior");
  if (/\b(lead|principal|staff|head)\b/.test(text)) bands.add("lead");
  return BANDS.filter((b) => bands.has(b));
}

/** The level you've been applying at: the band most of your recent titles name, when enough of them name one. */
function trendBand(history: FitHistory): ExperienceBand | null {
  const counts = new Map<ExperienceBand, number>();
  let named = 0;
  for (const app of history.applied) {
    const bands = bandsOf(app.role);
    if (bands.length !== 1) continue;
    named++;
    counts.set(bands[0], (counts.get(bands[0]) ?? 0) + 1);
  }
  if (named < 2) return null;
  const [band, n] = [...counts].sort((x, y) => y[1] - x[1])[0];
  return n / named >= 0.5 ? band : null;
}

// ---------------------------------------------------------------------------
// Factors
// ---------------------------------------------------------------------------

function roleFactor(title: Set<string>, prefs: FitPrefs): FitFactor {
  const roles = prefs.targetRoles.map((r) => r.trim()).filter(Boolean);
  if (roles.length === 0) {
    return { id: "role", label: "Your target roles", score: 0, met: false, available: false, detail: "You haven't set any target roles yet." };
  }
  let best = { role: roles[0], sim: 0 };
  for (const role of roles) {
    const sim = titleSimilarity(roleTokens(role), title);
    if (sim > best.sim) best = { role, sim };
  }
  const score = Math.round(best.sim * 100);
  return {
    id: "role",
    label: "Your target roles",
    score,
    met: best.sim >= LIKE,
    available: true,
    detail: best.sim >= 0.999 ? `One of your target roles: "${best.role}".` : best.sim >= LIKE ? `Close to "${best.role}".` : "Not one of your target roles.",
  };
}

/** Recent applications count for more: today's at full weight, one from three months ago at a little over half. */
const recency = (at: number, now: number) => 0.5 + 0.5 * Math.pow(0.5, Math.max(0, now - at) / DAY_MS / 30);

function trendFactor(title: Set<string>, history: FitHistory, now: number): FitFactor {
  if (history.applied.length === 0) {
    return {
      id: "trend",
      label: "What you've applied to",
      score: 0,
      met: false,
      available: false,
      detail: "Track your applications and this learns what you go for.",
    };
  }
  let best = 0;
  const alike: AppliedRole[] = [];
  for (const app of history.applied) {
    const sim = titleSimilarity(roleTokens(app.role), title);
    best = Math.max(best, sim * recency(app.at, now));
    if (sim >= LIKE) alike.push(app);
  }
  const score = Math.round(best * 100);
  // `applied` is newest first, so the first alike one is the latest.
  const latest = alike[0];
  return {
    id: "trend",
    label: "What you've applied to",
    score,
    met: score >= LIKE * 100,
    available: true,
    detail: latest
      ? `Like ${alike.length === 1 ? "a role" : `${alike.length} roles`} you applied to lately, most recently ${latest.role} at ${latest.company}.`
      : "Not like what you've been applying to lately.",
  };
}

function seniorityFactor(target: RecommendationTarget, prefs: FitPrefs, history: FitHistory): FitFactor {
  const yours = prefs.experienceLevel || trendBand(history);
  const theirs = bandsOf(target.seniority ?? target.role);
  const label = "Seniority";
  if (!yours) {
    return { id: "seniority", label, score: 70, met: false, available: true, detail: "Set your experience level in preferences to match on seniority." };
  }
  const source = prefs.experienceLevel ? "your" : "the";
  const suffix = prefs.experienceLevel ? "level" : "level you've been applying at";
  if (theirs.length === 0) {
    return { id: "seniority", label, score: 70, met: false, available: true, detail: "They don't say what level this is." };
  }
  const gap = Math.min(...theirs.map((b) => Math.abs(BANDS.indexOf(b) - BANDS.indexOf(yours))));
  const named = target.seniority ?? theirs.map((b) => BAND_LABEL[b]).join(" / ");
  if (gap === 0) return { id: "seniority", label, score: 100, met: true, available: true, detail: `${named}: matches ${source} ${BAND_LABEL[yours]} ${suffix}.` };
  if (gap === 1) return { id: "seniority", label, score: 65, met: false, available: true, detail: `${named}: a step from ${source} ${BAND_LABEL[yours]} ${suffix}.` };
  return { id: "seniority", label, score: 25, met: false, available: true, detail: `${named}: far from ${source} ${BAND_LABEL[yours]} ${suffix}.` };
}

/** "GMT+1" -> 1, "GMT-5" -> -5, "GMT" -> 0. */
export function parseGmtOffset(tz: string): number {
  const m = /GMT([+-]\d{1,2})/i.exec(tz);
  return m ? Number(m[1]) : 0;
}

function timezoneFactor(target: RecommendationTarget, prefs: FitPrefs, profile: FitProfile): FitFactor {
  const label = "Location";
  if (prefs.remotePolicy === "anywhere") return { id: "timezone", label, score: 100, met: true, available: true, detail: "You're open to any timezone." };
  if (target.anywhere) return { id: "timezone", label, score: 100, met: true, available: true, detail: "They hire anywhere in the world." };
  if (target.timezoneOffsets.length === 0) return { id: "timezone", label, score: 70, met: false, available: true, detail: "They don't say where they hire." };
  // The region closest to you decides — a listing open to Europe and the
  // Americas is a comfortable fit for someone in either.
  const mine = parseGmtOffset(profile.timezone);
  const gap = Math.min(...target.timezoneOffsets.map((offset) => Math.abs(offset - mine)));
  const score = gap <= 3 ? 100 : Math.max(10, Math.round(100 - (gap - 3) * 18));
  const hrs = `${gap}h`;
  return {
    id: "timezone",
    label,
    score,
    met: score >= 60,
    available: true,
    detail:
      gap <= 3
        ? `${hrs} from you, good overlap.`
        : prefs.remotePolicy === "region"
          ? `${hrs} away, outside your region.`
          : `${hrs} apart, little overlap with your working day.`,
  };
}

// ---------------------------------------------------------------------------

export function computeFit(target: RecommendationTarget, prefs: FitPrefs, profile: FitProfile, history: FitHistory, now: number = Date.now()): FitResult {
  const title = roleTokens(target.role);
  const role = roleFactor(title, prefs);
  const trend = trendFactor(title, history, now);
  const factors: FitFactor[] = [role, trend, seniorityFactor(target, prefs, history), timezoneFactor(target, prefs, profile)];

  // With only one of target roles and applications to go on, it carries both their weights.
  const weights = { ...WEIGHTS };
  if (!role.available) weights.trend += weights.role;
  if (!trend.available) weights.role += weights.trend;
  const weighed = factors.filter((f) => f.available);
  const total = weighed.reduce((sum, f) => sum + weights[f.id], 0);
  const score = total > 0 ? Math.max(0, Math.min(100, Math.round(weighed.reduce((sum, f) => sum + f.score * weights[f.id], 0) / total))) : 0;

  const relevant = (role.available && role.score >= RELEVANT * 100) || (trend.available && trend.score >= RELEVANT * 100);

  return { score, tier: scoreTier(score), factors, relevant };
}

/**
 * Which of the four factors have something of yours to match on. A factor
 * without one still scores (seniority and location fall back to a neutral
 * guess), so every listing drifts to the same middling tier: this is what
 * the screen names, with the one thing that fills each gap.
 */
export function fitSignals(prefs: FitPrefs, profile: FitProfile, history: FitHistory): Record<FitFactorId, boolean> {
  return {
    role: prefs.targetRoles.some((r) => r.trim()),
    trend: history.applied.length > 0,
    seniority: Boolean(prefs.experienceLevel || trendBand(history)),
    timezone: prefs.remotePolicy === "anywhere" || profile.timezone.trim().length > 0,
  };
}

/** The applications the trend reads: logged in the window, not duplicates, newest first. */
export function recentApplications<T extends { role: string; company: string; loggedAt: string; duplicateOf: string | null }>(
  applications: readonly T[],
  now: number = Date.now(),
): AppliedRole[] {
  const since = now - TREND_WINDOW_DAYS * DAY_MS;
  return applications
    .filter((a) => a.role.trim() && !a.duplicateOf)
    .map((a) => ({ role: a.role, company: a.company, at: Date.parse(a.loggedAt) }))
    .filter((a) => Number.isFinite(a.at) && a.at >= since)
    .sort((x, y) => y.at - x.at);
}

/**
 * The searches that build the pool: each target role first, then the titles
 * you've applied to most (recent ones counting more), `max` terms in all.
 */
export function watchSearchTerms(prefs: Pick<FitPrefs, "targetRoles">, history: FitHistory, max: number, now: number = Date.now()): string[] {
  const trend = new Map<string, { title: string; weight: number }>();
  for (const app of history.applied) {
    const key = [...roleTokens(app.role)].sort().join(" ");
    if (!key) continue;
    const entry = trend.get(key) ?? { title: app.role, weight: 0 };
    entry.weight += recency(app.at, now);
    trend.set(key, entry);
  }
  const titles = [
    ...prefs.targetRoles.map((r) => r.trim()).filter(Boolean),
    ...[...trend.values()].sort((x, y) => y.weight - x.weight).map((t) => t.title),
  ];
  const terms: string[] = [];
  for (const title of titles) {
    for (const term of searchTermsFor(title)) {
      if (terms.length >= max) return terms;
      if (!terms.some((t) => t.toLowerCase() === term.toLowerCase())) terms.push(term);
    }
  }
  return terms;
}
