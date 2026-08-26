// Interview Prep — scoring seam.
//
// Stands in for §7-8 of the brief (session report generation + panel
// research) without a backend, a realtime voice model, or an LLM grader.
// Every score here is a small deterministic rule over the user's own typed
// transcript, plus a `hash01`-seeded jitter for texture — never
// `Math.random()`, so a report is reproducible from its inputs. When a real
// grader model exists, replacing the body of `buildSessionReport` is the
// whole migration; the return shape (`PrepSession`) already matches what the
// report screen renders.

import {
  FORMAT_META,
  PANEL_BANK,
  QUESTIONS_FOR_LENGTH,
  QUESTION_BANK,
  panelForCompany,
  type ActionItem,
  type Difficulty,
  type DimensionScore,
  type EvidenceItem,
  type LanguageStat,
  type PanelMember,
  type PrepSession,
  type PrepTrack,
  type QuestionBankEntry,
  type Rewrite,
  type SessionFormat,
  type SessionLength,
  type TranscriptTurn,
} from "./prep-data";

// ---------------------------------------------------------------------------
// Determinism helpers — same recipe as ats-stub.ts's hash01, copied rather
// than imported so this module stays self-contained.
// ---------------------------------------------------------------------------

function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const x = Math.sin(h) * 43758.5453;
  return x - Math.floor(x);
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function wordCount(s: string): number {
  const trimmed = s.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++seq}`;

// ---------------------------------------------------------------------------
// Preparedness score — straight from the brief's §3 formula.
// ---------------------------------------------------------------------------

const RECENCY_WEIGHTS = [0.55, 0.3, 0.15];

export function computePreparedness(track: PrepTrack): number {
  if (track.sessions.length === 0) return 0;
  const recent = track.sessions.slice(-3).reverse();
  const w = RECENCY_WEIGHTS.slice(0, recent.length);
  const wSum = w.reduce((a, b) => a + b, 0);
  const s = recent.reduce((sum, session, i) => sum + session.overallScore * (w[i] / wSum), 0);
  const total = track.actions.length;
  const c = total === 0 ? 0 : track.actions.filter((a) => a.done).length / total;
  return Math.round(s + (100 - s) * c);
}

// ---------------------------------------------------------------------------
// Panel research
// ---------------------------------------------------------------------------

export function researchPanel(company: string): PanelMember[] {
  return panelForCompany(company);
}

export function hasPanelData(company: string): boolean {
  return Boolean(PANEL_BANK[company]);
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

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

export interface SessionInput {
  trackId: string;
  formats: SessionFormat[];
  difficulty: Difficulty;
  lengthMinutes: SessionLength;
  /** Full turn-by-turn transcript, AI questions and user answers interleaved. */
  transcript: TranscriptTurn[];
  elapsedSeconds: number;
}

const JITTER_RANGE: Record<Difficulty, number> = { "warm-up": 0.4, standard: 0.8, tough: 1.4 };

const HEDGE_WORDS = ["maybe", "i guess", "kind of", "sort of", "probably", "i think", "i suppose"];
const FILLER_WORDS = ["um", "uh", "like", "basically", "actually", "you know", "sort of", "kind of"];
const SEQUENCE_WORDS = /\b(first|then|because|result|led to|so we|after that)\b/i;

interface AnsweredQuestion {
  questionId: string;
  bankEntry: QuestionBankEntry | undefined;
  text: string;
}

function pairAnswers(transcript: TranscriptTurn[]): AnsweredQuestion[] {
  const all = Object.values(QUESTION_BANK).flat();
  return transcript
    .filter((t) => t.who === "user" && t.text.trim().length > 0 && t.questionId)
    .map((t) => ({ questionId: t.questionId!, bankEntry: all.find((q) => q.id === t.questionId), text: t.text.trim() }));
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}


// ---------------------------------------------------------------------------
// Evidence — the specific words behind each score, so a number can be opened
// up into "here is the line, here is what to notice, here is a better way to
// say it". All of it is pulled from what the user actually said; nothing here
// invents a quote.
// ---------------------------------------------------------------------------

let evSeq = 0;
const evId = () => `ev-${++evSeq}`;

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/** Sentences containing any of `needles`, with the needle named back. */
function sentencesContaining(text: string, needles: string[]): { sentence: string; hit: string }[] {
  const out: { sentence: string; hit: string }[] = [];
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const lower = sentence.toLowerCase();
    for (const n of needles) {
      // Multi-word fillers like "you know" contain a space, so \b on each end
      // is enough — no need to word-split the needle itself.
      if (new RegExp(`\\b${n.replace(REGEX_SPECIALS, "\\$&")}\\b`, "i").test(lower)) {
        out.push({ sentence, hit: n });
        break;
      }
    }
  }
  return out;
}

/** The same sentence with one hedge/filler phrase taken out and tidied up. */
function stripPhrase(sentence: string, phrase: string): string {
  return sentence
    .replace(new RegExp(`\\b${phrase.replace(REGEX_SPECIALS, "\\$&")}\\b,?\\s*`, "i"), "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function trimQuote(s: string, max = 220): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`;
}

