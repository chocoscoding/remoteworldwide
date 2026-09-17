// Times on a recording, written three ways: a clock for the eye ("3:42"),
// a length for a sentence ("14 min 5 s"), and words for a screen reader
// ("3 minutes 42 seconds"), which reads "3:42" as a ratio or a time of day.
//
// Every input is milliseconds on the session clock. Anything that isn't a
// finite, non-negative number (a duration not known yet, a NaN from a media
// element that hasn't loaded) reads as zero rather than "NaN:NaN".
//
// The second half is the delivery report's vocabulary: what each finding is
// called and how a measured number is written. It lives here, not in one
// component, because the findings list, the timeline, the summary and the
// report mapper must all say the same thing about the same number.

import type { DeliveryFlagKind, DeliveryMeasure, TranscriptTurn } from "./types";

function wholeSeconds(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
}

function split(ms: number): { h: number; m: number; s: number } {
  const total = wholeSeconds(ms);
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * "0:07", "3:42", "1:02:03".
 *
 * Seconds are floored, not rounded, so a chip at 3:41.8 says 3:41 and the
 * audio it plays is never ahead of the label.
 */
export function formatClock(ms: number): string {
  const { h, m, s } = split(ms);
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/**
 * A length for running text: "45 s", "14 min", "14 min 5 s", "1 h 2 min".
 * Past an hour the seconds are dropped; nobody reads them at that scale.
 */
export function formatDuration(ms: number): string {
  const { h, m, s } = split(ms);
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** "3 minutes 42 seconds", "1 hour 2 minutes 3 seconds", "0 seconds" — for aria-label and aria-valuetext. */
export function ariaTime(ms: number): string {
  const { h, m, s } = split(ms);
  const parts: string[] = [];
  if (h > 0) parts.push(unit(h, "hour"));
  if (m > 0) parts.push(unit(m, "minute"));
  if (s > 0 || parts.length === 0) parts.push(unit(s, "second"));
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** A true minus sign: a hyphen reads as a dash beside a number, and screen readers skip it. */
const MINUS = "−";

/** "+1.2", "−3.8", "0.0". For values that sit either side of the user's own median. */
export function formatSigned(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = Math.abs(value).toFixed(digits);
  // A value that rounds to zero carries no sign: "−0.0" says more than it means.
  if (Number(fixed) === 0) return fixed;
  return `${value < 0 ? MINUS : "+"}${fixed}`;
}

// ---------------------------------------------------------------------------
// Delivery vocabulary
// ---------------------------------------------------------------------------

export interface FlagKindMeta {
  /** The finding's name in a heading. */
  label: string;
  /** Where space is tight: a timeline lane, a tooltip. */
  short: string;
  /** One plain sentence on what was measured, so a finding never reads as a verdict with no reason. */
  what: string;
}

/**
 * Every finding is measured against this session's own baseline, so the words
 * describe a change in how the user spoke, never the kind of voice they have.
 */
export const FLAG_KIND_META: Record<DeliveryFlagKind, FlagKindMeta> = {
  rushing: {
    label: "Rushing",
    short: "Rushing",
    what: "Stretches where you spoke much faster than your own average.",
  },
  monotone: {
    label: "Flat pitch",
    short: "Flat pitch",
    what: "Answers where your pitch moved far less than it did in your other answers.",
  },
  "fading-energy": {
    label: "Fading energy",
    short: "Fading",
    what: "Your loudness dropping away, across the session or inside one long answer.",
  },
  hesitation: {
    label: "Slow start",
    short: "Slow start",
    what: "A long silence before your first word, or several pauses early in an answer.",
  },
  fillers: {
    label: "Filler words",
    short: "Fillers",
    what: "Words like “um”, “uh” and “you know” that fill a gap instead of saying something.",
  },
  "flat-value-prop": {
    label: "Result said flatly",
    short: "Flat result",
    what: "A result or impact line said with less pitch movement than the rest of its answer.",
  },
};

export const SEVERITY_LABELS: Record<1 | 2 | 3, string> = { 1: "Mild", 2: "Noticeable", 3: "Strong" };

const round1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/**
 * A measured value with its unit: "182 wpm", "1.8 semitones", "−3.8 dB",
 * "4.2 s", "6.1 per 100 words". Units the report doesn't know yet are
 * written as given rather than dropped.
 */
export function formatMeasureValue(value: number, unitName: string): string {
  if (!Number.isFinite(value)) return "—";
  switch (unitName) {
    case "wpm":
      return `${Math.round(value)} wpm`;
    case "st":
      return `${round1(value)} semitones`;
    case "dB":
      return `${formatSigned(value)} dB`;
    case "ms":
      return `${round1(value / 1000)} s`;
    case "per 100 words":
      return `${round1(value)} per 100 words`;
    default:
      return `${round1(value)} ${unitName}`;
  }
}

/**
 * The baseline in the same sentence. A bare number where the unit was just
 * said ("182 wpm vs your 150 average"); the unit again where a bare number
 * would be ambiguous (seconds, and decibels, which are signed).
 */
function formatBaseline(value: number, unitName: string): string {
  if (!Number.isFinite(value)) return "—";
  switch (unitName) {
    case "wpm":
      return String(Math.round(value));
    case "st":
    case "per 100 words":
      return round1(value);
    default:
      return formatMeasureValue(value, unitName);
  }
}

/** "Pace 182 wpm vs your 150 average" — the number behind a finding, against the user's own session. */
export function formatMeasure(measure: DeliveryMeasure): string {
  return `${measure.label} ${formatMeasureValue(measure.value, measure.unit)} vs your ${formatBaseline(measure.baseline, measure.unit)} average`;
}

// ---------------------------------------------------------------------------
// Turns
// ---------------------------------------------------------------------------

/**
 * What the report components need from a turn. Both a saved session's
 * `PrepTurn` and an in-memory `TranscriptTurn` have this shape, so either list
 * can be passed straight through.
 */
export type DeliveryTurn = Pick<TranscriptTurn, "id" | "who" | "text" | "startMs" | "endMs">;

/** Answer numbers as the user saw them: the user's turns, 1-based, in order. */
export function numberAnswers(turns: readonly DeliveryTurn[]): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const turn of turns) if (turn.who === "user") numbers.set(turn.id, numbers.size + 1);
  return numbers;
}

/**
 * The question inside an interviewer turn, which usually opens with an
 * acknowledgement ("Thanks, that's a clear example."): the last sentence
 * ending in a question mark, else the last sentence ("Walk me through…").
 */
export function askedQuestion(text: string): string {
  const sentences = (text.match(/[^.!?]+[.!?]+["”’)]*/g) ?? []).map((s) => s.trim()).filter(Boolean);
  const asked = [...sentences].reverse().find((s) => /\?["”’)]*$/.test(s)) ?? sentences[sentences.length - 1];
  return asked ?? text.trim();
}

/** The interviewer's question each answer replied to: from the nearest interviewer turn before it. */
export function questionsByAnswer(turns: readonly DeliveryTurn[]): Map<string, string> {
  const questions = new Map<string, string>();
  let lastQuestion: string | null = null;
  for (const turn of turns) {
    if (turn.who === "ai") lastQuestion = askedQuestion(turn.text);
    else if (lastQuestion !== null) questions.set(turn.id, lastQuestion);
  }
  return questions;
}

/** A long line cut at a word boundary for a tooltip or an aria-label. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, "")}…`;
}
