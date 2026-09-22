// Application answers — the frontend's copy of the contract.
//
// The AI service owns it: remoteworldwideai/src/types/answers.ts. A saved
// answer on the wire is exactly `QaItem` (app/lib/dashboard/types.ts); the
// shapes below are mirrored field for field, and the AI service's
// tests/contracts/answers-types.test.ts fails when the two drift.
//
// `usedAt` and `lastUsedAt` stay ISO strings: they are not in `revive`'s
// DATE_KEYS (app/lib/api/core.ts), and the screen only formats them.

import type { QaItem } from "@/app/lib/dashboard/types";

/** How a review is settled: keep the saved wording, or take the draft. */
export const ANSWER_RESOLVE_CHOICES = ["mine", "draft"] as const;
export type AnswerResolveChoice = (typeof ANSWER_RESOLVE_CHOICES)[number];

export interface CreateAnswerInput {
  q: string;
  a: string;
  cat?: QaItem["cat"];
}

/** `draft` is for Undo after a resolve: a string makes the answer a review again, null clears it. */
export interface UpdateAnswerInput {
  a?: string;
  cat?: QaItem["cat"];
  draft?: string | null;
}

export interface ResolveAnswerInput {
  choice: AnswerResolveChoice;
}

export interface DeleteAnswerResult {
  deleted: true;
}

/** One question answered on one application, as it went out at the time. */
export interface AnswerUseItem {
  question: string;
  answer: string;
  cat: QaItem["cat"];
  /** The library answer to the same question today, or null when the library has none. */
  answerId: string | null;
  usedAt: string;
}

/** Every answer used on one application, most recently used application first. */
export interface AnswerHistoryItem {
  /** A backend application id for the app's own flows; free text from the extension. */
  applicationId: string;
  lastUsedAt: string;
  /** In the order the form asked them. */
  uses: AnswerUseItem[];
}

/** For a flow that fills answers before the application exists, and records them once it does. */
export interface RecordAnswerUsesInput {
  applicationId: string;
  answers: Array<{ question: string; answer: string }>;
}

export interface RecordAnswerUsesResult {
  recorded: number;
}

/** What a create answers with: the new row, or the one already saved for that question. */
export type AddAnswerResult = { added: true; item: QaItem } | { added: false; existing: QaItem };
