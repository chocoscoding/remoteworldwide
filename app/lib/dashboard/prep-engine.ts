// Interview Prep — the pure logic the screens still run in the browser.
//
// Grading is not here any more. Every session is saved by the AI service and
// scored there (remoteworldwideai/src/lib/prepRubric.ts plus the report model),
// and the report screen reads the result; the in-browser scorer that used to
// stand in for it — and the demo report built from it — are gone, along with
// the invented panel research. What remains is arithmetic over real data (the
// preparedness score) and choosing which bank questions a live session asks.

import {
  FORMAT_META,
  QUESTIONS_FOR_LENGTH,
  QUESTION_BANK,
  type Difficulty,
  type PrepTrack,
  type QuestionBankEntry,
  type SessionFormat,
  type SessionLength,
  type TranscriptTurn,
} from "./prep-data";
import { scoreDisplayOf } from "@/app/lib/voice/mapSession";

/** Same recipe as ats-stub.ts's hash01: a stable number in [0, 1) for a seed, never `Math.random()`. */
function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const x = Math.sin(h) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Preparedness score — straight from the brief's §3 formula.
// ---------------------------------------------------------------------------

const RECENCY_WEIGHTS = [0.55, 0.3, 0.15];

/**
 * How far your prep checklist alone can carry a track. Practice is what this
 * feature is for, so finishing every action without ever running a session
 * tops out well short of "ready" — but it must not read as zero either.
 */
const ACTIONS_ONLY_CEILING = 40;

/**
 * The track's readiness, 0-100: its last three scored sessions (the service's
 * grades, newest weighted most) lifted by the share of its plan tasks done.
 *
 * Only full scores count. A provisional one rests on a session too short to
 * charge (SCORE_RULES in app/lib/voice/types.ts) and a session without a score
 * has none to give; the hub still shows both, labelled.
 */
export function computePreparedness(track: PrepTrack): number {
  const total = track.actions.length;
  const c = total === 0 ? 0 : track.actions.filter((a) => a.done).length / total;
  const scored = track.sessions.filter((session) => scoreDisplayOf(session).kind === "scored");

  // No scored practice yet — the checklist is the only evidence there is.
  if (scored.length === 0) return Math.round(c * ACTIONS_ONLY_CEILING);

  const recent = scored.slice(-3).reverse();
  const w = RECENCY_WEIGHTS.slice(0, recent.length);
  const wSum = w.reduce((a, b) => a + b, 0);
  const s = recent.reduce((sum, session, i) => sum + session.overallScore * (w[i] / wSum), 0);
  return Math.round(s + (100 - s) * c);
}

// ---------------------------------------------------------------------------
// Question selection for a live session — cycles through the format's bank
// (only 6 entries each) rather than requiring a huge upfront bank for the
// 25-minute / 10-question tier. The starting offset is seeded so the same
// track+format doesn't always open on question #1.
// ---------------------------------------------------------------------------

export function pickQuestionsForSession(formats: SessionFormat[], lengthMinutes: SessionLength, seed: string): QuestionBankEntry[] {
  const chosen = formats.length > 0 ? formats : (["behavioural"] as SessionFormat[]);
  const count = QUESTIONS_FOR_LENGTH[lengthMinutes];

  // Round-robin across the selected formats so a multi-format session actually
  // alternates rather than running all of one and then all of the next — the
  // switching is the point of picking more than one.
  const cursors = chosen.map((f) => Math.floor(hash01(`${seed}:${f}`) * QUESTION_BANK[f].length));
  const out: QuestionBankEntry[] = [];
  for (let i = 0; i < count; i++) {
    const fi = i % chosen.length;
    const bank = QUESTION_BANK[chosen[fi]];
    out.push(bank[cursors[fi] % bank.length]);
    cursors[fi]++;
  }
  return out;
}

/**
 * What the live screen hands back when a session ends without the service
 * having saved it (it could not be created, or the connection never came up).
 * Nothing grades it: the live page says so and returns to the track.
 */
export interface SessionInput {
  trackId: string;
  formats: SessionFormat[];
  difficulty: Difficulty;
  lengthMinutes: SessionLength;
  /** Full turn-by-turn transcript, AI questions and user answers interleaved. */
  transcript: TranscriptTurn[];
  elapsedSeconds: number;
}

export { FORMAT_META };
