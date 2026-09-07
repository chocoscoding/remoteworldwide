// The funnel — where applications actually die.
//
// This is the payoff for Phase 1's terminal states. A board that only went
// forwards could report "34 applied, 3 interviewing" and nothing else; once
// applications can close, every one of them carries the stage it reached, and
// the shape of the search becomes readable: whether the problem is that nobody
// replies, or that everybody replies and nobody hires.
//
// Pure and deterministic, like `resume/ai-tools.ts`. `diagnose` is the part
// that matters — a stack of percentages is a report, and a report is not
// advice. It returns the one sentence a good coach would lead with.
//
// A note on counting: `TrackerColumn.count` is a declared total that
// deliberately exceeds `cards.length` (the board renders a representative
// sample). The funnel counts real card records only, because those are the
// ones that carry an outcome — inventing stages for the phantom remainder
// would be fabricating data. The UI says which number it is counting.

import { STATUS_ORDER } from "@/app/components/dashboard/tracker/tracker-meta";
import type { TrackerCard, TrackerClosedReason, TrackerColumnId } from "./types";

export interface FunnelStage {
  id: TrackerColumnId;
  /** Applications that reached this stage, whether or not they're still open. */
  reached: number;
  /** Share of the previous stage that made it here; null for the first stage. */
  conversion: number | null;
}

export interface FunnelClosure {
  reason: TrackerClosedReason;
  n: number;
}

export interface Funnel {
  stages: FunnelStage[];
  closures: FunnelClosure[];
  open: number;
  closed: number;
  total: number;
  /** How the Remote Worldwide-sourced applications compare with the rest. */
  bySource: { rww: SourceSplit; elsewhere: SourceSplit };
}

export interface SourceSplit {
  applied: number;
  reachedInterview: number;
  /** Share of applications that reached an interview, 0-1; null if none applied. */
  rate: number | null;
  /**
   * False when there are too few applications for the rate to mean anything.
   * One interview out of two applications is not a 50% conversion rate, and
   * showing it next to a rate computed from thirty would invite a real
   * decision ("apply through RWW, it converts 3x better") on noise.
   */
  reliable: boolean;
}

/** Below this, a conversion rate is an anecdote, not a rate. */
export const MIN_SAMPLE_FOR_RATE = 8;

/** How far this application ever got: where it sits, or where it died. */
export function furthestStage(card: TrackerCard, columnId: TrackerColumnId | null): TrackerColumnId {
  return card.closedReason ? (card.closedFrom ?? "applied") : (columnId ?? "saved");
}

const stageIndex = (id: TrackerColumnId) => STATUS_ORDER.indexOf(id);

function splitFor(records: { card: TrackerCard; furthest: TrackerColumnId }[]): SourceSplit {
  const applied = records.filter((r) => stageIndex(r.furthest) >= stageIndex("applied")).length;
  const reachedInterview = records.filter((r) => stageIndex(r.furthest) >= stageIndex("interviewing")).length;
  return {
    applied,
    reachedInterview,
    rate: applied === 0 ? null : reachedInterview / applied,
    reliable: applied >= MIN_SAMPLE_FOR_RATE,
  };
}

export function buildFunnel(placed: { card: TrackerCard; columnId: TrackerColumnId }[], closed: TrackerCard[]): Funnel {
  const records = [
    ...placed.map(({ card, columnId }) => ({ card, furthest: furthestStage(card, columnId) })),
    ...closed.map((card) => ({ card, furthest: furthestStage(card, null) })),
  ];

  const stages: FunnelStage[] = STATUS_ORDER.map((id, i) => {
    const reached = records.filter((r) => stageIndex(r.furthest) >= i).length;
    const prev = i === 0 ? null : records.filter((r) => stageIndex(r.furthest) >= i - 1).length;
    return { id, reached, conversion: prev === null || prev === 0 ? null : reached / prev };
  });

  const closures = (["rejected", "ghosted", "withdrawn", "declined"] as TrackerClosedReason[])
    .map((reason) => ({ reason, n: closed.filter((c) => c.closedReason === reason).length }))
    .filter((c) => c.n > 0);

  return {
    stages,
    closures,
    open: placed.length,
    closed: closed.length,
    total: records.length,
    bySource: {
      rww: splitFor(records.filter((r) => r.card.rww)),
      elsewhere: splitFor(records.filter((r) => !r.card.rww)),
    },
  };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The one sentence worth leading with.
 *
 * Ordered by which problem is worth solving first, not by which number is
 * lowest. Silence at the top of the funnel is a targeting-and-materials
 * problem and dwarfs everything downstream; losing late rounds is a very
 * different, much better problem to have, and telling someone to rewrite their
 * resume when they're reaching final rounds would be actively bad advice.
 */
export function diagnose(funnel: Funnel): string {
  const applied = funnel.stages.find((s) => s.id === "applied")?.reached ?? 0;
  if (applied < 5) return "Not enough applications yet to see a pattern. Keep going — the shape shows up around ten.";

  const replied = funnel.stages.find((s) => s.id === "conversation")?.reached ?? 0;
  const interviewed = funnel.stages.find((s) => s.id === "interviewing")?.reached ?? 0;
  const offered = funnel.stages.find((s) => s.id === "offer")?.reached ?? 0;
  const ghosted = funnel.closures.find((c) => c.reason === "ghosted")?.n ?? 0;

  const replyRate = replied / applied;
  if (replyRate < 0.15) {
    return `Only ${pct(replyRate)} of your applications get a reply${
      ghosted > 0 ? ` and ${ghosted} went silent entirely` : ""
    }. That's a targeting and resume problem, not an interview one — it's the highest-value thing to fix.`;
  }

  if (interviewed >= 3 && offered === 0) {
    return `You reach interviews on ${pct(
      interviewed / applied,
    )} of applications but haven't converted one to an offer yet. The materials are working; the interview itself is where to spend your time.`;
  }

  if (replied > 0 && interviewed / replied < 0.4) {
    return `You get replies on ${pct(replyRate)} of applications but only ${pct(
      interviewed / replied,
    )} of those conversations become interviews. Something in the first call is losing them.`;
  }

  return `${pct(replyRate)} of your applications get a reply and ${pct(
    interviewed / applied,
  )} reach an interview. That's a working funnel — volume is what moves it now.`;
}
