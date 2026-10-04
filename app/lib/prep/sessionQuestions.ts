// Which questions a live mock interview asks.
//
// A track with likely questions — written for it from its posting's
// requirements and the resume (./api.ts `generateLikelyQuestions`) — is
// interviewed on those. The general bank (prep-data.ts QUESTION_BANK) was
// written for design and engineering roles, so an accountant prepping for an
// accounting job was being asked about pushing back on engineering constraints
// while the track's own accounting questions sat unused on its Overview. The
// bank now only fills a session the track's set is too small for, and asks the
// whole session only when the track has no set yet, or none in the formats
// picked.
//
// A set is never written from here: it costs a credit, so it is only ever
// written from a click on the track. A stale set (the posting or the resume
// changed since) is still this job's questions, and is used as it is.
//
// Pure: no React, no fetching. The live screen freezes the result at mount.
// The engine interviewer reads it from the session snapshot the service
// stores; the recorded web-speech path and the unsaved fallback ask it from
// the screen itself. The setup screen runs the same pick to say what's coming.

import { pickQuestionsForSession } from "@/app/lib/dashboard/prep-engine";
import { QUESTIONS_FOR_LENGTH, type Difficulty, type QuestionBankEntry, type SessionFormat, type SessionLength } from "@/app/lib/dashboard/prep-data";
import type { LikelyQuestion } from "./types";

export interface SessionQuestion {
  id: string;
  /** Read out word for word, by the browser or by the engine: never shortened. */
  text: string;
  /** The line under the question on the live screen: what it tests. */
  sub: string;
  /** Written for this track from its posting. False for a question from the general bank. */
  tailored: boolean;
}

/**
 * What the AI service accepts for one of the snapshot's questions: its
 * create validator (remoteworldwideai src/validators/prep.validator.ts
 * `checkPrep`, CLIENT_ID_PATTERN and QUESTION_TEXT_MAX) and the session
 * model's own maxlength. One outside them fails the whole create.
 */
const SNAPSHOT_QUESTION_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const SNAPSHOT_QUESTION_TEXT_MAX = 1_000;

/**
 * A likely question the service would take as it is. One that would be refused
 * is skipped, never cut to fit: the interviewer reads the stored text out
 * verbatim, and the live screen finds the question in the interviewer's line
 * by that same text, so a shortened copy would be asked half-finished and
 * then never recognised as asked. The generator caps a question at 300
 * characters and makes 16-character hex ids, so today nothing is skipped.
 */
function fitsSnapshot(q: LikelyQuestion): boolean {
  const text = q.text.trim();
  return SNAPSHOT_QUESTION_ID.test(q.id) && text.length > 0 && text.length <= SNAPSHOT_QUESTION_TEXT_MAX;
}

/** Each item once, keeping the first: a bank rotation cycles, and a session asks nothing twice. */
function distinct<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** The track's likely questions a session can ask, each once, in the order the track lists them. */
export function usableLikelyQuestions(likely: readonly LikelyQuestion[] | null | undefined): LikelyQuestion[] {
  return distinct((likely ?? []).filter(fitsSnapshot));
}

function fromLikely(q: LikelyQuestion): SessionQuestion {
  // Trimmed as the service trims it when it stores the snapshot, so the text
  // read here, the text stored and the text the engine says are one string.
  return { id: q.id, text: q.text.trim(), sub: q.why || (q.requirement ? `Probes: ${q.requirement}` : ""), tailored: true };
}

function fromBank(entry: QuestionBankEntry): SessionQuestion {
  return { id: entry.id, text: entry.text, sub: entry.sub, tailored: false };
}

export interface PickSessionQuestionsInput {
  formats: SessionFormat[];
  /** The preset whose question count the session asks: the chosen length, or the shorter one a partial balance covers. */
  lengthMinutes: SessionLength;
  /** Where the bank's rotation starts for this track, formats and length. */
  seed: string;
  /** The track's stored likely questions; null or empty when it has none (or no track). */
  likely: readonly LikelyQuestion[] | null | undefined;
  /** How much of the session presses on the resume, and whether the sharpest questions go first. Standard when not given. */
  difficulty?: Difficulty;
}

/**
 * The share of a session's likely questions led by the resume (owner,
 * 2026-10-04): about 60% from what the job requires and 40% from the resume,
 * half and half at tough. The rest is led by the posting.
 */
const RESUME_SHARE: Record<Difficulty, number> = { "warm-up": 0.4, standard: 0.4, tough: 0.5 };

/**
 * One format's likely questions in the order this difficulty asks them: tough
 * the sharp ones first, warm-up the sharp ones last, standard as the track
 * lists them. Stable, so a set written before questions were marked keeps its order.
 */
function byPressure(questions: readonly LikelyQuestion[], difficulty: Difficulty): LikelyQuestion[] {
  if (difficulty === "standard") return [...questions];
  const first = difficulty === "tough";
  return [...questions.filter((q) => q.sharp === first), ...questions.filter((q) => q.sharp !== first)];
}

/**
 * Asked in every interview, whatever the role or format (owner, 2026-10-04):
 * the opener first and the closer last. Marked tailored, so a session written
 * for the job never labels them "general practice".
 */
