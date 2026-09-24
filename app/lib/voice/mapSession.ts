// Saved interview sessions, in the shape the prep screens already speak.
//
// The prep screens were built on prep-data.ts's `PrepSession` and `PrepTrack`,
// held in PrepProvider's memory. The AI service's sessions (./types.ts) carry
// the same report in a different envelope: the graded half under `report`,
// the setup under `prep`, the turns with their recording times. Mapping them
// here, once, lets PrepReport, PrepHub and the preparedness score read a saved
// session and a demo session the same way, and keeps every screen out of the
// contract's field names.
//
// Pure: no React, no fetching, so the AI service's contract suite can compile
// and run it.

import type { PrepSession, PrepTrack, TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import type { PrepSessionDetail, PrepSessionSummary, PrepTurn, ScoreConfidence } from "./types";

/**
 * How a session's score reads — the one answer every surface uses: the hub's
 * rows and its "Last session" card, the preparedness score, and the report
 * header. They disagreed once (the hub showed 48 where the report showed "—"
 * for the same too-short session) because each read `overallScore` its own way.
 *
 * - `scored`: a full score.
 * - `provisional`: a real score from the dimensions that had evidence, for a
 *   session too short to charge. Show it labelled; never count it towards
 *   preparedness.
 * - `unscored`: no score — too little evidence, locked, or not graded yet.
 *
 * A service older than the evidence gates sends no `scoreConfidence`; its
 * too-short sessions had no real score (every dimension sat at its floor), so
 * they read `unscored`.
 */
export type ScoreDisplay = { kind: "scored"; score: number } | { kind: "provisional"; score: number } | { kind: "unscored" };

export function scoreDisplayOf(session: { overallScore: number | null; tooShort: boolean; scoreConfidence?: ScoreConfidence }): ScoreDisplay {
  const confidence = session.scoreConfidence ?? (session.tooShort ? "none" : "full");
  if (session.overallScore === null || confidence === "none") return { kind: "unscored" };
  return confidence === "provisional" ? { kind: "provisional", score: session.overallScore } : { kind: "scored", score: session.overallScore };
}

/**
 * A saved session's id is a Mongo ObjectId (and so is a saved track's). The
 * report route checks it before asking the service, so an id typed by hand
 * never reaches the service unless it could be one of its own.
 */
export const SERVER_SESSION_ID = /^[0-9a-f]{24}$/i;

export const isServerSessionId = (id: string): boolean => SERVER_SESSION_ID.test(id);

/** The turn as the report's transcript holds it: the recording times stay, how it was captured does not. */
function toTranscriptTurn(turn: PrepTurn): TranscriptTurn {
  return {
    id: turn.id,
    who: turn.who,
    text: turn.text,
    ...(turn.questionId === undefined ? {} : { questionId: turn.questionId }),
    ...(turn.startMs === undefined ? {} : { startMs: turn.startMs }),
    ...(turn.endMs === undefined ? {} : { endMs: turn.endMs }),
  };
}

/**
 * One saved session as a `PrepSession`, for PrepReport.
 *
 * A session without a report (still analysing, failed, or locked) maps to an
 * empty report rather than a missing one, so the shape stays whole; the report
 * page shows those states with their own components and never hands such a
 * session to PrepReport. `overallScore` falls back to 0 for that reason, and
 * when there is no score at all (`scoreConfidence: "none"`): read it through
 * `scoreDisplayOf`, which says so.
 *
 * The Positioning and Diction sections come across as they are, absent for a
 * session analysed before they existed.
 */
export function detailToPrepSession(detail: PrepSessionDetail): PrepSession {
  const report = detail.report;
  const summary = detail.summaryLines ?? detail.delivery?.summary;
  const scoreConfidence = report?.scoreConfidence ?? detail.scoreConfidence;
  return {
    id: detail.id,
    serverId: detail.id,
    trackId: detail.prep.trackId || detail.trackId,
    formats: [...detail.prep.formats],
    difficulty: detail.prep.difficulty,
    lengthMinutes: detail.prep.lengthMinutes,
    completedAt: detail.completedAt ?? detail.createdAt,
    transcript: detail.turns.map(toTranscriptTurn),
    overallScore: report?.overallScore ?? detail.overallScore ?? 0,
    dimensions: report?.dimensions ?? [],
    languageStats: report?.languageStats ?? [],
    rewrites: report?.rewrites ?? [],
    actionItems: report?.actionItems ?? [],
    coachNote: report?.coachNote ?? "",
    tooShort: report?.tooShort ?? detail.tooShort,
    ...(scoreConfidence ? { scoreConfidence } : {}),
    ...(report?.scoreReason !== undefined ? { scoreReason: report.scoreReason } : {}),
    ...(report?.scoreEvidence !== undefined ? { scoreEvidence: report.scoreEvidence } : {}),
    ...(report?.unscoredDimensions ? { unscoredDimensions: report.unscoredDimensions } : {}),
    ...(report?.positioning ? { positioning: report.positioning } : {}),
    ...(report?.diction ? { diction: report.diction } : {}),
    mode: detail.mode,
    status: detail.status,
    ...(detail.delivery ? { delivery: detail.delivery } : {}),
    ...(summary && summary.length > 0 ? { summary } : {}),
    billing: { credits: detail.billing.credits, state: detail.billing.state },
    locked: detail.locked,
    rating: detail.rating?.score ?? null,
    ...(detail.liveProvider ? { liveProvider: detail.liveProvider } : {}),
  };
}

/**
 * A row of the session list as a `PrepSession`, for the track's history and
 * its preparedness score.
 *
 * The list carries no report, formats or difficulty (it projects only what a
 * row needs), so those are left empty and the setup's defaults stand in. Only
 * the fields a list reads are real: id, date, length, score and state. The
 * report route always loads the full session by id, so this stand-in is never
 * rendered as a report.
 */
export function summaryToPrepSession(summary: PrepSessionSummary): PrepSession {
  return {
    id: summary.id,
    serverId: summary.id,
    trackId: summary.trackId,
    formats: [],
    difficulty: "standard",
    lengthMinutes: summary.lengthMinutes,
    completedAt: summary.completedAt ?? summary.createdAt,
    transcript: [],
    overallScore: summary.overallScore ?? 0,
    dimensions: [],
    languageStats: [],
    rewrites: [],
    actionItems: [],
    coachNote: "",
    // Carried, not assumed, so `scoreDisplayOf` reads a list row the way it reads the full report.
    tooShort: summary.tooShort,
    ...(summary.scoreConfidence ? { scoreConfidence: summary.scoreConfidence } : {}),
    mode: summary.mode,
    status: summary.status,
    billing: { credits: summary.billing.credits, state: summary.billing.state },
    locked: summary.locked,
    ...(summary.liveProvider ? { liveProvider: summary.liveProvider } : {}),
  };
}

/** Company names compared the way a person would: case and spacing aside. */
export function sameCompany(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Whether a saved session belongs to this track.
 *
 * A saved track's id is an ObjectId, unique for good, so the id alone decides
 * — and must: a track renamed from "Acme" to "Acme Inc." still owns the
 * sessions it ran. Sessions from before tracks were saved carry the old
 * in-memory ids (`track-vercel`, `track-custom-N`), which repeated across page
 * loads, so for those the company frozen into the session at create stays the
 * tie-breaker.
 */
export function sessionBelongsTo(track: Pick<PrepTrack, "id" | "company">, summary: Pick<PrepSessionSummary, "trackId" | "company">): boolean {
  if (summary.trackId !== track.id) return false;
  return SERVER_SESSION_ID.test(track.id) || sameCompany(summary.company, track.company);
}

/** A session that counts towards preparedness: graded, readable, and a full score — not a provisional one, not none. */
export function isScoredSession(summary: PrepSessionSummary): boolean {
  return summary.status === "ready" && !summary.locked && scoreDisplayOf(summary).kind === "scored";
}

const timeOf = (session: Pick<PrepSession, "completedAt">): number => {
  const ms = Date.parse(session.completedAt);
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * The track's sessions with its scored saved sessions merged in, oldest
 * first, as PrepProvider has always kept them (the preparedness score reads
 * the last three, and the report's "since last time" reads the one before).
 *
 * Only scored sessions join: the score averages `overallScore`, so a session
 * still analysing, failed or locked would pull it towards zero. The hub lists
 * those from the session list directly. A saved session already present,
 * under its id or as a demo session's `serverId`, is not added twice.
 *
 * Returns `track.sessions` itself when nothing was added, so a memoised track
 * keeps its identity.
 */
export function mergeServerSessions(track: Pick<PrepTrack, "id" | "company" | "sessions">, summaries: readonly PrepSessionSummary[]): PrepSession[] {
  const known = new Set<string>();
  for (const session of track.sessions) {
    known.add(session.id);
    if (session.serverId) known.add(session.serverId);
  }
  const added: PrepSession[] = [];
  for (const summary of summaries) {
    if (known.has(summary.id) || !isScoredSession(summary) || !sessionBelongsTo(track, summary)) continue;
    known.add(summary.id);
    added.push(summaryToPrepSession(summary));
  }
  if (added.length === 0) return track.sessions;
  // Sort is stable, so sessions finished in the same millisecond keep their order.
  return [...track.sessions, ...added].sort((a, b) => timeOf(a) - timeOf(b));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/**
 * A stand-in track built from what the session froze at create, for a report
 * whose track is gone (deleted, or the session predates saved tracks). It has
 * no history or actions of its own, and no `saved` track behind it: the report
 * needs only its name and round.
 */
export function trackFromSnapshot(detail: Pick<PrepSessionDetail, "trackId" | "prep">): PrepTrack {
  const { company, role, roundLabel } = detail.prep.trackSnapshot;
  return {
    id: detail.prep.trackId || detail.trackId,
    company,
    companyMark: initials(company),
    role,
    location: "",
    roundLabel,
    roundDate: null,
    status: "in-progress",
    sessions: [],
    actions: [],
    outcome: null,
  };
}
