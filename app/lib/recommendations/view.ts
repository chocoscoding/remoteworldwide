// Wire shapes -> what the recommend screen draws.
//
// Two mappings, both pure:
//  - a backend recommendation -> `IntroPipelineEntry`, the card/detail view
//    model the recommend components were built against (so they kept their
//    shape when the mock seed went away);
//  - a Remote Worldwide listing -> `RecommendationTarget`, the input the fit
//    engine (app/lib/dashboard/fit.ts) scores for "worth watching".

import type { IntroPipelineEntry, RecommendationTarget } from "@/app/lib/dashboard/types";
import type { PlatformJobSearchItem } from "@/app/lib/jobs/types";
import type { RecommendationItem } from "./types";

const DAY_MS = 86_400_000;

/** Whole days from `from` to `now`, never negative. */
const daysSince = (from: number, now: number) => Math.max(0, Math.floor((now - from) / DAY_MS));

/** Days left until a deadline, rounded UP so "closes in 1d" holds for the whole final day. */
const daysUntil = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / DAY_MS));

const instant = (value: Date | string) => new Date(value).getTime();

/**
 * One recommendation as the cards read it. `expiresInDays` is only set while
 * the company's questions are actually waiting on you — an answered or closed
 * one has no clock to show.
 */
export function toPipelineEntry(item: RecommendationItem, now: number = Date.now()): IntroPipelineEntry {
  const waitingOnYou = item.questions.length > 0 && !item.answeredAt && !item.outcome;
  return {
    id: item.id,
    platformJobId: item.platformJobId,
    company: item.company,
    role: item.role,
    stageIndex: item.stageIndex,
    startedAgoDays: daysSince(instant(item.createdAt), now),
    questions: item.questions.map((q) => ({ id: q.id, question: q.question, answer: q.answer ?? undefined })),
    expiresInDays: waitingOnYou && item.expiresAt ? daysUntil(instant(item.expiresAt), now) : undefined,
    outcome: item.outcome ?? undefined,
    outcomeAgoDays: item.outcomeAt ? daysSince(instant(item.outcomeAt), now) : undefined,
    note: item.note ?? undefined,
    reviewerName: item.reviewer.name,
    jobUrl: item.jobUrl ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Listings -> fit targets
// ---------------------------------------------------------------------------

/** "Worldwide", "Anywhere in the world", "Global". */
const ANYWHERE = /\b(worldwide|anywhere|global)\b/i;

/**
 * Rough hub offsets for the region labels listings use. A region is a span of
 * timezones, not a point, and the fit engine only needs "comfortable overlap"
 * versus "far apart" — so one representative hour each is enough, and a label
 * we don't recognise states nothing rather than guessing.
 */
const REGION_OFFSETS: readonly (readonly [RegExp, number])[] = [
  [/\b(europe|emea|eu|uk|united kingdom|ireland|germany|france|spain|portugal|netherlands|poland)\b/i, 1],
  [/\b(africa|nigeria|ghana|kenya|south africa|egypt)\b/i, 1],
  [/\b(americas|north america|usa?|united states|canada|latam|latin america|south america|brazil|mexico)\b/i, -5],
  [/\b(india)\b/i, 5],
  [/\b(asia|apac|singapore|philippines|japan)\b/i, 8],
  [/\b(australia|oceania|new zealand|anz)\b/i, 10],
];

const offsetsFor = (regions: readonly string[]): number[] => [
  ...new Set(regions.flatMap((region) => REGION_OFFSETS.filter(([pattern]) => pattern.test(region)).map(([, offset]) => offset))),
];

const posted = (postedAt: string, now: number): string | null => {
  const at = Date.parse(postedAt);
  if (Number.isNaN(at)) return null;
  const days = daysSince(at, now);
  return days === 0 ? "posted today" : days === 1 ? "posted yesterday" : `posted ${days}d ago`;
};

/** A live listing as the fit engine's input. No salary or skills list: listings don't carry them. */
export function toWatchTarget(job: PlatformJobSearchItem, now: number = Date.now()): RecommendationTarget {
  const anywhere = job.regions.some((region) => ANYWHERE.test(region));
  return {
    id: job.id,
    company: job.company,
    role: job.role,
    timezoneOffsets: anywhere ? [] : offsetsFor(job.regions),
    anywhere,
    skills: [],
    note: [job.seniority, job.regions.join(" / ") || null, posted(job.postedAt, now)].filter(Boolean).join(" · "),
    href: `/jobs/${encodeURIComponent(job.slug)}`,
  };
}
