// One answer at a time, as the report's tabs show it: which question it
// answered, the flags and notes the analysis left on its words, and the
// stronger version. Shared by Overall's "Question by question" and the
// Transcript, so the two always say the same about the same answer. Nothing is
// judged here: every flag and note is one the AI service wrote.

import type { DimensionScore, Rewrite, TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import type { DictionSection } from "@/app/lib/voice/types";

export interface ReportAnswer {
  turnId: string;
  /** 1-based, in the order the answers were given. */
  index: number;
  questionId: string | null;
  /** The question it answered, from the session's questions, else the interviewer's line before it. */
  question: string | null;
  text: string;
  startMs?: number;
  endMs?: number;
}

/** A phrase the analysis left a note on: underlined in the transcript, a "Say instead" on hover. */
export interface AnswerNote {
  id: string;
  /** The candidate's words, as quoted. */
  quote: string;
  /** What kind of note: the flag it supports ("No numbers or concrete details") or the diction kind. */
  label: string;
  /** The same point said better, when the analysis wrote one. */
  sayInstead: string | null;
  /** Why, in a line. */
  tip: string | null;
  atMs?: number;
}

export interface SessionQuestionRef {
  id: string;
  text: string;
}

/** Words only, for matching a quote against an answer however it was punctuated. */
export const wordsKey = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim();

/** The candidate's answers with words in them, in order. */
export function reportAnswers(turns: readonly TranscriptTurn[], questions: readonly SessionQuestionRef[] = []): ReportAnswer[] {
  const byId = new Map(questions.map((q) => [q.id, q.text]));
  const answers: ReportAnswer[] = [];
  let lastAsked: string | null = null;
  for (const turn of turns) {
    if (turn.who === "ai") {
      lastAsked = turn.text;
      continue;
    }
    if (!turn.text.trim()) continue;
    answers.push({
      turnId: turn.id,
      index: answers.length + 1,
      questionId: turn.questionId ?? null,
      question: (turn.questionId ? byId.get(turn.questionId) : undefined) ?? lastAsked,
      text: turn.text,
      startMs: turn.startMs,
      endMs: turn.endMs,
    });
  }
  return answers;
}

/** The session's questions no answer names, in order: what "Pick up from this question" and "Not answered" are about. */
export function unansweredQuestions(questions: readonly SessionQuestionRef[], turns: readonly TranscriptTurn[]): Array<SessionQuestionRef & { index: number }> {
  const answered = new Set(turns.filter((turn) => turn.who === "user" && turn.questionId && turn.text.trim()).map((turn) => turn.questionId));
  return questions.map((q, i) => ({ ...q, index: i + 1 })).filter((q) => !answered.has(q.id));
}

/**
 * The flag each weak dimension raises on an answer it found evidence in: the
 * chips under an answer. A dimension scored 6 or more raises none.
 */
const FLAG_FOR: Record<string, string> = {
  specifics: "No numbers or concrete details",
  structure: "Jumped to the result",
  relevance: "Drifted from the question",
  ownership: "Said \"we\" more than \"I\"",
  confidence: "Hedged the answer",
  pace: "Pace got in the way",
};
const WEAK_BELOW = 6;
const MAX_FLAGS = 3;

/** Whether an evidence item or finding is about this answer: its quote is in the answer, or it names the answer's question. */
const isAbout = (answer: ReportAnswer, item: { quote: string; question?: string; turnId?: string }): boolean => {
  if (item.turnId) return item.turnId === answer.turnId;
  const quote = wordsKey(item.quote);
  if (quote && wordsKey(answer.text).includes(quote)) return true;
  return Boolean(item.question && answer.question && wordsKey(item.question) === wordsKey(answer.question));
};

/** The flags on an answer, weakest dimension first, at most three. */
export function flagsFor(answer: ReportAnswer, dimensions: readonly DimensionScore[]): string[] {
  return [...dimensions]
    .filter((d) => d.score < WEAK_BELOW && FLAG_FOR[d.id] && d.evidence.some((item) => isAbout(answer, item)))
    .sort((a, b) => a.score - b.score)
    .map((d) => FLAG_FOR[d.id])
    .slice(0, MAX_FLAGS);
}

const DICTION_LABEL: Record<string, string> = {
  grammar: "Grammar",
  "word-choice": "Word choice",
  hedging: "Hedging",
  repetition: "Repetition",
  fillers: "Filler words",
  concision: "Could be shorter",
};

/** The notes on an answer's words: the scorecard's evidence and the diction findings, each quote once. */
export function notesFor(answer: ReportAnswer, dimensions: readonly DimensionScore[], diction?: DictionSection | null): AnswerNote[] {
  const notes: AnswerNote[] = [];
  const seen = new Set<string>();
  const add = (note: AnswerNote) => {
    const key = wordsKey(note.quote);
    if (!key || seen.has(key) || !wordsKey(answer.text).includes(key)) return;
    seen.add(key);
    notes.push(note);
  };
  for (const finding of diction?.findings ?? []) {
    if (!isAbout(answer, finding)) continue;
    add({
      id: `diction:${finding.id}`,
      quote: finding.quote,
      label: DICTION_LABEL[finding.kind] ?? "Word choice",
      sayInstead: finding.suggestion?.trim() || null,
      tip: finding.note?.trim() || null,
      atMs: finding.atMs,
    });
  }
  for (const dimension of dimensions) {
    for (const item of dimension.evidence) {
      if (!isAbout(answer, item)) continue;
      add({
        id: `evidence:${dimension.id}:${item.id}`,
        quote: item.quote,
        label: FLAG_FOR[dimension.id] && dimension.score < WEAK_BELOW ? FLAG_FOR[dimension.id] : dimension.label,
        sayInstead: item.fix?.trim() || null,
        tip: item.note?.trim() || null,
        atMs: item.atMs,
      });
    }
  }
  return notes;
}

/** The stronger version of an answer: the rewrite for its question, else the one spoken inside its window. */
export function rewriteFor(answer: ReportAnswer, rewrites: readonly Rewrite[]): Rewrite | null {
  const question = answer.question ? wordsKey(answer.question) : "";
  const byQuestion = question ? rewrites.find((r) => wordsKey(r.question) === question) : undefined;
  if (byQuestion) return byQuestion;
  if (answer.startMs === undefined || answer.endMs === undefined) return null;
  return rewrites.find((r) => r.atMs !== undefined && r.atMs >= answer.startMs! - 1_000 && r.atMs <= answer.endMs!) ?? null;
}
