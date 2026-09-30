// A saved prep track, in the shape the prep screens already speak.
//
// The screens were built on prep-data.ts's `PrepTrack`: a round label, a date,
// a status, a checklist and sessions. The backend's track (./types.ts) stores
// the loop itself — its rounds, links and posting — and derives none of that,
// so it is derived here, once: status and the round label from the rounds, the
// checklist from the plan tasks the track carries. Every screen then reads a
// track without knowing where each part came from.
//
// Pure: no React, no fetching.

import type { ApplicationStatus } from "@/app/lib/applications/types";
import type { ActionItem, PrepSession, PrepTrack, RoundOutcome, TrackStatus } from "@/app/lib/dashboard/prep-data";
import type { TaskItem } from "@/app/lib/tasks/types";
import type { PrepRound, PrepRoundInput, PrepRoundOutcome, PrepRoundType, PrepTrackItem } from "./types";

export const ROUND_TYPE_LABELS: Record<PrepRoundType, string> = {
  "recruiter-screen": "Recruiter screen",
  "hiring-manager": "Hiring manager",
  technical: "Technical",
  portfolio: "Portfolio review",
  behavioural: "Behavioural",
  "case-study": "Case study",
  panel: "Panel",
  final: "Final round",
  other: "Interview",
};

export const ROUND_OUTCOME_LABELS: Record<PrepRoundOutcome, string> = {
  waiting: "Waiting to hear",
  passed: "Moved forward",
  offer: "Offer",
  rejected: "Didn't move forward",
};

/** The round the loop is on: the last one entered. */
export function currentRound(rounds: readonly PrepRound[]): PrepRound | null {
  return rounds.length > 0 ? rounds[rounds.length - 1] : null;
}

/** "Round 2 · Technical", "Final round", or "Not scheduled yet". */
export function roundLabel(rounds: readonly PrepRound[]): string {
  const round = currentRound(rounds);
  if (!round) return "Not scheduled yet";
  if (round.type === "final") return ROUND_TYPE_LABELS.final;
  return `Round ${rounds.length} · ${ROUND_TYPE_LABELS[round.type]}`;
}

/** One round's own name, for a list of them: "Round 1 · Recruiter screen". */
export function roundName(round: PrepRound, index: number): string {
  return round.type === "final" ? ROUND_TYPE_LABELS.final : `Round ${index + 1} · ${ROUND_TYPE_LABELS[round.type]}`;
}

/**
 * Where the loop stands, from its current round alone: no rounds is not
 * started, an offer or a rejection closes it, "waiting to hear" is awaiting an
 * outcome, and anything else — booked, just happened, or passed with the next
 * round not added yet — is in progress.
 */
export function trackStatus(rounds: readonly PrepRound[]): { status: TrackStatus; outcome: RoundOutcome } {
  const round = currentRound(rounds);
  if (!round) return { status: "not-started", outcome: null };
  if (round.outcome === "offer" || round.outcome === "rejected") return { status: "closed", outcome: round.outcome };
  if (round.outcome === "waiting") return { status: "awaiting-outcome", outcome: "waiting" };
  return { status: "in-progress", outcome: null };
}

export function companyMark(company: string): string {
  const parts = company.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/**
 * A plan task as a checklist item. The task is the record — ticking it ticks
 * it on the plan too — and a session's actions carry the dimension and effort
 * the report put in their metadata.
 */
export function actionOf(task: TaskItem): ActionItem {
  const effort = task.metadata.effortMinutes;
  return {
    id: task.id,
    title: task.title,
    detail: task.detail ?? "",
    effortMinutes: typeof effort === "number" && Number.isFinite(effort) && effort > 0 ? Math.round(effort) : 0,
    done: task.status === "done",
    source: typeof task.metadata.dimension === "string" ? "From a practice session" : "Added to this track",
  };
}

/** The saved track as the screens read it, with the saved sessions that belong to it. */
export function toPrepTrack(item: PrepTrackItem, sessions: PrepSession[] = []): PrepTrack {
  const round = currentRound(item.rounds);
  const { status, outcome } = trackStatus(item.rounds);
  return {
    id: item.id,
    company: item.company,
    companyMark: companyMark(item.company),
    companyLogo: item.companyLogo ?? null,
    role: item.role,
    location: item.location ?? "",
    roundLabel: roundLabel(item.rounds),
    roundDate: round?.scheduledAt ?? null,
    status,
    sessions,
    actions: item.actions.map(actionOf),
    outcome,
    saved: item,
  };
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Rounds as a write sends them back, each keeping its id. A round added a
 * moment ago still carries its optimistic stand-in id until the answer lands;
 * that one goes up without an id, which is what a new round is to the server.
 */
export function roundInputs(rounds: readonly PrepRound[]): PrepRoundInput[] {
  return rounds.map((round) => ({
    id: OBJECT_ID.test(round.id) ? round.id : null,
    type: round.type,
    scheduledAt: round.scheduledAt,
    outcome: round.outcome,
    notes: round.notes,
  }));
}

/** The rounds with one round's outcome set (or cleared with null). */
export function withOutcome(rounds: readonly PrepRound[], roundId: string, outcome: PrepRoundOutcome | null): PrepRound[] {
  return rounds.map((round) => (round.id === roundId ? { ...round, outcome } : round));
}

/**
 * Where a round's outcome moves the tracker application it belongs to, or
 * null to leave it where it is.
 *
 * An offer and a rejection are the application's own outcome. Moving forward
 * or waiting to hear means the loop is live, so an application still marked
 * applied — or closed as ghosted when it plainly was not — goes to
 * interviewing. One already interviewing or holding an offer stays put.
 */
export function applicationStatusFor(outcome: PrepRoundOutcome | null, current: ApplicationStatus): ApplicationStatus | null {
  if (outcome === null) return null;
  if (outcome === "offer" || outcome === "rejected") return current === outcome ? null : outcome;
  return current === "interviewing" || current === "offer" ? null : "interviewing";
}

/** Where a track's plan tasks lead back to. */
export function trackHref(trackId: string): string {
  return `/dashboard/prep/${trackId}`;
}
