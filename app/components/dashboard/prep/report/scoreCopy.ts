// How a report's score reads in words: the header's one line, the Overall
// tab's notice, and the amounts it rests on.
//
// Whether there is a score, and whether it is provisional, is mapSession's
// `scoreDisplayOf`, the one answer the hub reads too; this file only says why,
// so the two can never disagree about the number. Every figure quoted is the
// session's own (`scoreEvidence`) or the service's rule (`SCORE_RULES`), never
// a number written here.

import type { PrepSession } from "@/app/lib/dashboard/prep-data";
import { formatDuration } from "@/app/lib/voice/format";
import type { ScoreDisplay } from "@/app/lib/voice/mapSession";
import { SCORE_RULES, type ScoreEvidence } from "@/app/lib/voice/types";

type ScoreFacts = Pick<PrepSession, "scoreReason" | "scoreEvidence" | "dimensions" | "unscoredDimensions" | "transcript" | "mode" | "tooShort">;

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A report from before the evidence gates: it carries no `scoreEvidence`. Its
 * too-short sessions were graded at every dimension's floor, so the report
 * shows why there is no score and nothing from the scorecard.
 */
export const isLegacyTooShort = (session: Pick<PrepSession, "scoreEvidence" | "tooShort">): boolean => !session.scoreEvidence && session.tooShort;

/**
 * Why there is no overall score, from the gates: too few dimensions judged, or
 * enough of them but too few about what was said (`minContentDimensions`).
 */
function missingScoreReason(evidence: ScoreEvidence, total: number): { short: string; long: string } {
  const { scoredDimensions: judged } = evidence;
  // "1 of 6 parts", but "1 part" on its own.
  const some = total > judged ? `${judged} of ${total} parts` : count(judged, "part");
  if (judged < SCORE_RULES.minScoredDimensions) {
    return {
      short: judged === 0 ? "no part of the scorecard had enough to judge" : `only ${some} of the scorecard had enough to judge`,
      long: `${judged === 0 ? "No part" : `Only ${some}`} of the scorecard had enough of your answers to judge, and an overall score needs at least ${SCORE_RULES.minScoredDimensions}.`,
    };
  }
  return {
    short: "too little about what you said could be judged",
    long: `${count(judged, "part")} of the scorecard could be judged, but an overall score also needs at least ${SCORE_RULES.minContentDimensions} of them to be about what you said (how your answers were built and what was in them), and this session had fewer.`,
  };
}

/** Why a score is provisional: the charge rule it fell under, with the session's own amount. */
function provisionalReason(session: ScoreFacts): { short: string; long: string } {
  const evidence = session.scoreEvidence ?? null;
  switch (session.scoreReason) {
    case "few-answers":
      return evidence
        ? {
            short: `based on only ${count(evidence.answers, "answer")}`,
            long: `It rests on ${evidence.answers === 0 ? "no answers" : `only ${count(evidence.answers, "answer")}`}, and a full score needs at least ${SCORE_RULES.minAnswers}.`,
          }
        : { short: "based on too few answers", long: `It rests on fewer than ${SCORE_RULES.minAnswers} answers, which a full score needs.` };
    case "little-speech":
      return evidence && evidence.speechMs !== null
        ? {
            short: `based on only ${formatDuration(evidence.speechMs)} of your voice`,
            long: `It rests on only ${formatDuration(evidence.speechMs)} of your voice, and a full score needs ${formatDuration(SCORE_RULES.minSpeechMs)}. Pauses and silence inside an answer don't count towards it.`,
          }
        : { short: "based on too little of your voice", long: `It rests on less than ${formatDuration(SCORE_RULES.minSpeechMs)} of your voice, which a full score needs.` };
    case "few-words":
      // The rule counts every typed word; the evidence counts the words that
      // carry an answer (fillers aside). Under the rule, both are short of it.
      return evidence
        ? {
            short: `based on only ${count(evidence.contentWords, "word")} of typed answer`,
            long: `Your typed answers came to ${count(evidence.contentWords, "word")} of real answer, and a full score needs at least ${SCORE_RULES.minTypedWords} words.`,
          }
        : { short: "based on too few typed words", long: `Your typed answers came to fewer than ${SCORE_RULES.minTypedWords} words, which a full score needs.` };
    default:
      return { short: "the session was too short for a full score", long: "The session was too short for a full score." };
  }
}