export const OPENING_QUESTION: SessionQuestion = {
  id: "core:tell-me-about-yourself",
  text: "Tell me about yourself.",
  sub: "Every interview opens here: who you are and why this role",
  tailored: true,
};
export const CLOSING_QUESTION: SessionQuestion = {
  id: "core:why-should-we-hire-you",
  text: "Why should we hire you?",
  sub: "Every interview closes here: your case, in a few lines",
  tailored: true,
};
/** A picked question that is one of the two already: not asked twice. */
const CORE_QUESTION = /\btell me about yourself\b|\bwhy should (?:we|i|they) hire you\b/i;

/**
 * The session's questions, in the order they are asked: the opener, the
 * role's own (`pickRoleQuestions`), then the closer, the same count in all as
 * the length asks for.
 */
export function pickSessionQuestions(input: PickSessionQuestionsInput): SessionQuestion[] {
  const count = QUESTIONS_FOR_LENGTH[input.lengthMinutes];
  const middle = pickRoleQuestions(input)
    .filter((q) => !CORE_QUESTION.test(q.text))
    .slice(0, Math.max(1, count - 2));
  return [OPENING_QUESTION, ...middle, CLOSING_QUESTION];
}

/**
 * The role's questions, in the order they are asked.
 *
 * With likely questions in the chosen formats:
 *  - Only the chosen formats: a salary drill is not handed a behavioural question.
 *  - As many as the length calls for (QUESTIONS_FOR_LENGTH, the bank path's
 *    own count); a longer set is trimmed from the end.
 *  - Alternating between the chosen formats in the order they were picked, as
 *    the bank path does (switching is the point of picking more than one), and
 *    within a format in the order the track lists them — the ones the
 *    Overview shows first are the ones asked first — except that tough asks
 *    the sharp ones first and warm-up last (`byPressure`).
 *  - Led by the posting or the resume in the difficulty's share (`RESUME_SHARE`),
 *    spread through the session: each slot takes its format's next question
 *    of the basis the share calls for, else its next of the other. A set
 *    written before questions said what led them is asked in its own order.
 *  - Too few: the rest is filled from the bank, marked `tailored: false`, and
 *    asked last. A session often ends before its last question (the chosen
 *    length's time limit, a balance that covers fewer minutes, ending early),
 *    so this job's own questions go first. Each fill goes to the chosen format
 *    the session has fewest questions in so far, so a picked format the set
 *    has none of is still asked; it takes that format's next question in the
 *    rotation the bank path would have used. Nothing is asked twice: when the
 *    chosen formats' bank runs out too, the session is shorter.
 *
 * With none (no set yet, none in the chosen formats, or no track): the bank
 * path exactly as before.
 */
function pickRoleQuestions({ formats, lengthMinutes, seed, likely, difficulty = "standard" }: PickSessionQuestionsInput): SessionQuestion[] {
  const chosen: SessionFormat[] = formats.length > 0 ? formats : ["behavioural"];
  const count = QUESTIONS_FOR_LENGTH[lengthMinutes];

  const usable = usableLikelyQuestions(likely).filter((q) => !CORE_QUESTION.test(q.text));
  const queues = chosen.map((format) => byPressure(usable.filter((q) => q.format === format), difficulty));
  const share = RESUME_SHARE[difficulty];
  const tailored: LikelyQuestion[] = [];
  let fromResume = 0;
  // The formats in turn, skipping one that has run out, as the bank path alternates them.
  for (let turn = 0; tailored.length < count && queues.some((queue) => queue.length > 0); turn++) {
    const queue = queues[turn % queues.length];
    if (queue.length === 0) continue;
    // A resume-led question whenever the session has fallen below the share: P P R P R for 40%, P R P R for half.
    const wantResume = Math.floor((tailored.length + 1) * share) > fromResume;
    const at = queue.findIndex((q) => (q.basis === "resume") === wantResume);
    const [picked] = queue.splice(at >= 0 ? at : 0, 1);
    tailored.push(picked);
    if (picked.basis === "resume") fromResume += 1;
  }
  if (tailored.length === 0) return pickQuestionsForSession(chosen, lengthMinutes, seed).map(fromBank);

  const out = tailored.map(fromLikely);
  const have = new Map(chosen.map((format) => [format, tailored.filter((q) => q.format === format).length]));
  // Each format's rotation on its own: the same seeded start the bank path gives it for this session.
  const rotation = new Map(chosen.map((format) => [format, distinct(pickQuestionsForSession([format], lengthMinutes, seed))]));
  const next = new Map(chosen.map((format) => [format, 0]));
  while (out.length < count) {
    const open = chosen.filter((format) => (next.get(format) ?? 0) < (rotation.get(format)?.length ?? 0));
    if (open.length === 0) break;
    // Fewest so far; on a tie, the one picked first.
    const format = open.reduce((best, f) => ((have.get(f) ?? 0) < (have.get(best) ?? 0) ? f : best));
    const at = next.get(format) ?? 0;
    const entry = rotation.get(format)?.[at];
    next.set(format, at + 1);
    if (!entry || out.some((q) => q.id === entry.id)) continue;
    out.push(fromBank(entry));
    have.set(format, (have.get(format) ?? 0) + 1);
  }
  return out;
}