interface EvidenceCtx {
  answers: AnsweredQuestion[];
  perAnswer: { questionId: string; text: string; structure: number; specifics: number; relevance: number }[];
  wpm: number;
}

function structureEvidence({ perAnswer, answers }: EvidenceCtx): EvidenceItem[] {
  return perAnswer
    .filter((p) => p.structure < 8)
    .slice(0, 3)
    .map((p) => {
      const q = answers.find((a) => a.questionId === p.questionId)?.bankEntry;
      const hasSeq = SEQUENCE_WORDS.test(p.text);
      return {
        id: evId(),
        quote: trimQuote(p.text),
        question: q?.text,
        note: hasSeq
          ? "This has a sequence but jumps to the result before setting up the situation."
          : "No before → decision → after shape here, so the panel can't follow how you got there.",
        fix: q?.better,
      };
    });
}

function specificsEvidence({ perAnswer, answers }: EvidenceCtx): EvidenceItem[] {
  return perAnswer
    .filter((p) => countMatches(p.text, /\d+/g) === 0)
    .slice(0, 4)
    .map((p) => {
      const q = answers.find((a) => a.questionId === p.questionId)?.bankEntry;
      return {
        id: evId(),
        quote: trimQuote(p.text),
        question: q?.text,
        note: "No figure anywhere in this answer — nothing here tells the panel how big the work was.",
        fix: q?.better,
      };
    });
}

function paceEvidence({ answers, wpm }: EvidenceCtx): EvidenceItem[] {
  if (answers.length === 0) return [];
  const longest = [...answers].sort((a, b) => wordCount(b.text) - wordCount(a.text))[0];
  const shortest = [...answers].sort((a, b) => wordCount(a.text) - wordCount(b.text))[0];
  const items: EvidenceItem[] = [
    {
      id: evId(),
      quote: trimQuote(longest.text),
      question: longest.bankEntry?.text,
      note: `Your longest answer, ${wordCount(longest.text)} words. At ${Math.round(wpm)} words a minute that runs about ${Math.max(1, Math.round(wordCount(longest.text) / Math.max(wpm, 1) * 60))} seconds.`,
    },
  ];
  if (answers.length > 1 && wordCount(shortest.text) < 25) {
    items.push({
      id: evId(),
      quote: trimQuote(shortest.text),
      question: shortest.bankEntry?.text,
      note: `Your shortest answer, only ${wordCount(shortest.text)} words — panels usually read this as not having a real example ready.`,
    });
  }
  return items;
}

function ownershipEvidence({ answers }: EvidenceCtx): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const a of answers) {
    for (const { sentence } of sentencesContaining(a.text, ["we", "our"]).slice(0, 2)) {
      if (/i/i.test(sentence)) continue; // already names the personal call
      out.push({
        id: evId(),
        quote: trimQuote(sentence),
        question: a.bankEntry?.text,
        note: "“We” with no “I” anywhere in the sentence — the panel can't tell which part was your call.",
        fix: sentence.replace(/we/i, "I").replace(/our/i, "my"),
      });
      if (out.length >= 4) return out;
    }
  }
  return out;
}

function relevanceEvidence({ perAnswer, answers }: EvidenceCtx): EvidenceItem[] {
  return perAnswer
    .filter((p) => p.relevance < 7)
    .slice(0, 3)
    .map((p) => {
      const q = answers.find((a) => a.questionId === p.questionId)?.bankEntry;
      return {
        id: evId(),
        quote: trimQuote(p.text),
        question: q?.text,
        note: "Little overlap between this answer and what was actually asked — it reads as a story you had ready rather than a reply.",
        fix: q?.better,
      };
    });
}