/**
 * The header's line under a score that isn't a full one: "Provisional — based
 * on only 12 s of your voice", "Not scored — only 3 of 6 parts of the
 * scorecard had enough to judge". Null for a full score. The hub says
 * "provisional" and "not scored" for the same sessions (both read
 * `scoreDisplayOf`); this adds the reason.
 */
export function scoreHeadline(display: ScoreDisplay, session: ScoreFacts): string | null {
  if (display.kind === "scored") return null;
  if (display.kind === "provisional") return `Provisional — ${provisionalReason(session).short}`;
  if (isLegacyTooShort(session)) return "Not scored — the session was too short to score";
  const evidence = session.scoreEvidence;
  if (!evidence) return "Not scored — there wasn't enough to judge";
  return `Not scored — ${missingScoreReason(evidence, session.dimensions.length + (session.unscoredDimensions?.length ?? 0)).short}`;
}

/** The Overall tab's explanation of a provisional or missing score, in full sentences. Null for a full score. */
export function scoreExplanation(display: ScoreDisplay, session: ScoreFacts): string | null {
  if (display.kind === "scored") return null;
  if (display.kind === "provisional") {
    return `${provisionalReason(session).long} So treat the score as a first read rather than a verdict: it doesn't count towards how prepared you are.`;
  }
  if (isLegacyTooShort(session)) return legacyTooShortReason(session);
  const evidence = session.scoreEvidence;
  if (!evidence) return "There wasn't enough in your answers to judge.";
  return missingScoreReason(evidence, session.dimensions.length + (session.unscoredDimensions?.length ?? 0)).long;
}

/**
 * What the verdict rests on, as one line: "3 answers (2 long enough to judge)
 * · 42 words of real answer · 12 s of your voice". Null on a report from
 * before the gates, which doesn't carry it.
 */
export function evidenceSummary(evidence: ScoreEvidence | null | undefined): string | null {
  if (!evidence) return null;
  const answers =
    evidence.substantiveAnswers < evidence.answers ? `${count(evidence.answers, "answer")} (${evidence.substantiveAnswers} long enough to judge)` : count(evidence.answers, "answer");
  const parts = [answers, `${count(evidence.contentWords, "word")} of real answer`];
  if (evidence.speechMs !== null) parts.push(`${formatDuration(evidence.speechMs)} of your voice`);
  return parts.join(" · ");
}

/**
 * Why a report from before the gates wasn't scored. It carries no evidence,
 * so answers are counted the way the service counts them (a turn of yours
 * with words in it, answering a question); with enough answers the miss can
 * only be the other floor, too little of your own voice or too few typed
 * words, and the report doesn't say how much there was.
 */
function legacyTooShortReason(session: Pick<PrepSession, "transcript" | "mode">): string {
  const answered = session.transcript.filter((t) => t.who === "user" && t.text.trim() !== "" && t.questionId).length;
  if (answered === 0) return `No question got an answer, and scoring needs at least ${SCORE_RULES.minAnswers} answers.`;
  const questions = answered === 1 ? "one question" : `${answered} questions`;
  if (answered < SCORE_RULES.minAnswers) return `You answered ${questions}, and scoring needs at least ${SCORE_RULES.minAnswers} answers.`;
  if (session.mode === "text") {
    return `You answered ${questions}, but in fewer than ${SCORE_RULES.minTypedWords} words between them, and scoring needs at least that many to be worth anything.`;
  }
  return `You answered ${questions}, but they held less than ${formatDuration(SCORE_RULES.minSpeechMs)} of you speaking, and scoring needs at least that much to be worth anything. Pauses and silence inside an answer don't count towards it.`;
}
