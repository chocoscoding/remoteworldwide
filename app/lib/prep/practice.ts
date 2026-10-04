// A practice session started from a report, on questions the report chose:
// "Answer this one again", "Pick up from this question", a positioning
// criterion's "Practise" and "Practise all". The questions go to the live page
// through sessionStorage under a one-off key named in the address, so a long
// question never rides in the URL, and the live page asks exactly these in
// place of its usual pick (PrepLive `fixedQuestions`).

import { SESSION_LENGTHS, type SessionFormat, type SessionLength } from "@/app/lib/dashboard/prep-data";
import type { SessionConfig } from "@/app/components/dashboard/prep/PrepSetup";
import type { SessionQuestion } from "./sessionQuestions";

/** One question to practise. `id` must suit the snapshot (letters, digits, `_.:-`, 128 at most): `practiceQuestionId` makes one. */
export interface PracticeQuestion {
  id: string;
  text: string;
  /** The line under it on the live screen: what it tests. */
  sub?: string;
}

export interface PracticeRequest {
  trackId: string;
  questions: readonly PracticeQuestion[];
  /** The report's own setup, so the interviewer asks in the same style. */
  formats: readonly SessionFormat[];
  difficulty: SessionConfig["difficulty"];
}

/** The `?practice=` value on the live page. */
export const PRACTICE_PARAM = "practice";
const STORAGE_PREFIX = "rww.prep-practice:";
/** What the AI service takes for a snapshot question (its CLIENT_ID_PATTERN and QUESTION_TEXT_MAX). */
const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;
const TEXT_MAX = 1_000;
/** The service's PREP_LIMITS.questionsMax. */
const QUESTIONS_MAX = 30;

/** A snapshot-safe id from anything (a criterion name, a question id with odd characters). */
export const practiceQuestionId = (seed: string): string => {
  const id = `practice:${seed.toLowerCase().replace(/[^a-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "")}`.slice(0, 128);
  return ID_PATTERN.test(id) ? id : `practice:${Math.random().toString(36).slice(2, 10)}`;
};

/** The shortest session length that gives every question time: about three minutes each. */
export const practiceLength = (count: number): SessionLength =>
  SESSION_LENGTHS.find((minutes) => minutes >= Math.max(1, count) * 3) ?? SESSION_LENGTHS[SESSION_LENGTHS.length - 1];

/** The questions the service will take: snapshot-safe, each once, at most QUESTIONS_MAX. */
const usable = (questions: readonly PracticeQuestion[]): PracticeQuestion[] => {
  const seen = new Set<string>();
  const kept: PracticeQuestion[] = [];
  for (const question of questions) {
    const text = question.text.trim();
    if (!ID_PATTERN.test(question.id) || !text || text.length > TEXT_MAX || seen.has(question.id)) continue;
    seen.add(question.id);
    kept.push({ id: question.id, text, sub: question.sub });
  }
  return kept.slice(0, QUESTIONS_MAX);
};

/**
 * The live page's address for practising `request.questions`, with the
 * questions handed over in sessionStorage. Null when none can be asked or the
 * storage is unavailable (a private window): the caller says so rather than
 * starting a session on other questions.
 */
export function practiceHref(request: PracticeRequest): string | null {
  const questions = usable(request.questions);
  if (questions.length === 0 || request.formats.length === 0) return null;
  const key = Math.random().toString(36).slice(2, 12);
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(questions));
  } catch {
    return null;
  }
  const params = new URLSearchParams({
    format: request.formats.join(","),
    difficulty: request.difficulty,
    length: String(practiceLength(questions.length)),
    [PRACTICE_PARAM]: key,
  });
  return `/dashboard/prep/${encodeURIComponent(request.trackId)}/live?${params.toString()}`;
}

/** The questions a `?practice=` key names, as the live screen asks them; null when the key is unknown or unreadable. */
export function readPracticeQuestions(key: string | null): SessionQuestion[] | null {
  if (!key) return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const questions = usable(
      parsed.filter(
        (item): item is PracticeQuestion =>
          typeof item === "object" && item !== null && typeof (item as PracticeQuestion).id === "string" && typeof (item as PracticeQuestion).text === "string"
      )
    );
    return questions.length > 0 ? questions.map((q) => ({ id: q.id, text: q.text, sub: q.sub ?? "", tailored: true })) : null;
  } catch {
    return null;
  }
}
