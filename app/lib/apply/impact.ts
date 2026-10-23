import { descriptiveAction, descriptiveContext, explicitWeakOpening, impactPortfolio } from "./impact-evidence";
// What the ATS scorer's Impact language reads in a bullet (owner, 2026-10-19: "show me what impact
// language looks at"): an action (55%) and quantitative or concrete application evidence (45%). A copy of
// the AI service's checks (scoringService.ts STRONG_VERBS, opensWithStrongVerb, carriesNumber, and
// resumeWriter.ts IRREGULAR_PAST), so the apply step can light the exact lines that lose points as the
// person edits, without a rescore. Its contract test (frontend-impact.test.ts) fails if they drift.

import type { ResumeContent } from "@/app/lib/dashboard/types";

/** The openings the scorer counts as a claim, in the past tense. */
export const STRONG_VERBS: ReadonlySet<string> = new Set([
  "replaced", "ran", "aligned", "lifted", "shaped",
  "accelerated",
  "achieved",
  "acquired",
  "architected",
  "audited",
  "authored",
  "automated",
  "benchmarked",
  "boosted",
  "built",
  "championed",
  "closed",
  "coached",
  "consolidated",
  "converted",
  "created",
  "cut",
  "decommissioned",
  "delivered",
  "deployed",
  "designed",
  "developed",
  "diagnosed",
  "directed",
  "doubled",
  "drove",
  "eliminated",
  "engineered",
  "established",
  "expanded",
  "founded",
  "generated",
  "grew",
  "halved",
  "implemented",
  "improved",
  "increased",
  "initiated",
  "instrumented",
  "introduced",
  "landed",
  "launched",
  "led",
  "mentored",
  "migrated",
  "modernised",
  "modernized",
  "negotiated",
  "optimised",
  "optimized",
  "orchestrated",
  "overhauled",
  "owned",
  "pioneered",
  "prototyped",
  "raised",
  "rearchitected",
  "rebuilt",
  "recovered",
  "reduced",
  "refactored",
  "replatformed",
  "resolved",
  "restructured",
  "saved",
  "scaled",
  "secured",
  "shipped",
  "simplified",
  "slashed",
  "solved",
  "spearheaded",
  "standardised",
  "standardized",
  "streamlined",
  "strengthened",
  "trained",
  "tripled",
  "unblocked",
  "unified",
  "won",
  "wrote",
  "advised",
  "analysed",
  "analyzed",
  "captured",
  "coordinated",
  "decreased",
  "earned",
  "educated",
  "enabled",
  "evaluated",
  "exceeded",
  "executed",
  "facilitated",
  "forecasted",
  "guided",
  "hired",
  "identified",
  "lowered",
  "maintained",
  "managed",
  "measured",
  "minimised",
  "minimized",
  "onboarded",
  "organised",
  "organized",
  "outperformed",
  "oversaw",
  "partnered",
  "planned",
  "presented",
  "prioritised",
  "prioritized",
  "produced",
  "promoted",
  "published",
  "recruited",
  "redesigned",
  "renewed",
  "researched",
  "retained",
  "revamped",
  "rewrote",
  "sourced",
  "supervised",
  "surpassed",
  "taught",
  "transformed",
  "upsold",
]);

/** Irregular past tenses, so a current role's "Grow" or "Oversee" counts as grew and oversaw. */
export const IRREGULAR_PAST: Readonly<Record<string, string>> = {
  lead: "led",
  oversee: "oversaw",
  run: "ran",
  grow: "grew",
  drive: "drove",
  win: "won",
  sell: "sold",
  cut: "cut",
  build: "built",
  write: "wrote",
  set: "set",
  teach: "taught",
  speed: "sped",
  rebuild: "rebuilt",
  found: "founded",
};

/** Years are dates, not results. */
const YEARS = /\b(?:19|20)\d{2}\b/g;

/** Whether a line carries a number the scorer counts: any digit that is not a year. */
export const carriesNumber = (text: string): boolean => /\d/.test(text.replace(YEARS, " "));

const pastOf = (word: string): string[] => [`${word}ed`, `${word}d`, word.endsWith("y") ? `${word.slice(0, -1)}ied` : ""].filter(Boolean);

/** Whether a line opens with a verb the scorer counts, in the past tense or a current role's present. */
export const opensWithStrongVerb = (text: string): boolean => {
  const first =
    text
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)[0]
      ?.replace(/[^a-z]/g, "") ?? "";
  if (STRONG_VERBS.has(first)) return true;
  const present = first.endsWith("s") ? first.slice(0, -1) : first;
  const irregular = IRREGULAR_PAST[present];
  return (irregular !== undefined && STRONG_VERBS.has(irregular)) || pastOf(present).some((form) => STRONG_VERBS.has(form));
};

/** Shared writing signals. Unknown vocabulary is not an explicit weakness. */
export const hasImpactAction = (text: string): boolean => opensWithStrongVerb(text) || descriptiveAction(text);
export const hasAppliedContext = (text: string): boolean => hasImpactAction(text) && descriptiveContext(text);
export const hasImpactEvidence = (text: string): boolean => carriesNumber(text) || hasAppliedContext(text);
export const measureImpact = (bullets: string[]) => impactPortfolio(bullets, text =>
  (hasImpactAction(text) ? 0.55 : 0) + (hasImpactEvidence(text) ? 0.45 : 0));

export interface ImpactMisses {
  /** Bullets with explicit weak openings; unfamiliar verbs are not automatically weak. */
  weakOpeners: string[];
  /** Bullets missing both quantitative evidence and concrete application context. */
  noNumber: string[];
  /** Optional improvement candidates, once each, in resume order. */
  lines: string[];
}

/**
 * Candidate improvements to the evidence portfolio, across the roles shown: never a role or a line
 * hidden for this job. Reads `content` as it is, so it follows the person's edits.
 */
export function impactMisses(content: ResumeContent): ImpactMisses {
  const hidden = new Set(content.hiddenParts ?? []);
  const bullets = content.experience
    .filter((entry) => !entry.hidden && !hidden.has(`exp:${entry.id}`))
    .flatMap((entry) => entry.bullets.filter((bullet, index) => bullet.trim() && !hidden.has(`exp:${entry.id}:${index}`)));
  const weakOpeners = bullets.filter((bullet) => explicitWeakOpening(bullet));
  const noNumber = bullets.filter((bullet) => !hasImpactEvidence(bullet));
  return { weakOpeners, noNumber, lines: bullets.filter((bullet) => weakOpeners.includes(bullet) || noNumber.includes(bullet)) };
}

/** A bullet's first word as written ("Acted", "Held"), for naming weak openings. */
export const openingWord = (bullet: string): string =>
  bullet
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[^\p{L}'-]/gu, "") ?? "";
