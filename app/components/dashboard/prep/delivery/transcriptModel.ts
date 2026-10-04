// The Transcript tab as data: the rows in order (interviewer lines, answers,
// speech between answers, and where a question was left unanswered), each
// answer's words with their times, the phrases the analysis left a note on,
// and the filler words. Pure: no React, no DOM.
//
// Notes, flags and rewrites come from report/answerNotes, which Overall's
// "Question by question" reads too, so the two tabs say the same about the
// same answer. Nothing is judged here except which words are fillers.

import {
  flagsFor,
  notesFor,
  reportAnswers,
  rewriteFor,
  unansweredQuestions,
  wordsKey,
  type AnswerNote,
  type SessionQuestionRef,
} from "@/app/components/dashboard/prep/report/answerNotes";
import { withoutEmDashes } from "@/app/lib/apply/score";
import type { DimensionScore, Rewrite, TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import { withoutAudioTags } from "@/app/lib/voice/audioTags";
import type { DeliveryTranscriptSegment, DeliveryTranscriptWord, DictionSection } from "@/app/lib/voice/types";

/** A stretch stays lit this long after its last word, so short gaps don't flicker. */
export const STRETCH_TAIL_MS = 300;
/** Words are matched to a segment within this much of its edges. */
const WORD_SLACK_MS = 60;
/** How far ahead in the word list the matcher looks for a token before giving up on it. */
const MATCH_LOOKAHEAD = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WordTime {
  s: number;
  e: number;
}

/**
 * One piece of the text as written: a word with the punctuation stuck to it
 * ("was,"), or the space or dash between words. Only `core` lights, boxes and
 * seeks, so "uh," is boxed as "uh" with its comma outside.
 */
export interface Token {
  text: string;
  lead: string;
  core: string;
  trail: string;
  /** Index into the speech's `times`, or -1 for text that isn't a timed word. */
  word: number;
  /** The words in it as `wordsKey` writes them, for matching a note's quote. Empty for spaces and punctuation. */
  pieces: string[];
}

/** One transcript segment inside a row: lit while it is being spoken. */
export interface Stretch {
  startMs: number;
  endMs: number;
  /** Its words in `times`, inclusive; `lastWord < firstWord` when none of them was timed. */
  firstWord: number;
  lastWord: number;
}

export interface Speech {
  tokens: Token[];
  /** Word start/end times, in token order. Empty without word timings. */
  times: WordTime[];
  stretches: Stretch[];
}

export interface TokenRange {
  from: number;
  to: number;
}

/** How a row's tokens are drawn: plain, inside a filler box, or inside a phrase with a note. */
export type Piece =
  | { kind: "token"; index: number }
  | ({ kind: "filler" } & TokenRange)
  | ({ kind: "note"; note: AnswerNote; inner: Piece[] } & TokenRange);

export interface InterviewerRow {
  kind: "interviewer";
  key: string;
  text: string;
  startMs?: number;
}

export interface SpeechRow {
  kind: "speech";
  key: string;
  /** An answer, or the candidate speaking outside every answer's window. */
  role: "answer" | "between";
  /** The answer's number as the report's other tabs give it; null when it has no words. */
  number: number | null;
  speech: Speech;
  pieces: Piece[];
  fillerCount: number;
  noteCount: number;
  /** The chips under the answer (`flagsFor`). */
  flags: string[];
  /** "How you could have said it" (`rewriteFor(...).better`). */
  rewrite: string | null;
  startMs?: number;
  durationMs?: number;
  wordCount: number;
}

/** A question nobody answered: "Pick up from this question". */
export interface PickUpRow {
  kind: "pickup";
  key: string;
  questionId: string;
  /** 1-based, in the session's question order. */
  number: number;
  text: string;
  /** The interviewer asked it (its line is in the rows above); otherwise the session ended before it. */
  asked: boolean;
  /** Nothing was said after it. */
  atEnd: boolean;
}

export type TranscriptRow = InterviewerRow | SpeechRow | PickUpRow;

export interface TranscriptModel {
  rows: TranscriptRow[];
  /** Some row has word timings: words light up and can be clicked. */
  timed: boolean;
  fillers: boolean;
  notes: boolean;
}

export interface TranscriptInput {
  segments: readonly DeliveryTranscriptSegment[];
  words: readonly DeliveryTranscriptWord[];
  turns: readonly TranscriptTurn[];
  questions: readonly SessionQuestionRef[];
  dimensions: readonly DimensionScore[];
  rewrites: readonly Rewrite[];
  diction: DictionSection | null;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/**
 * Letters and digits only, so "Sure." matches "sure" and "I'd" matches "Id".
 * Latin, Greek and Cyrillic letters are kept by range: the `u` flag's `\p{L}`
 * needs an ES2018 target, and this app compiles for ES2017.
 */
const normalize = (text: string) => text.toLowerCase().replace(/[^0-9a-zÀ-ɏͰ-ϿЀ-ӿ]+/g, "");

/** Words and the spaces and hyphens between them, kept in order so the text reads exactly as written. */
const tokenize = (text: string): string[] => text.split(/(\s+|[-–—]+)/).filter((part) => part.length > 0);

/** Punctuation before, the word, punctuation after. */
const EDGES = /^([^0-9A-Za-zÀ-ɏͰ-ϿЀ-ӿ]*)(.*?)([^0-9A-Za-zÀ-ɏͰ-ϿЀ-ӿ]*)$/;

/** `wordsKey`'s words, less any stray apostrophe it keeps. */
const piecesOf = (text: string): string[] =>
  wordsKey(text)
    .split(" ")
    .filter((piece) => /[^']/.test(piece));

function makeToken(text: string, word: number): Token {
  const pieces = piecesOf(text);
  const [, lead = "", core = "", trail = ""] = EDGES.exec(text) ?? [];
  // A word in a script the edges don't cover is still a word.
  if (!core && pieces.length > 0) return { text, lead: "", core: text, trail: "", word, pieces };
  return { text, lead, core, trail, word, pieces };
}

// ---------------------------------------------------------------------------
// Words onto segments, segments onto turns
// ---------------------------------------------------------------------------

interface PreparedSegment {
  id: string;
  startMs: number;
  endMs: number;
  tokens: Token[];
  times: WordTime[];
}

/**
 * Words are matched onto each segment's own text rather than rendered from
 * the word list, because the transcript may carry punctuation on the words,
 * as separate tokens or not at all; the text is always what the user reads.
 * A word the matcher can't place is simply not clickable.
 */
function prepareSegment(segment: DeliveryTranscriptSegment, words: readonly DeliveryTranscriptWord[]): PreparedSegment {
  const times: WordTime[] = [];
  let next = 0;
  const tokens = tokenize(segment.text).map((text): Token => {
    const key = normalize(text);
    if (key) {
      for (let k = next; k < Math.min(words.length, next + MATCH_LOOKAHEAD + 1); k++) {
        if (normalize(words[k].w) !== key) continue;
        next = k + 1;
        times.push({ s: words[k].s, e: words[k].e });
        return makeToken(text, times.length - 1);
      }
    }
    return makeToken(text, -1);
  });
  return { id: segment.id, startMs: segment.startMs, endMs: segment.endMs, tokens, times };
}

type Block =
  | { kind: "ai"; turn: TranscriptTurn }
  | { kind: "answer"; turn: TranscriptTurn; segments: PreparedSegment[] }
  | { kind: "loose"; segments: PreparedSegment[] };

function buildBlocks(segments: readonly DeliveryTranscriptSegment[], words: readonly DeliveryTranscriptWord[], turns: readonly TranscriptTurn[]): Block[] {
  const sortedWords = [...words].filter((w) => Number.isFinite(w.s)).sort((a, b) => a.s - b.s);
  // Punctuation-only words carry no time worth lighting; drop them before matching.
  const spoken = sortedWords.filter((w) => normalize(w.w).length > 0);
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);

  let cursor = 0;
  const prepared = sorted.map((segment) => {
    while (cursor < spoken.length && spoken[cursor].s < segment.startMs - WORD_SLACK_MS) cursor++;
    let end = cursor;
    while (end < spoken.length && spoken[end].s < segment.endMs + WORD_SLACK_MS) end++;
    const own = spoken.slice(cursor, end);
    cursor = end;
    return { segment, prepared: prepareSegment(segment, own) };
  });

  const turnIds = new Set(turns.map((t) => t.id));
  const byTurn = new Map<string, PreparedSegment[]>();
  const loose: Array<{ at: number; segment: PreparedSegment }> = [];
  for (const { segment, prepared: p } of prepared) {
    if (segment.turnId !== null && turnIds.has(segment.turnId)) {
      const list = byTurn.get(segment.turnId) ?? [];
      list.push(p);
      byTurn.set(segment.turnId, list);
    } else {
      loose.push({ at: segment.startMs, segment: p });
    }
  }

  const blocks: Block[] = [];
  let looseAt = 0;
  // Speech outside every answer is placed by time between the turns around it.
  const flushLoose = (before: number) => {
    const run: PreparedSegment[] = [];
    while (looseAt < loose.length && loose[looseAt].at < before) run.push(loose[looseAt++].segment);
    if (run.length > 0) blocks.push({ kind: "loose", segments: run });
  };
  for (const turn of turns) {
    if (turn.startMs !== undefined) flushLoose(turn.startMs);
    if (turn.who === "ai") blocks.push({ kind: "ai", turn });
    else blocks.push({ kind: "answer", turn, segments: byTurn.get(turn.id) ?? [] });
  }
  flushLoose(Infinity);
  return blocks;
}

/** A row's segments as one run of text, word indices running on across them. */
function speechOf(segments: readonly PreparedSegment[]): Speech {
  const tokens: Token[] = [];
  const times: WordTime[] = [];
  const stretches: Stretch[] = [];
  segments.forEach((segment, i) => {
    if (i > 0) tokens.push(makeToken(" ", -1));
    const offset = times.length;
    for (const token of segment.tokens) tokens.push(token.word < 0 ? token : { ...token, word: token.word + offset });
    times.push(...segment.times);
    stretches.push({ startMs: segment.startMs, endMs: segment.endMs, firstWord: offset, lastWord: times.length - 1 });
  });
  return { tokens, times, stretches };
}

/** Text with no times: a typed answer, a locked report, a session from before word timings. */
const textSpeech = (text: string): Speech => ({ tokens: tokenize(text).map((part) => makeToken(part, -1)), times: [], stretches: [] });

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

/** The stretch being spoken at `ms`, or -1. The later one wins where a tail overlaps the next start. */
export function stretchAt(speech: Speech, ms: number): number {
  const { stretches } = speech;
  if (stretches.length === 0 || ms < stretches[0].startMs) return -1;
  for (let i = stretches.length - 1; i >= 0; i--) {
    const stretch = stretches[i];
    if (ms < stretch.startMs) continue;
    return ms < stretch.endMs + STRETCH_TAIL_MS ? i : -1;
  }
  return -1;
}

/** The word being spoken at `ms` inside `stretch`, or -1 (before its first word, or no stretch). */
export function wordAt(speech: Speech, stretch: number, ms: number): number {
  if (stretch < 0) return -1;
  const { firstWord, lastWord } = speech.stretches[stretch];
  const { times } = speech;
  if (lastWord < firstWord || ms < times[firstWord].s) return -1;
  let lo = firstWord;
  let hi = lastWord;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid].s <= ms) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ---------------------------------------------------------------------------
// Fillers and notes
// ---------------------------------------------------------------------------

/** Sounds that are never anything but a filler. */
const FILLER_WORDS = new Set(["um", "umm", "uh", "uhh", "uhm", "er", "erm", "hmm", "hm", "mm", "mmm", "y'know"]);
const SET_OFF = /[,.!?;:]/;

/** The text between two words (indices into `tokens`), either of which may be missing at an edge. */
function gapBetween(tokens: readonly Token[], before: number | undefined, after: number | undefined): string {
  let text = before !== undefined ? tokens[before].trail : "";
  const end = after ?? tokens.length;
  for (let i = before !== undefined ? before + 1 : 0; i < end; i++) text += tokens[i].text;
  if (after !== undefined) text += tokens[after].lead;
  return text;
}

/**
 * The filler words. "um", "uh" and the like always are. "like" and "you know"
 * count only when the punctuation sets them apart (", like," or "You know,
 * I…"), the one way to tell them from "I'd like to" and "do you know".
 */
function findFillers(tokens: readonly Token[]): TokenRange[] {
  const words = tokens.flatMap((token, i) => (token.pieces.length > 0 ? [i] : []));
  const is = (i: number | undefined, piece: string) => i !== undefined && tokens[i].pieces.length === 1 && tokens[i].pieces[0] === piece;
  const out: TokenRange[] = [];
  for (let w = 0; w < words.length; w++) {
    const at = words[w];
    const token = tokens[at];
    if (token.pieces.length === 1 && FILLER_WORDS.has(token.pieces[0])) {
      out.push({ from: at, to: at });
      continue;
    }
    const before = gapBetween(tokens, words[w - 1], at);
    const opens = w === 0 || SET_OFF.test(before);
    if (is(at, "like") && opens && gapBetween(tokens, at, words[w + 1]).includes(",")) {
      out.push({ from: at, to: at });
      continue;
    }
    const know = words[w + 1];
    if (is(at, "you") && is(know, "know") && !SET_OFF.test(gapBetween(tokens, at, know)) && opens) {
      const after = gapBetween(tokens, know, words[w + 2]);
      if (after.includes(",") || (before.includes(",") && /[.!?]/.test(after))) {
        out.push({ from: at, to: know });
        w += 1;
      }
    }
  }
  return out;
}

interface PlacedNote extends TokenRange {
  note: AnswerNote;
}

/** Each note on the first run of words its quote matches, in the order given; a quote that would overlap one already placed is left out. */
function placeNotes(tokens: readonly Token[], notes: readonly AnswerNote[]): PlacedNote[] {
  const flat: Array<{ piece: string; token: number }> = [];
  tokens.forEach((token, i) => token.pieces.forEach((piece) => flat.push({ piece, token: i })));
  const placed: PlacedNote[] = [];
  for (const note of notes) {
    const quote = piecesOf(note.quote);
    if (quote.length === 0) continue;
    for (let k = 0; k + quote.length <= flat.length; k++) {
      if (!quote.every((piece, j) => flat[k + j].piece === piece)) continue;
      const from = flat[k].token;
      const to = flat[k + quote.length - 1].token;
      if (placed.some((p) => from <= p.to && to >= p.from)) continue;
      placed.push({ note, from, to });
      break;
    }
  }
  return placed.sort((a, b) => a.from - b.from);
}

function layOut(count: number, notes: readonly PlacedNote[], fillers: readonly TokenRange[]): { pieces: Piece[]; fillers: number } {
  // A filler a note's edge cuts through ("you" in the note, "know" out of it) is left unboxed.
  const kept = fillers.filter((f) => notes.every((n) => f.to < n.from || f.from > n.to || (f.from >= n.from && f.to <= n.to)));
  const fillerAt = new Map(kept.map((f) => [f.from, f]));
  const run = (from: number, to: number): Piece[] => {
    const out: Piece[] = [];
    for (let i = from; i <= to; ) {
      const filler = fillerAt.get(i);
      if (filler && filler.to <= to) {
        out.push({ kind: "filler", from: filler.from, to: filler.to });
        i = filler.to + 1;
      } else {
        out.push({ kind: "token", index: i });
        i += 1;
      }
    }
    return out;
  };
  const pieces: Piece[] = [];
  let at = 0;
  for (const n of notes) {
    pieces.push(...run(at, n.from - 1));
    pieces.push({ kind: "note", note: n.note, from: n.from, to: n.to, inner: run(n.from, n.to) });
    at = n.to + 1;
  }
  pieces.push(...run(at, count - 1));
  return { pieces, fillers: kept.length };
}

/** Model-written text on screen never carries an em dash. */
const cleanNote = (note: AnswerNote): AnswerNote => ({
  ...note,
  label: withoutEmDashes(note.label),
  sayInstead: note.sayInstead ? withoutEmDashes(note.sayInstead) : null,
  tip: note.tip ? withoutEmDashes(note.tip) : null,
});

// ---------------------------------------------------------------------------
// Unanswered questions
// ---------------------------------------------------------------------------

interface PickUp {
  question: SessionQuestionRef & { index: number };
  asked: boolean;
  /** The turn whose row it follows; null for the end of the transcript. */
  after: string | null;
}

/**
 * Where "Pick up from this question" goes. A question the interviewer asked
 * and nobody answered gets it after the lines that followed the question (a
 * check-in, a repeat), up to the next answer or the next question. If the
 * session didn't end on such a question, the first question it never reached
 * gets one at the end.
 */
function pickUps(turns: readonly TranscriptTurn[], questions: readonly SessionQuestionRef[]): PickUp[] {
  // Without question ids on the turns there is no telling what was answered:
  // say nothing rather than call every question skipped.
  if (questions.length === 0 || !turns.some((turn) => turn.questionId)) return [];
  const open = unansweredQuestions(questions, turns);
  if (open.length === 0) return [];

  const lastAsk = new Map<string, number>();
  turns.forEach((turn, i) => {
    if (turn.who === "ai" && turn.questionId) lastAsk.set(turn.questionId, i);
  });

  const out: PickUp[] = [];
  for (const question of open) {
    const at = lastAsk.get(question.id);
    if (at === undefined) continue;
    let end = at;
    while (end + 1 < turns.length) {
      const next = turns[end + 1];
      const moved = next.who === "user" ? next.text.trim().length > 0 : Boolean(next.questionId) && next.questionId !== question.id;
      if (moved) break;
      end += 1;
    }
    out.push({ question, asked: true, after: end === turns.length - 1 ? null : turns[end].id });
  }

  if (!out.some((p) => p.after === null)) {
    const lastAsked = questions.reduce((last, q, i) => (lastAsk.has(q.id) ? i + 1 : last), 0);
    const notReached = open.find((q) => q.index > lastAsked);
    if (notReached) out.push({ question: notReached, asked: false, after: null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------

export function buildTranscript(input: TranscriptInput): TranscriptModel {
  const { turns, questions, dimensions, rewrites, diction } = input;
  const answers = new Map(reportAnswers(turns, questions).map((answer) => [answer.turnId, answer]));

  const rows: TranscriptRow[] = [];
  for (const block of buildBlocks(input.segments, input.words, turns)) {
    if (block.kind === "ai") {
      // The stored question carries no audio tag; stripped anyway, since a tag is how a line was voiced, never what was asked.
      rows.push({ kind: "interviewer", key: block.turn.id, text: withoutEmDashes(withoutAudioTags(block.turn.text)).trim(), startMs: block.turn.startMs });
      continue;
    }
    const turn = block.kind === "answer" ? block.turn : null;
    const answer = turn ? (answers.get(turn.id) ?? null) : null;
    const { segments } = block;
    const speech = segments.length > 0 ? speechOf(segments) : textSpeech(turn?.text ?? "");
    const notes = answer ? placeNotes(speech.tokens, notesFor(answer, dimensions, diction).map(cleanNote)) : [];
    const { pieces, fillers } = layOut(speech.tokens.length, notes, findFillers(speech.tokens));
    const startMs = segments.length > 0 ? segments[0].startMs : turn?.startMs;
    const endMs = segments.length > 0 ? segments[segments.length - 1].endMs : turn?.endMs;
    const better = answer ? rewriteFor(answer, rewrites)?.better.trim() : undefined;
    rows.push({
      kind: "speech",
      key: turn?.id ?? `between-${segments[0].id}`,
      role: turn ? "answer" : "between",
      number: answer?.index ?? null,
      speech,
      pieces,
      fillerCount: fillers,
      noteCount: notes.length,
      flags: answer ? flagsFor(answer, dimensions) : [],
      rewrite: better ? withoutEmDashes(better) : null,
      startMs,
      durationMs: startMs !== undefined && endMs !== undefined && endMs > startMs ? endMs - startMs : undefined,
      wordCount: speech.tokens.filter((token) => token.pieces.length > 0).length,
    });
  }

  const after = new Map<string, PickUpRow[]>();
  const atEnd: PickUpRow[] = [];
  for (const p of pickUps(turns, questions)) {
    const row: PickUpRow = {
      kind: "pickup",
      key: `pickup-${p.question.id}`,
      questionId: p.question.id,
      number: p.question.index,
      text: withoutEmDashes(withoutAudioTags(p.question.text)).trim(),
      asked: p.asked,
      atEnd: p.after === null,
    };
    if (p.after === null) atEnd.push(row);
    else after.set(p.after, [...(after.get(p.after) ?? []), row]);
  }
  const placed: TranscriptRow[] = [];
  for (const row of rows) {
    placed.push(row);
    const following = after.get(row.key);
    if (following) {
      placed.push(...following);
      after.delete(row.key);
    }
  }
  placed.push(...[...after.values()].flat(), ...atEnd);

  const speechRows = rows.filter((row): row is SpeechRow => row.kind === "speech");
  return {
    rows: placed,
    timed: speechRows.some((row) => row.speech.times.length > 0),
    fillers: speechRows.some((row) => row.fillerCount > 0),
    notes: speechRows.some((row) => row.noteCount > 0),
  };
}
