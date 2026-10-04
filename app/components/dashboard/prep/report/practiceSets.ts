// Which questions a practice session started from the report asks. Every
// button that practises ("Answer this one again", "Pick up from this
// question", a criterion's "Practise", "Practise all") picks its questions
// here, and the page turns them into a live session with practiceHref.
//
// Pure: no React, no browser.

import type { TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import { practiceQuestionId, type PracticeQuestion } from "@/app/lib/prep/practice";
import { askedQuestion } from "@/app/lib/voice/format";
import type { PositioningCriterion } from "@/app/lib/voice/types";
import { reportAnswers, unansweredQuestions, wordsKey, type ReportAnswer, type SessionQuestionRef } from "./answerNotes";

/**
 * The session's questions no answer reached, in order. An answer names its
 * question by id; an older answer without one counts when the line it
 * replied to holds the question's words, so a session from before the ids
 * doesn't list every question as missed.
 */
export function notReached(questions: readonly SessionQuestionRef[], turns: readonly TranscriptTurn[]): Array<SessionQuestionRef & { index: number }> {
  const asked = reportAnswers(turns, questions)
    .map((answer) => (answer.question ? wordsKey(answer.question) : ""))
    .filter((key) => key !== "");
  return unansweredQuestions(questions, turns).filter((q) => {
    const key = wordsKey(q.text);
    return key === "" || !asked.some((line) => line.includes(key));
  });
}

/**
 * "Pick up from this question": that question, then every later one the
 * session didn't reach, in order. Empty when the id isn't one of the
 * session's questions.
 */
export function pickUpFrom(questions: readonly SessionQuestionRef[], turns: readonly TranscriptTurn[], questionId: string): PracticeQuestion[] {
  const start = questions.findIndex((q) => q.id === questionId);
  if (start < 0) return [];
  const open = new Set(notReached(questions, turns).map((q) => q.id));
  return questions
    .slice(start)
    .filter((q, i) => i === 0 || open.has(q.id))
    .map((q) => ({ id: q.id, text: q.text }));
}

/**
 * The question an answer replied to, as the reader should see it: the
 * session's own wording when the answer names it, else the question inside
 * the interviewer's line (without the "Thanks, that's clear." before it).
 */
export function answerQuestionText(answer: Pick<ReportAnswer, "questionId" | "question">, questions: readonly SessionQuestionRef[]): string | null {
  const named = answer.questionId ? questions.find((q) => q.id === answer.questionId) : undefined;
  if (named) return named.text;
  const asked = answer.question ? askedQuestion(answer.question).trim() : "";
  return asked || null;
}

/** "Answer this one again": the one question, under its own id when the session gave it one. */
export function answerAgain(answer: Pick<ReportAnswer, "turnId" | "questionId" | "question">, questions: readonly SessionQuestionRef[]): PracticeQuestion | null {
  const named = answer.questionId ? questions.find((q) => q.id === answer.questionId) : undefined;
  if (named) return { id: named.id, text: named.text };
  const text = answerQuestionText(answer, questions);
  return text ? { id: practiceQuestionId(`answer-${answer.turnId}`), text } : null;
}

/** A positioning criterion's practice question: its probe, asked the way an interviewer would. */
export function criterionQuestion(criterion: Pick<PositioningCriterion, "id" | "label" | "probe">): PracticeQuestion | null {
  const text = criterion.probe.example.trim();
  return text ? { id: practiceQuestionId(criterion.id), text, sub: criterion.label } : null;
}

/** "Practise all": every criterion not already strong, in the section's order. */
export function criteriaToPractise(criteria: readonly Pick<PositioningCriterion, "id" | "label" | "probe" | "level">[]): PracticeQuestion[] {
  return criteria
    .filter((c) => c.level !== "strong")
    .map(criterionQuestion)
    .filter((q): q is PracticeQuestion => q !== null);
}