function confidenceEvidence({ answers }: EvidenceCtx): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const a of answers) {
    for (const { sentence, hit } of sentencesContaining(a.text, HEDGE_WORDS)) {
      out.push({
        id: evId(),
        quote: trimQuote(sentence),
        question: a.bankEntry?.text,
        note: `“${hit}” makes a decision you actually made sound like a guess.`,
        fix: stripPhrase(sentence, hit),
      });
      if (out.length >= 4) return out;
    }
    if (a.text.trim().endsWith("...") || a.text.trim().endsWith("…")) {
      out.push({
        id: evId(),
        quote: trimQuote(a.text),
        question: a.bankEntry?.text,
        note: "This one trails off rather than landing. Stopping on a full stop reads as far more certain.",
      });
      if (out.length >= 4) return out;
    }
  }
  return out;
}

function fillerEvidence({ answers }: EvidenceCtx): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const a of answers) {
    for (const { sentence, hit } of sentencesContaining(a.text, FILLER_WORDS)) {
      out.push({
        id: evId(),
        quote: trimQuote(sentence),
        question: a.bankEntry?.text,
        note: `Filler: “${hit}”.`,
        fix: stripPhrase(sentence, hit),
      });
      if (out.length >= 6) return out;
    }
  }
  return out;
}

export function buildSessionReport(input: SessionInput, track: PrepTrack): PrepSession {
  const sessionId = nextId("sess");
  const jitterRange = JITTER_RANGE[input.difficulty];
  const jitter = (key: string) => (hash01(`${sessionId}:${key}`) - 0.5) * jitterRange;

  const answers = pairAnswers(input.transcript);
  const totalQuestions = input.transcript.filter((t) => t.who === "ai").length;
  const totalWords = answers.reduce((sum, a) => sum + wordCount(a.text), 0);
  const tooShort = totalWords < 30 || answers.length < Math.max(1, Math.ceil(totalQuestions / 2));

  // Per-answer scores, reused both for the dimension averages and to pick
  // which answers are weakest (for rewrites).
  const perAnswer = answers.map((a) => {
    const sentences = a.text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const structure = clamp(4 + (sentences.length >= 2 ? 2 : 0) + (SEQUENCE_WORDS.test(a.text) ? 2 : 0), 0, 10);
    const digitHits = countMatches(a.text, /\d+/g);
    const specifics = clamp(digitHits === 0 ? 3 : digitHits === 1 ? 6 : 9, 0, 10);
    const relevance = a.bankEntry
      ? clamp((intersectionSize(tokens(a.bankEntry.text), tokens(a.text)) / Math.max(1, tokens(a.bankEntry.text).size)) * 10 + 4, 0, 10)
      : 6;
    return { questionId: a.questionId, text: a.text, structure, specifics, relevance };
  });

  const avg = (nums: number[]) => (nums.length === 0 ? 3 : nums.reduce((a, b) => a + b, 0) / nums.length);

  const structureScore = clamp(avg(perAnswer.map((p) => p.structure)) + jitter("structure"), 0, 10);
  const specificsScore = clamp(avg(perAnswer.map((p) => p.specifics)) + jitter("specifics"), 0, 10);

  const minutes = Math.max(input.elapsedSeconds / 60, 0.5);
  const wpm = totalWords / minutes;
  const paceScore = clamp(wpm >= 130 && wpm <= 160 ? 9.5 : wpm >= 100 && wpm <= 190 ? 7 : wpm > 0 ? 4.5 : 2, 0, 10) + jitter("pace");

  const iCount = answers.reduce((sum, a) => sum + countMatches(a.text, /\bi\b/gi), 0);
  const weCount = answers.reduce((sum, a) => sum + countMatches(a.text, /\bwe\b/gi), 0);
  const ownershipRatio = weCount === 0 ? (iCount > 0 ? 3 : 1) : iCount / weCount;
  const ownershipScore = clamp((ownershipRatio >= 2 ? 9.5 : ownershipRatio >= 1 ? 7 : 4) + jitter("ownership"), 0, 10);

  const relevanceScore = clamp(avg(perAnswer.map((p) => p.relevance)) + jitter("relevance"), 0, 10);

  const hedgeCount = countPhrases(answers.map((a) => a.text), HEDGE_WORDS);
  const trailingEllipsis = answers.filter((a) => a.text.trim().endsWith("...")).length;
  const confidenceScore = clamp(7 - hedgeCount * 1.5 - trailingEllipsis + jitter("confidence"), 0, 10);

  const evCtx: EvidenceCtx = { answers, perAnswer, wpm };

  const dimensions: DimensionScore[] = [
    {
      id: "structure",
      label: "Structure",
      score: round1(structureScore),
      note: structureNote(structureScore),
      evidence: structureEvidence(evCtx),
      howToImprove: "Open with the situation, name the call you made, then land on what changed. Same story, three beats.",
    },
    {
      id: "specifics",
      label: "Specifics & numbers",
      score: round1(specificsScore),
      note: specificsNote(specificsScore, hedgeCount),
      evidence: specificsEvidence(evCtx),
      howToImprove: "Put one figure on every story — users, percent, latency, weeks. One is enough; vague scale reads as no scale.",
    },
    {
      id: "pace",
      label: "Pace",
      score: round1(paceScore),
      note: paceNote(wpm),
      evidence: paceEvidence(evCtx),
      howToImprove: "Aim for 130-160 words a minute and keep answers near 90 seconds. Past two minutes a panel starts waiting for the end.",
    },
    {
      id: "ownership",
      label: "Ownership",
      score: round1(ownershipScore),
      note: ownershipNote(iCount, weCount),
      evidence: ownershipEvidence(evCtx),
      howToImprove: "Name your own decision first, the team's contribution second. “I decided X, and we shipped it” beats “we decided X”.",
    },
    {
      id: "relevance",
      label: "Relevance",
      score: round1(relevanceScore),
      note: relevanceNote(relevanceScore),
      evidence: relevanceEvidence(evCtx),
      howToImprove: "Restate the question in one sentence before you answer it. It costs three seconds and keeps you on target.",
    },
    {
      id: "confidence",
      label: "Confidence",
      score: round1(confidenceScore),
      note: confidenceNote(hedgeCount, trailingEllipsis),
      evidence: confidenceEvidence(evCtx),
      howToImprove: "Cut the hedge and stop on a full stop. The same sentence without “maybe” reads as a decision rather than a guess.",
    },
  ];

  const overallScore = clamp(Math.round((dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) * 10), 0, 100);

  const fillerCount = countPhrases(answers.map((a) => a.text), FILLER_WORDS);
  const longestWords = answers.length === 0 ? 0 : Math.max(...answers.map((a) => wordCount(a.text)));

  const languageStats: LanguageStat[] = [
    {
      id: "wpm",
      label: "Words per minute",
      value: totalWords === 0 ? "—" : `${Math.round(wpm)} · ${wpm >= 130 && wpm <= 160 ? "in band" : wpm > 160 ? "a little fast" : "a little slow"}`,
      good: wpm >= 130 && wpm <= 160,
      evidence: paceEvidence(evCtx),
      howToImprove: "130-160 is the band that reads as composed. Below it you sound hesitant, above it rushed.",
    },
    {
      id: "fillers",
      label: "Filler words",
      value: `${fillerCount} across your answers`,
      good: fillerCount <= 3,
      evidence: fillerEvidence(evCtx),
      howToImprove: "A short silence beats a filler every time. Pause, then start the sentence.",
    },
    {
      id: "ownership-ratio",
      label: "“I” vs “we”",
      value: weCount === 0 ? (iCount > 0 ? `${iCount} to 0` : "not used yet") : `${(iCount / weCount).toFixed(1)} to 1`,
      good: ownershipRatio >= 1.5,
      evidence: ownershipEvidence(evCtx),
      howToImprove: "Aim past 1.5 to 1. Below that the panel can't separate your work from your team's.",
    },
    {
      id: "longest",
      label: "Longest answer",
      value: answers.length === 0 ? "—" : `${longestWords} words`,
      good: longestWords > 0 && longestWords <= 180,
      evidence: paceEvidence(evCtx),
      howToImprove: "Keep the longest answer under about 180 words, then offer to go deeper. Let them ask for more.",
    },
  ];

  const rewrites = buildRewrites(perAnswer, sessionId);
  const actionItems = buildActions(dimensions, track.company);
  const coachNote = buildCoachNote(dimensions, track.company);

  return {
    id: sessionId,
    trackId: input.trackId,
    formats: input.formats,
    difficulty: input.difficulty,
    lengthMinutes: input.lengthMinutes,
    completedAt: new Date().toISOString(),
    transcript: input.transcript,
    overallScore,
    dimensions,
    languageStats,
    rewrites,
    actionItems,
    coachNote,
    tooShort,
  };
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Whole-word occurrences of any phrase in `needles`.
 *
 * Word boundaries, not substring: `.includes("like")` also fires on
 * "unlikely", which inflated the count past what the evidence list could
 * actually show — clicking a stat reading "1" and being told nothing was
 * flagged is exactly the kind of thing that makes a report untrustworthy.
 */
function countPhrases(texts: string[], needles: string[]): number {
  let n = 0;
  for (const t of texts) {
    for (const needle of needles) {
      const re = new RegExp(`\\b${needle.replace(REGEX_SPECIALS, "\\$&")}\\b`, "gi");
      n += (t.match(re) ?? []).length;
    }
  }
  return n;
}

function buildRewrites(perAnswer: { questionId: string; text: string; structure: number; specifics: number }[], sessionId: string): Rewrite[] {
  const bank = Object.values(QUESTION_BANK).flat();
  return [...perAnswer]
    .sort((a, b) => a.structure + a.specifics - (b.structure + b.specifics))
    .slice(0, 2)
    .map((a, i) => {
      const entry = bank.find((q) => q.id === a.questionId);
      if (!entry) return null;
      return { id: `rw-${sessionId}-${i}`, question: entry.text, said: a.text, better: entry.better, why: entry.why };
    })
    .filter((r): r is Rewrite => r !== null);
}

function buildActions(dimensions: DimensionScore[], company: string): ActionItem[] {
  const templates: Record<string, (company: string) => { title: string; detail: string; effortMinutes: number }> = {
    structure: () => ({ title: "Give each answer a before → decision → after shape", detail: "State the situation, name your call, then the result — in that order.", effortMinutes: 15 }),
    specifics: (c) => ({ title: `Put one number on each ${c} story`, detail: "Users, latency, weeks saved — one figure per answer is enough.", effortMinutes: 20 }),
    pace: () => ({ title: "Run a timed drill at a steadier pace", detail: "Aim for 130-160 words a minute — record yourself once to check.", effortMinutes: 10 }),
    ownership: () => ({ title: "Swap two or three “we”s for “I”", detail: "Name your own call first, then the team's, in your STAR answers.", effortMinutes: 10 }),
    relevance: () => ({ title: "Practise answering the question actually asked", detail: "Restate it in one sentence before you start — it keeps you on track.", effortMinutes: 10 }),
    confidence: () => ({ title: "Cut hedge words and land on a full stop", detail: "“Maybe”, “kind of”, and trailing off all read as unsure — say the sentence, then stop.", effortMinutes: 6 }),
  };

  return [...dimensions]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((d) => {
      const t = templates[d.id]?.(company);
      if (!t) return null;
      const item: ActionItem = { id: nextId("act"), title: t.title, detail: t.detail, effortMinutes: t.effortMinutes, done: false, source: "From today's session" };
      return item;
    })
    .filter((a): a is ActionItem => a !== null);
}

// Editorial framing for the report's headline "coach note" — deliberately
// distinct copy from the matching dimension's own scorecard note (built by
// e.g. confidenceNote() below), so the two don't read as a literal repeat.
const COACH_LEADS: Record<string, (company: string) => string> = {
  structure: () => "Your structure is the thing to fix first before your next round.",
  specifics: (c) => `The biggest lever right now is specifics. Walk in with one real number for every ${c} story.`,
  pace: () => "Pace is what's holding this back — a touch of practice at a steadier speed changes how the whole answer lands.",
  ownership: () => "Before anything else: make sure the panel can tell what you personally decided, not just what the team did.",
  relevance: () => "Answer the question you were actually asked before you go anywhere else with it — that's the biggest gap right now.",
  confidence: () => "The content is there. What's costing you points is how sure you sound saying it.",
};

function buildCoachNote(dimensions: DimensionScore[], company: string): string {
  const worst = [...dimensions].sort((a, b) => a.score - b.score)[0];
  if (!worst) return "Run a session to get a coach note here.";
  const lead = COACH_LEADS[worst.id]?.(company) ?? `${worst.label} is the one to work on next.`;
  return `${lead} ${worst.note}`;
}

// ---------------------------------------------------------------------------
// Note copy — small variant banks keyed by score band, not one string per
// dimension, so re-running a session doesn't read identically every time.
// ---------------------------------------------------------------------------

function band(score: number): "low" | "mid" | "high" {
  return score < 5 ? "low" : score < 8 ? "mid" : "high";
}

function structureNote(score: number): string {
  const b = band(score);
  if (b === "high") return "Situation, decision, outcome, in that order, almost every time.";
  if (b === "mid") return "Mostly there, but a couple of answers skipped straight to the result.";
  return "Answers read as a list of facts rather than a sequence — lead with the situation, then the call you made.";
}

function specificsNote(score: number, hedgeCount: number): string {
  const b = band(score);
  if (b === "high") return "Numbers backed up nearly every claim.";
  if (b === "mid") return "About half your answers had a real figure in them.";
  return hedgeCount > 0 ? "Several answers had no figure at all — this is the one that moves your score most." : "No numbers in your answers yet — even a rough one helps.";
}

function paceNote(wpm: number): string {
  if (wpm === 0) return "No timed answers to measure yet.";
  if (wpm >= 130 && wpm <= 160) return `${Math.round(wpm)} words a minute, steady, no rushing under pressure.`;
  if (wpm > 160) return `${Math.round(wpm)} words a minute — a little quick. Slowing down reads as more confident.`;
  return `${Math.round(wpm)} words a minute — a little slow. A touch more pace keeps the panel with you.`;
}

function ownershipNote(iCount: number, weCount: number): string {
  if (iCount === 0 && weCount === 0) return "Not enough language yet to tell who did what.";
  if (weCount > iCount) return `“We” more often than “I”. Name your own call first, then the team's.`;
  return "You're clear about what you personally decided — keep that up.";
}

function relevanceNote(score: number): string {
  const b = band(score);
  if (b === "high") return "You stayed on the question, even when it had a follow-up buried in it.";
  if (b === "mid") return "Mostly on-topic, with a couple of answers that drifted.";
  return "A few answers didn't clearly connect back to what was asked — restate the question before diving in.";
}

function confidenceNote(hedgeCount: number, trailingEllipsis: number): string {
  if (hedgeCount === 0 && trailingEllipsis === 0) return "Answers landed on a full stop — no hedging.";
  if (trailingEllipsis > 0) return "A couple of answers trailed off rather than landing on a full stop.";
  return `“Maybe”, “kind of”, “sort of” showed up ${hedgeCount} time${hedgeCount === 1 ? "" : "s"} — cut them and the same answer reads more sure of itself.`;
}

export { FORMAT_META };

// ---------------------------------------------------------------------------
// Demo report
// ---------------------------------------------------------------------------

/**
 * A fully-worked session, used by the report screen's "Default" state preview
 * when the real session is too short to have produced a scorecard.
 *
 * Deliberately built by running the *real* scorer over a canned transcript
 * rather than hand-writing plausible numbers — so the preview can never drift
 * out of sync with what the engine actually does, and the answers below
 * genuinely earn the scores they get.
 */
const DEMO_ANSWERS: { questionId: string; text: string }[] = [
  {
    questionId: "beh-owned-outcome",
    text: "I led the checkout redesign end to end for eight weeks. First I pulled the drop-off data and found 40% of people abandoned at step three, so I cut the flow from six steps to two. As a result first-payment time went from 4 minutes to 90 seconds and support tickets dropped 31%.",
  },
  {
    questionId: "beh-pushback-eng",
    text: "Engineering flagged that infinite scroll would be expensive to paginate correctly. I looked at the usage data and saw almost nobody scrolled past page two, so I dropped it. We shipped simple pagination a week early and nobody has asked for the scroll since.",
  },
  {
    questionId: "beh-disagree",
    text: "A PM wanted to ship without usability testing. I ran a three day test with 6 users, paired the findings with a lightweight redesign, and we shipped a week later with a 14% lift in completed checkouts. Testing became a standing step after that.",
  },
  {
    questionId: "beh-conflict-teammate",
    text: "A senior engineer and I disagreed on how much of the settings redesign to ship at once. We agreed on a two week trial of my version with a rollback plan. Support volume did not rise, so it stuck, and that became how we settled scope disputes.",
  },
];

export function buildDemoReport(track: PrepTrack): PrepSession {
  const transcript: TranscriptTurn[] = [];
  const all = Object.values(QUESTION_BANK).flat();
  DEMO_ANSWERS.forEach((a, i) => {
    const entry = all.find((q) => q.id === a.questionId);
    transcript.push({ id: `demo-ai-${i}`, who: "ai", text: entry?.text ?? a.questionId, questionId: a.questionId });
    transcript.push({ id: `demo-user-${i}`, who: "user", text: a.text, questionId: a.questionId });
  });

  // ~195 words of answers over 88s lands pace in the 130-160 wpm band, so the
  // showcase reads like a good session rather than accidentally scoring itself
  // badly on a metric that only measures words-per-elapsed-second.
  return buildSessionReport(
    { trackId: track.id, formats: ["behavioural"], difficulty: "standard", lengthMinutes: 6, transcript, elapsedSeconds: 88 },
    track
  );
}
