// Voice report fixtures: realistic sessions shaped exactly like the AI
// service's responses, so the report UI can be built and checked before the
// pipeline exists.
//
// Nothing here is typed out by hand where it can be derived. The ready
// session is generated from a script (what was said, how fast, where the
// pauses and the loudness went) with a seeded random source, and every number
// the report shows (word times, the 250 ms series, the pace windows, metrics,
// flags, summary figures) is computed from that one script. So the numbers
// agree with each other the way the real pipeline's do, and changing a line of
// the script moves everything that depends on it.
//
// Assumptions the pipeline may settle differently (the UI must not depend on
// them): a pace point's `atMs` is the centre of its 15 s window;
// `energyDeltaDb` is an answer's loudness against the session median; words
// carry no punctuation.
//
// Imported by nothing at runtime. The `satisfies` checks at the bottom hold
// every delivery component's props to these shapes, so a contract change that
// breaks a component breaks the typecheck here too.

import { QUESTION_BANK, type ActionItem, type DimensionScore, type EvidenceItem, type LanguageStat, type PrepSession, type Rewrite } from "@/app/lib/dashboard/prep-data";
import type { EvidenceDialogProps } from "@/app/components/dashboard/prep/EvidenceDialog";
import type {
  AccuracyRatingProps,
  AnalysisProgressProps,
  DeleteSessionButtonProps,
  DeliveryFindingsProps,
  DeliveryTimelineProps,
  LockedReportProps,
  PlaybackProviderProps,
  RecordingPlayerProps,
  SummaryLinesProps,
  SyncedTranscriptProps,
  TimestampChipProps,
} from "@/app/components/dashboard/prep/delivery";
import type {
  AnalysisStep,
  AnswerQuote,
  DeliveryAnswer,
  DeliveryFlag,
  DeliveryMetrics,
  DeliveryReport,
  DeliverySeries,
  DeliverySummaryLine,
  DeliveryTranscriptSegment,
  DeliveryTranscriptWord,
  DictionFinding,
  DictionSection,
  PlaybackLink,
  PositioningCriterion,
  PositioningCriterionId,
  PositioningSection,
  PrepAnalysisState,
  PrepQuestion,
  PrepReportPayload,
  PrepSessionDetail,
  PrepSnapshot,
  PrepTurn,
  StepState,
} from "./types";

// ---------------------------------------------------------------------------
// The script
// ---------------------------------------------------------------------------

/** 14:00 exactly: 5 credits for the first 10 minutes, then 1 for each of the 4 started after. */
const SESSION_MS = 840_000;
const STEP_MS = 250;
const PACE_WINDOW_MS = 15_000;
const PACE_HOP_MS = 5_000;
/** The flags' own threshold for a long pause. */
const LONG_PAUSE_MS = 1_200;
/** What the interviewer's speech takes per word (browser speech is slower than people). */
const TTS_MS_PER_WORD = 390;
/** Between a sent answer and the next question: the model writing, then speech starting. */
const REPLY_LATENCY_MS = 3_000;
const TRAILING_BASE_MS = 3_000;

interface SegmentScript {
  text: string;
  wpm: number;
  /** Silence after this segment; the last one's is ignored. */
  pauseMs: number;
  /** Scales the answer's pitch movement for this segment (a flatly said line). */
  pitch?: number;
}

interface AnswerScript {
  questionId: string;
  /** What the interviewer says; the bank question is its last sentence. */
  ask: string;
  leadInMs: number;
  /** Loudness against the session median, dB. */
  energyDb: number;
  /** Loudness change from the first word to the last, dB. */
  energySlopeDb: number;
  /** How far pitch moves either side of the answer's centre, semitones. */
  pitchSpread: number;
  segments: SegmentScript[];
}

const q = (id: string): string => {
  for (const bank of Object.values(QUESTION_BANK)) {
    const hit = bank.find((entry) => entry.id === id);
    if (hit) return hit.text;
  }
  throw new Error(`fixtures: no bank question ${id}`);
};

const SCRIPT: AnswerScript[] = [
  {
    questionId: "beh-owned-outcome",
    ask: `Thanks for making the time today. This is a practice run of the design craft round at Vercel. I'll ask seven questions, and there's no rush on any of them, so take a moment before you answer if you need one. Let's start with a story. ${q("beh-owned-outcome")}`,
    leadInMs: 1_400,
    energyDb: 1.2,
    energySlopeDb: 0.3,
    pitchSpread: 3.0,
    segments: [
      { text: "Sure. The one I'd pick is the checkout redesign I led at Tally last year. It ran for about eight weeks, from the first research call to launch, and I was the only designer on it.", wpm: 146, pauseMs: 700 },
      { text: "Checkout had six steps at the time, and our funnel data showed that almost forty percent of new customers dropped off before they ever made their first payment, which was hurting revenue every single month.", wpm: 148, pauseMs: 900 },
      { text: "Because I owned the whole thing, I ran the customer interviews myself, wrote the brief for the team, and made the call to cut the flow down from six screens to just two.", wpm: 144, pauseMs: 800 },
      { text: "Basically, I moved account creation to after payment and pulled the plan picker into the very first screen, which removed three of the six steps outright without losing any information we needed.", wpm: 150, pauseMs: 1_000 },
      { text: "Before we built anything, I tested two prototypes with eight customers over two days, and the two screen version won on every single task we measured, including the time it took to pay.", wpm: 147, pauseMs: 700 },
      { text: "We launched it to half of new accounts first, watched the numbers for a week to make sure nothing had broken for the other half, and then rolled it out to everyone.", wpm: 145, pauseMs: 900 },
      { text: "After launch, time to first payment went from four minutes to ninety seconds, and setup tickets dropped by about a third in the first month, which the support team noticed straight away.", wpm: 143, pauseMs: 0 },
    ],
  },
  {
    questionId: "port-handoff",
    ask: `Thanks, that's a clear example with real numbers in it. Staying with the same project for a moment, I'd like to hear how the work moved from design into the build. ${q("port-handoff")}`,
    leadInMs: 1_200,
    energyDb: 0.9,
    energySlopeDb: 0,
    pitchSpread: 3.2,
    segments: [
      { text: "Honestly, the handoff started on day one, because I asked for an engineer to join the research calls long before there was anything to hand over.", wpm: 152, pauseMs: 800 },
      { text: "Priya, our lead engineer, sat in on four of the eight interviews, so she heard the same complaints I did, and she could flag anything expensive while it was still just a sketch.", wpm: 155, pauseMs: 700 },
      { text: "We kept one shared document of decisions, with the date and the reason for each one, and by the end that document had replaced the usual handoff spec almost entirely.", wpm: 156, pauseMs: 900 },
      { text: "When I moved to high fidelity I built every screen from our existing component library, so there were only two new patterns for the team to build and test from scratch.", wpm: 172, pauseMs: 500 },
      { text: "For those two patterns I recorded short walkthrough videos and wrote out the edge cases, like expired cards and declined payments, right next to the designs where engineers would look first.", wpm: 170, pauseMs: 900 },
      { text: "I also stayed in the team channel for the whole build and answered questions within the hour, which kept small questions from turning into blocked tickets.", wpm: 155, pauseMs: 800 },
      { text: "We shipped a week ahead of plan, and the final review found three small visual bugs and no logic changes at all, which I was really proud of.", wpm: 154, pauseMs: 0 },
    ],
  },
  {
    questionId: "beh-pushback-eng",
    ask: `Good, that shows how you work with a team day to day. Let's move to working with engineers when you don't agree with them. ${q("beh-pushback-eng")}`,
    leadInMs: 4_200,
    energyDb: 0.5,
    energySlopeDb: -0.6,
    pitchSpread: 2.8,
    segments: [
      { text: "Um, let me think of a good one for that.", wpm: 118, pauseMs: 1_600 },
      { text: "Okay, so, um, on the same project, engineering told us that infinite scroll on the transactions list would take three extra weeks to build properly, because the pagination underneath it was complicated.", wpm: 134, pauseMs: 900 },
      { text: "My first reaction was to push for it anyway, because the design felt cleaner, but I, uh, wanted to check whether anyone really needed it before I spent the team's time arguing.", wpm: 133, pauseMs: 1_300 },
      { text: "So I pulled the usage data, and it showed that fewer than five percent of sessions ever scrolled past the second page of transactions, even for our biggest accounts.", wpm: 136, pauseMs: 800 },
      { text: "I went back to the team with that number and suggested simple pagination with a search box instead, and we shipped it three weeks earlier than the original plan.", wpm: 135, pauseMs: 900 },
      { text: "Nobody on the team felt overruled, because the decision came from what customers were doing rather than from my opinion or theirs.", wpm: 132, pauseMs: 700 },
      { text: "Support never got a single request for infinite scroll afterwards, and I have used that habit of checking the data first in every constraint discussion since then.", wpm: 131, pauseMs: 0 },
    ],
  },
  {
    questionId: "port-cut",
    ask: `That's a useful habit, and a good example of letting the data settle a disagreement. Back to the checkout project, and the things that didn't make it in. ${q("port-cut")}`,
    leadInMs: 1_300,
    energyDb: 0.8,
    energySlopeDb: 0.4,
    pitchSpread: 3.4,
    segments: [
      { text: "The biggest cut was bulk editing, which customers asked for in almost every interview we ran, so it was not an easy one to let go of.", wpm: 150, pauseMs: 600 },
      { text: "It tested really well, but it only mattered to about eight percent of accounts, mostly agencies managing lots of clients, and building it properly meant a new permissions model, new empty states and another round of security review before launch.", wpm: 188, pauseMs: 300 },
      { text: "We also cut saved payment methods for teams, a dark theme for the checkout pages, and the custom receipt templates that sales had already promised to two of our largest customers.", wpm: 186, pauseMs: 900 },
      { text: "Each of those would have pushed the launch back by one to three weeks, and none of them did anything for the drop off problem we were there to fix.", wpm: 150, pauseMs: 800 },
      { text: "I wrote up every cut with the data behind it and shared it with sales and support before launch, so nobody was surprised when a customer asked.", wpm: 146, pauseMs: 700 },
      { text: "For the two customers sales had made promises to, I joined the calls myself to explain the trade off and give them a date for the templates.", wpm: 148, pauseMs: 900 },
      { text: "We added bulk editing two months later, once the new checkout had real adoption data behind it, and it shipped in half the time we first estimated.", wpm: 147, pauseMs: 0 },
    ],
  },
  {
    questionId: "beh-disagree",
    ask: `Thanks, the trade-offs came through clearly there. The next one is about disagreement inside your own team rather than with engineering. ${q("beh-disagree")}`,
    leadInMs: 1_600,
    energyDb: 0.1,
    energySlopeDb: -0.2,
    pitchSpread: 3.0,
    segments: [
      { text: "So, um, our product manager wanted to ship the new onboarding without any usability testing, because we were, like, already two weeks behind on the roadmap.", wpm: 148, pauseMs: 900 },
      { text: "I disagreed, because the old onboarding had been built the same way, and it was, you know, the main reason people contacted support in their first week with us.", wpm: 151, pauseMs: 800 },
      { text: "Instead of arguing about it in the meeting, I offered to run a three day guerrilla test with six customers, um, using the prototype we already had ready.", wpm: 150, pauseMs: 1_000 },
      { text: "Four of the six got stuck on the same step, which was connecting their bank account, and that was, like, pretty hard for anyone to argue with.", wpm: 152, pauseMs: 700 },
      { text: "We fixed that step with a clearer prompt and a fallback for entering details by hand, and the product manager agreed to a one week delay to get it right.", wpm: 149, pauseMs: 900 },
      { text: "Afterwards I wrote up the test plan and the results on a single page, so the next team could run the same test in a day without starting from nothing.", wpm: 150, pauseMs: 900 },
      { text: "Completed onboarding went up fourteen percent after launch, and we now test every flow that touches money before it ships, which has become a team habit.", wpm: 150, pauseMs: 0 },
    ],
  },
  {
    questionId: "port-metric",
    ask: `Good. You've mentioned a few numbers already, so let's go deeper on how you measured the work and how you knew the gains held up. ${q("port-metric")}`,
    leadInMs: 1_500,
    energyDb: -0.9,
    energySlopeDb: -0.6,
    pitchSpread: 3.1,
    segments: [
      { text: "We agreed on two measures before launch, so that we could not pick the flattering ones afterwards and tell ourselves a nicer story than the data did.", wpm: 144, pauseMs: 800 },
      { text: "The first was time to first payment, which we tracked for every new account in the four weeks before the release and the four weeks after it.", wpm: 145, pauseMs: 900 },
      { text: "It dropped from four minutes to ninety seconds, and support tickets tagged as checkout confusion fell by thirty-one percent in the first month after we launched.", wpm: 142, pauseMs: 1_000, pitch: 0.3 },
      { text: "The second was drop off at the payment step, which went from thirty eight percent down to eleven percent, and it has stayed around there ever since.", wpm: 146, pauseMs: 800 },
      { text: "I also watched ten session recordings a week for a month, because the numbers can tell you that people hesitate but not where or why they do it.", wpm: 144, pauseMs: 700 },
      { text: "I shared a short clip from those recordings in every weekly review, which kept the whole team looking at the same problems instead of guessing.", wpm: 143, pauseMs: 900 },
      { text: "Those recordings led to two small follow up fixes on the plan picker, which I designed and shipped in the very next sprint.", wpm: 145, pauseMs: 0 },
    ],
  },
  {
    questionId: "beh-failure",
    ask: `Thanks. Last question, and it's about something that went wrong, so be as candid as you like about what you would change now. ${q("beh-failure")}`,
    leadInMs: 2_100,
    energyDb: -2.6,
    energySlopeDb: -4.0,
    pitchSpread: 1.3,
    segments: [
      { text: "A dashboard redesign I led the year before is the clearest example I have of that.", wpm: 126, pauseMs: 900 },
      { text: "I based the whole thing on interviews with five power users, and I was completely sure the new layout would make the daily numbers much easier to find.", wpm: 129, pauseMs: 1_000 },
      { text: "After launch, adoption barely moved, and when I finally looked at the usage data I saw that most daily visits came from a group I had not talked to at all.", wpm: 128, pauseMs: 1_400 },
      { text: "Those were finance people who opened the dashboard once a day to export a single report, and the new layout had moved that export two clicks deeper than before.", wpm: 128, pauseMs: 900 },
      { text: "We put the export back on the first screen within a week, and I started weighting research by how much each group really uses the product day to day.", wpm: 127, pauseMs: 1_000 },
      { text: "I also went back to the five power users and showed them the change, and none of them minded, because the export sat where they expected it as well.", wpm: 127, pauseMs: 1_000 },
      { text: "It was a humbling one, and it is the reason I now look at usage data before I decide who to interview for any project.", wpm: 126, pauseMs: 0 },
    ],
  },
];

const CLOSING = "That's all seven questions. Thank you, that was a strong session. Your report will be ready in a few minutes, with the recording and a breakdown of how you delivered each answer.";

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** mulberry32: small, fast and the same on every machine. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
// Latin letters by range: `\p{L}` needs the `u` flag, which needs an ES2018 target.
const wordsOf = (text: string) =>
  text
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^0-9A-Za-zÀ-ɏ']/g, ""))
    .filter((w) => w.length > 0);
const ttsMs = (text: string) => wordsOf(text).length * TTS_MS_PER_WORD;
const speechMsOf = (segment: SegmentScript) => Math.round((wordsOf(segment.text).length * 60_000) / segment.wpm);

/** The filler rule, as far as this script needs it: filled pauses always, "like" and "you know" only when set off by commas. */
const FILLER_PATTERN = /\b(um|uh|basically|actually)\b|,\s*(like|you know),/gi;
const fillersIn = (text: string) => (text.match(FILLER_PATTERN) ?? []).length;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * p;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

const median = (values: number[]) => percentile(values, 0.5);

interface BuiltAnswer {
  script: AnswerScript;
  number: number;
  turnId: string;
  questionTurnId: string;
  startMs: number;
  endMs: number;
  speechStartMs: number;
  speechEndMs: number;
  segments: DeliveryTranscriptSegment[];
  words: DeliveryTranscriptWord[];
  wordCount: number;
  speechMs: number;
}

function build() {
  const random = seeded(0x5e55_1014);

  // Everything but the trailing silence after each answer is fixed by the
  // script; the trailing silence (reviewing the captions before sending)
  // takes up what is left of the 14 minutes, evenly.
  const fixedMs = SCRIPT.reduce((sum, a) => {
    const speech = a.segments.reduce((s, seg) => s + speechMsOf(seg), 0);
    const pauses = a.segments.slice(0, -1).reduce((s, seg) => s + seg.pauseMs, 0);
    return sum + ttsMs(a.ask) + a.leadInMs + speech + pauses + TRAILING_BASE_MS + REPLY_LATENCY_MS;
  }, ttsMs(CLOSING));
  const extraTrailingMs = Math.max(0, Math.floor((SESSION_MS - fixedMs) / SCRIPT.length));

  const turns: PrepTurn[] = [];
  const answers: BuiltAnswer[] = [];
  let clock = 0;

  SCRIPT.forEach((script, index) => {
    const number = index + 1;
    const questionTurnId = `turn-q${number}`;
    const turnId = `turn-a${number}`;
    const askEnd = clock + ttsMs(script.ask);
    turns.push({ id: questionTurnId, who: "ai", questionId: script.questionId, text: script.ask, source: "voice", startMs: clock, endMs: askEnd });

    let cursor = askEnd + script.leadInMs;
    const segments: DeliveryTranscriptSegment[] = [];
    const words: DeliveryTranscriptWord[] = [];
    let wordCount = 0;
    let speechMs = 0;
    script.segments.forEach((seg, k) => {
      const tokens = wordsOf(seg.text);
      const total = speechMsOf(seg);
      // Longer words take longer to say; a little jitter keeps it human.
      const weights = tokens.map((w) => 0.6 + Math.min(w.length, 10) * 0.12 + random() * 0.15);
      const weightSum = weights.reduce((a, b) => a + b, 0);
      const start = Math.round(cursor);
      tokens.forEach((w, i) => {
        const duration = (total * weights[i]) / weightSum;
        words.push({ w, s: Math.round(cursor), e: Math.round(cursor + duration * 0.86) });
        cursor += duration;
      });
      const end = words[words.length - 1].e;
      segments.push({ id: `seg-${number}-${k + 1}`, text: seg.text, startMs: start, endMs: end, turnId });
      wordCount += tokens.length;
      speechMs += total;
      if (k < script.segments.length - 1) cursor = end + seg.pauseMs;
    });

    const speechStartMs = segments[0].startMs;
    const speechEndMs = segments[segments.length - 1].endMs;
    const endMs = speechEndMs + TRAILING_BASE_MS + extraTrailingMs;
    const text = script.segments.map((s) => s.text).join(" ");
    turns.push({
      id: turnId,
      who: "user",
      questionId: script.questionId,
      text,
      // What the live captions showed: close, not identical.
      liveText: text.replace("Tally", "tally").replace("guerrilla", "gorilla").replace("Priya", "Pria"),
      source: "voice",
      startMs: askEnd,
      endMs,
    });
    answers.push({ script, number, turnId, questionTurnId, startMs: askEnd, endMs, speechStartMs, speechEndMs, segments, words, wordCount, speechMs });
    clock = endMs + REPLY_LATENCY_MS;
  });

  const closingEnd = Math.min(SESSION_MS, clock + ttsMs(CLOSING));
  turns.push({ id: "turn-close", who: "ai", text: CLOSING, source: "voice", startMs: clock, endMs: closingEnd });
  const durationMs = Math.max(SESSION_MS, closingEnd);

  // -- Series: pitch and energy every 250 ms, only while the user is speaking.
  const steps = Math.ceil(durationMs / STEP_MS);
  const pitchSt: Array<number | null> = new Array(steps).fill(null);
  const energyDb: Array<number | null> = new Array(steps).fill(null);
  for (const answer of answers) {
    const { script } = answer;
    const phase = random() * Math.PI * 2;
    const drift = (random() - 0.5) * 0.8;
    answer.segments.forEach((segment, k) => {
      const spread = script.pitchSpread * (script.segments[k].pitch ?? 1);
      for (let i = Math.ceil(segment.startMs / STEP_MS); i * STEP_MS < segment.endMs && i < steps; i++) {
        const t = i * STEP_MS;
        const along = (t - answer.speechStartMs) / Math.max(1, answer.speechEndMs - answer.speechStartMs);
        // Intonation moves over a few seconds, with syllable-level jitter on top.
        const wave = 0.55 * Math.sin((2 * Math.PI * t) / 4_700 + phase) + 0.35 * Math.sin((2 * Math.PI * t) / 11_300 + phase * 1.7) + 0.35 * (random() - 0.5);
        pitchSt[i] = round2(drift + spread * wave);
        const pulse = 1.2 * Math.sin((2 * Math.PI * t) / 5_300 + phase) + 1.1 * (random() - 0.5);
        energyDb[i] = round2(script.energyDb + script.energySlopeDb * (along - 0.5) + pulse);
      }
    });
  }

  // -- Pace: words starting in each 15 s window inside an answer, times four.
  const pace: DeliverySeries["pace"] = [];
  for (const answer of answers) {
    // Whole windows only: one hanging past the last word would read as a slowdown that never happened.
    for (let centre = answer.speechStartMs + PACE_WINDOW_MS / 2; centre + PACE_WINDOW_MS / 2 <= answer.speechEndMs; centre += PACE_HOP_MS) {
      const from = centre - PACE_WINDOW_MS / 2;
      const to = centre + PACE_WINDOW_MS / 2;
      const speaking = answer.segments.reduce((sum, s) => sum + Math.max(0, Math.min(to, s.endMs) - Math.max(from, s.startMs)), 0);
      if (speaking / PACE_WINDOW_MS < 0.5) continue;
      const count = answer.words.filter((w) => w.s >= from && w.s < to).length;
      pace.push({ atMs: Math.round(centre), wpm: count * 4 });
    }
  }

  // -- Per answer.
  const inAnswer = (values: Array<number | null>, a: BuiltAnswer) =>
    values.slice(Math.floor(a.startMs / STEP_MS), Math.ceil(a.endMs / STEP_MS)).filter((v): v is number => v !== null);
  const deliveryAnswers: DeliveryAnswer[] = answers.map((a) => ({
    turnId: a.turnId,
    startMs: a.startMs,
    endMs: a.endMs,
    wpm: Math.round((a.wordCount * 60_000) / a.speechMs),
    pitchRangeSt: round1(percentile(inAnswer(pitchSt, a), 0.95) - percentile(inAnswer(pitchSt, a), 0.05)),
    energyDeltaDb: round1(median(inAnswer(energyDb, a))),
    leadInMs: a.speechStartMs - a.startMs,
    fillers: fillersIn(a.script.segments.map((s) => s.text).join(" ")),
  }));

  // -- Session metrics.
  const totalWords = answers.reduce((s, a) => s + a.wordCount, 0);
  const totalSpeech = answers.reduce((s, a) => s + a.segments.reduce((x, seg) => x + (seg.endMs - seg.startMs), 0), 0);
  const totalWindow = answers.reduce((s, a) => s + (a.endMs - a.startMs), 0);
  const totalFillers = deliveryAnswers.reduce((s, a) => s + a.fillers, 0);
  const allPitch = pitchSt.filter((v): v is number => v !== null);
  const energies = deliveryAnswers.map((a) => a.energyDeltaDb ?? 0);
  const meanX = (energies.length - 1) / 2;
  const meanY = energies.reduce((a, b) => a + b, 0) / energies.length;
  const slope =
    energies.reduce((s, y, x) => s + (x - meanX) * (y - meanY), 0) / energies.reduce((s, _y, x) => s + (x - meanX) ** 2, 0);
  const longPauses = SCRIPT.reduce((n, a) => n + a.segments.slice(0, -1).filter((s) => s.pauseMs >= LONG_PAUSE_MS).length, 0);

  const metrics: DeliveryMetrics = {
    wpmMean: Math.round((totalWords * 60_000) / answers.reduce((s, a) => s + a.speechMs, 0)),
    wpmReferenceBand: { low: 140, high: 160 },
    pitchVariationSt: round1(percentile(allPitch, 0.95) - percentile(allPitch, 0.05)),
    energyTrendDbPerAnswer: round2(slope),
    speechRatio: round2(totalSpeech / totalWindow),
    fillersPer100Words: round1((totalFillers / totalWords) * 100),
    longPauses,
  };

  return { turns, answers, deliveryAnswers, durationMs, series: { stepMs: STEP_MS, pace, pitchSt, energyDb }, metrics, totalWords, totalFillers };
}

const BUILT = build();
const { answers: BUILT_ANSWERS, deliveryAnswers: DELIVERY_ANSWERS, metrics: METRICS } = BUILT;

const answer = (n: number) => BUILT_ANSWERS[n - 1];
const deliveryAnswer = (n: number) => DELIVERY_ANSWERS[n - 1];
const segment = (n: number, k: number) => answer(n).segments[k - 1];
const firstWord = (n: number, w: string) => {
  const hit = answer(n).words.find((x) => x.w.toLowerCase() === w);
  if (!hit) throw new Error(`fixtures: answer ${n} has no "${w}"`);
  return hit;
};
const others = (n: number, pick: (a: DeliveryAnswer, i: number) => number | null) =>
  DELIVERY_ANSWERS.flatMap((a, i) => (i === n - 1 ? [] : [pick(a, i)])).filter((v): v is number => v !== null);

// ---------------------------------------------------------------------------
// Flags: one or two of every kind, placed by the same rules the pipeline uses
// ---------------------------------------------------------------------------

function fastestWindow(n: number) {
  const a = answer(n);
  const inside = BUILT.series.pace.filter((p) => p.atMs >= a.startMs && p.atMs < a.endMs);
  return inside.reduce((best, p) => (p.wpm > best.wpm ? p : best), inside[0]);
}

/** The 10 s stretch of an answer where pitch moved least. */
function flattestStretch(n: number) {
  const a = answer(n);
  const span = 10_000;
  let best = { atMs: a.speechStartMs, range: Infinity };
  for (let from = a.speechStartMs; from + span <= a.speechEndMs; from += 1_000) {
    const values = BUILT.series.pitchSt.slice(Math.floor(from / STEP_MS), Math.floor((from + span) / STEP_MS)).filter((v): v is number => v !== null);
    if (values.length < (span / STEP_MS) * 0.6) continue;
    const range = Math.max(...values) - Math.min(...values);
    if (range < best.range) best = { atMs: from, range };
  }
  return best;
}

function fadeStart(n: number) {
  const a = answer(n);
  const i = BUILT.series.energyDb.findIndex((v, idx) => idx * STEP_MS >= a.speechStartMs && idx * STEP_MS < a.speechEndMs && v !== null && v < -1.5);
  return i < 0 ? a.speechStartMs : i * STEP_MS;
}

function segmentPitchRange(n: number, k: number) {
  const s = segment(n, k);
  const values = BUILT.series.pitchSt.slice(Math.ceil(s.startMs / STEP_MS), Math.ceil(s.endMs / STEP_MS)).filter((v): v is number => v !== null);
  return round1(percentile(values, 0.95) - percentile(values, 0.05));
}

const RUSH = fastestWindow(4);
const RUSH_2 = fastestWindow(2);
const FLAT = flattestStretch(7);
const FADE_AT = fadeStart(7);
const UM_5 = firstWord(5, "um");
const UM_3 = firstWord(3, "um");
const fillersPer100 = (n: number) => round1((deliveryAnswer(n).fillers / answer(n).wordCount) * 100);
const leadIn3 = deliveryAnswer(3).leadInMs ?? 0;
const otherLeadIns = median(others(3, (a) => a.leadInMs));
const slope7 = SCRIPT[6].energySlopeDb;
const otherSlopes = round1(SCRIPT.filter((_, i) => i !== 6).reduce((s, a) => s + a.energySlopeDb, 0) / (SCRIPT.length - 1));

const FLAGS: DeliveryFlag[] = [
  {
    id: "flag-rushing-4",
    kind: "rushing",
    turnId: answer(4).turnId,
    atMs: RUSH.atMs - PACE_WINDOW_MS / 2,
    endMs: RUSH.atMs + PACE_WINDOW_MS / 2,
    severity: 3,
    measure: { label: "Pace", value: RUSH.wpm, baseline: METRICS.wpmMean ?? 0, unit: "wpm" },
    coaching: "Slow down when you list what you cut. A breath after each item gives the panel time to weigh it.",
  },
  {
    id: "flag-rushing-2",
    kind: "rushing",
    turnId: answer(2).turnId,
    atMs: RUSH_2.atMs - PACE_WINDOW_MS / 2,
    endMs: RUSH_2.atMs + PACE_WINDOW_MS / 2,
    severity: 1,
    measure: { label: "Pace", value: RUSH_2.wpm, baseline: METRICS.wpmMean ?? 0, unit: "wpm" },
    coaching: "You picked up speed on the handoff details. Pause before the part about edge cases; it's the detail engineers care about most.",
  },
  {
    id: "flag-monotone-7",
    kind: "monotone",
    turnId: answer(7).turnId,
    atMs: FLAT.atMs,
    endMs: FLAT.atMs + 10_000,
    severity: 2,
    measure: { label: "Pitch range", value: deliveryAnswer(7).pitchRangeSt ?? 0, baseline: round1(median(others(7, (a) => a.pitchRangeSt))), unit: "st" },
    coaching: "Let your voice rise on the turn in the story. “Adoption barely moved” deserves more lift than the setup before it.",
  },
  {
    id: "flag-fading-7",
    kind: "fading-energy",
    turnId: answer(7).turnId,
    atMs: FADE_AT,
    endMs: answer(7).speechEndMs,
    severity: 2,
    measure: { label: "Loudness across the answer", value: slope7, baseline: otherSlopes, unit: "dB" },
    coaching: "Your volume dropped as this answer went on. Finish the last sentence as loudly as you started the first.",
  },
  {
    id: "flag-hesitation-3",
    kind: "hesitation",
    turnId: answer(3).turnId,
    atMs: answer(3).startMs,
    endMs: answer(3).speechStartMs,
    severity: 2,
    measure: { label: "Lead-in", value: leadIn3, baseline: otherLeadIns, unit: "ms" },
    coaching: "A long silence before the first word. If you need time, say so in a few words, then take it.",
  },
  {
    id: "flag-fillers-5",
    kind: "fillers",
    turnId: answer(5).turnId,
    atMs: UM_5.s,
    endMs: segment(5, 4).endMs,
    severity: 2,
    measure: { label: "Fillers", value: fillersPer100(5), baseline: METRICS.fillersPer100Words ?? 0, unit: "per 100 words" },
    coaching: "“Um”, “like” and “you know” clustered in this answer. Replace each with a short pause.",
  },
  {
    id: "flag-fillers-3",
    kind: "fillers",
    turnId: answer(3).turnId,
    atMs: UM_3.s,
    endMs: UM_3.e,
    severity: 1,
    measure: { label: "Fillers", value: fillersPer100(3), baseline: METRICS.fillersPer100Words ?? 0, unit: "per 100 words" },
    coaching: "The opening “um” filled the silence you were already taking. Silence alone reads as thinking.",
  },
  {
    id: "flag-flat-value-6",
    kind: "flat-value-prop",
    turnId: answer(6).turnId,
    atMs: segment(6, 3).startMs,
    endMs: segment(6, 3).endMs,
    severity: 2,
    measure: { label: "Pitch range", value: segmentPitchRange(6, 3), baseline: deliveryAnswer(6).pitchRangeSt ?? 0, unit: "st" },
    coaching: "Your strongest result came out flatter than the rest of the answer. Slow down and lift your voice on “thirty-one percent”.",
  },
];

// ---------------------------------------------------------------------------
// Summary and report
// ---------------------------------------------------------------------------

const seconds = (ms: number) => round1(ms / 1000).toFixed(1);
const inBand = METRICS.wpmMean !== null && METRICS.wpmMean >= 140 && METRICS.wpmMean <= 160;

const SUMMARY: DeliverySummaryLine[] = [
  {
    id: "sum-1",
    text: `Your pace averaged ${METRICS.wpmMean} words a minute, ${inBand ? "inside" : "outside"} the 140–160 range, and your first answer set a clear, steady tone.`,
    atMs: answer(1).startMs,
    endMs: answer(1).endMs,
  },
  {
    id: "sum-2",
    text: `In answer 4 you sped up to ${RUSH.wpm} words a minute while listing what you cut, which buried the reasons behind each cut.`,
    atMs: FLAGS[0].atMs,
    endMs: FLAGS[0].endMs,
  },
  {
    id: "sum-3",
    text: `Answer 3 opened with ${seconds(leadIn3)} seconds of silence and an “um” before your first real sentence.`,
    atMs: FLAGS[4].atMs,
    endMs: answer(3).speechStartMs + 3_000,
  },
  {
    id: "sum-4",
    text: `Your strongest number, the thirty-one percent drop in tickets, was said more flatly than the rest of answer 6.`,
    atMs: FLAGS[7].atMs,
    endMs: FLAGS[7].endMs,
  },
  {
    id: "sum-5",
    text: `Your last answer lost volume as it went, ${Math.abs(slope7).toFixed(1)} dB from its first sentence to its last, and its pitch moved less than in any other answer.`,
    atMs: FLAGS[3].atMs,
    endMs: FLAGS[3].endMs,
  },
];

const quote = (n: number, k: number): Pick<EvidenceItem, "quote" | "question" | "atMs" | "endMs"> => ({
  quote: segment(n, k).text,
  question: q(SCRIPT[n - 1].questionId),
  atMs: segment(n, k).startMs,
  endMs: segment(n, k).endMs,
});

const DIMENSIONS: DimensionScore[] = [
  {
    id: "structure",
    label: "Structure",
    score: 7.4,
    note: "Mostly there, but a couple of answers skipped straight to the result.",
    evidence: [
      {
        id: "ev-structure-1",
        ...quote(4, 2),
        note: "Three reasons in one breath. The decision is in there, but the listener has to dig for it.",
        fix: "It tested well, but it only mattered to eight percent of accounts. Building it properly meant a new permissions model, so I cut it.",
      },
    ],
    howToImprove: "Open with the situation, name the call you made, then land on what changed. Same story, three beats.",
  },
  {
    id: "specifics",
    label: "Specifics & numbers",
    score: 8.2,
    note: "Numbers backed up nearly every claim.",
    evidence: [
      {
        id: "ev-specifics-1",
        ...quote(7, 2),
        note: "The one story without a figure: how many people did the new layout affect?",
        fix: "I based it on five power users, who turned out to be under ten percent of daily visits.",
      },
    ],
    howToImprove: "Put one figure on every story — users, percent, latency, weeks. One is enough; vague scale reads as no scale.",
  },
  {
    id: "pace",
    label: "Pace",
    score: 6.8,
    note: `${METRICS.wpmMean} words a minute on average, with one rushed stretch in answer 4.`,
    evidence: [
      { id: "ev-pace-1", ...quote(4, 3), note: `Around ${RUSH.wpm} words a minute here, well above your own average.` },
      { id: "ev-pace-2", ...quote(7, 3), note: "The slowest answer of the session. Slower is fine; losing volume at the same time is what to watch." },
    ],
    howToImprove: "Aim for 130-160 words a minute and keep answers near 90 seconds. Past two minutes a panel starts waiting for the end.",
  },
  {
    id: "ownership",
    label: "Ownership",
    score: 7.9,
    note: "Your own calls come through clearly in most answers.",
    evidence: [
      {
        id: "ev-ownership-1",
        ...quote(5, 5),
        note: "“We fixed that step” hides that the fix was your design.",
        fix: "I redesigned that step with a clearer prompt and a manual fallback, and the product manager agreed to a one week delay.",
      },
    ],
    howToImprove: "Name your own decision first, the team's contribution second. “I decided X, and we shipped it” beats “we decided X”.",
  },
  {
    id: "relevance",
    label: "Relevance",
    score: 8.4,
    note: "Every answer stayed on the question asked.",
    evidence: [],
    howToImprove: "Restate the question in one sentence before you answer it. It costs three seconds and keeps you on target.",
  },
  {
    id: "confidence",
    label: "Confidence",
    score: 6.2,
    note: "A slow start in answer 3 and a cluster of fillers in answer 5.",
    evidence: [
      { id: "ev-confidence-1", ...quote(3, 1), note: `${seconds(leadIn3)} seconds of silence, then a filler, before the answer began.`, fix: "Good question. Give me a second. … On the checkout project, engineering told us…" },
      { id: "ev-confidence-2", ...quote(5, 1), note: "Two fillers in the opening sentence." },
    ],
    howToImprove: "Cut the hedge and stop on a full stop. The same sentence without “maybe” reads as a decision rather than a guess.",
  },
];

const LANGUAGE_STATS: LanguageStat[] = [
  {
    id: "wpm",
    label: "Words per minute",
    value: `${METRICS.wpmMean} · ${inBand ? "in band" : "out of band"}`,
    good: inBand,
    evidence: DIMENSIONS[2].evidence,
    howToImprove: "130-160 is the band that reads as composed. Below it you sound hesitant, above it rushed.",
  },
  {
    id: "fillers",
    label: "Filler words",
    value: `${BUILT.totalFillers} across your answers`,
    good: BUILT.totalFillers <= 3,
    evidence: [{ id: "ev-fillers-1", ...quote(5, 2), note: "“You know” mid-sentence, where a pause would do." }],
    howToImprove: "A short silence beats a filler every time. Pause, then start the sentence.",
  },
  {
    id: "ownership-ratio",
    label: "“I” vs “we”",
    value: "1.8 to 1",
    good: true,
    evidence: DIMENSIONS[3].evidence,
    howToImprove: "Aim past 1.5 to 1. Below that the panel can't separate your work from your team's.",
  },
  {
    id: "longest",
    label: "Longest answer",
    value: `${Math.max(...BUILT_ANSWERS.map((a) => a.wordCount))} words`,
    good: false,
    evidence: [{ id: "ev-longest-1", ...quote(1, 1), note: "Answer 1 ran longest. The last two sentences carried the result; the rest could be shorter." }],
    howToImprove: "Keep the longest answer under about 180 words, then offer to go deeper. Let them ask for more.",
  },
];

function bankEntry(id: string) {
  const entry = Object.values(QUESTION_BANK)
    .flat()
    .find((e) => e.id === id);
  if (!entry) throw new Error(`fixtures: no bank entry ${id}`);
  return entry;
}

const REWRITES: Rewrite[] = [4, 7].map((n) => {
  const entry = bankEntry(SCRIPT[n - 1].questionId);
  return {
    id: `rw-${n}`,
    question: entry.text,
    said: answer(n).segments.map((s) => s.text).join(" "),
    better: entry.better,
    why: entry.why,
    atMs: answer(n).startMs,
    endMs: answer(n).endMs,
  };
});

const ACTION_ITEMS: ActionItem[] = [
  {
    id: "act-voice-pace",
    title: "Run a timed drill at a steadier pace",
    detail: "Retell the what-you-cut story at 130-160 words a minute, pausing after each item.",
    effortMinutes: 10,
    done: false,
    source: "From today's session",
    atMs: FLAGS[0].atMs,
    endMs: FLAGS[0].endMs,
  },
  {
    id: "act-voice-start",
    title: "Practise a clean first sentence",
    detail: "For three questions, say your opening line out loud before you think about the rest.",
    effortMinutes: 6,
    done: false,
    source: "From today's session",
    atMs: FLAGS[4].atMs,
    endMs: FLAGS[4].endMs,
  },
  {
    id: "act-voice-result",
    title: "Land your best number with some lift",
    detail: "Read your key result three times, slowing down and raising your voice on the figure.",
    effortMinutes: 5,
    done: false,
    source: "From today's session",
    atMs: FLAGS[7].atMs,
    endMs: FLAGS[7].endMs,
  },
];

// ---------------------------------------------------------------------------
// Positioning and Diction & Grammar
// ---------------------------------------------------------------------------
//
// Shaped as the AI service's `insights` step writes them. Every quote is a
// sentence of this script (or a stretch of one), placed where it was said. The
// demo track has no posting, so the two criteria that need one say so rather
// than guess — the honest state a track without a saved job really shows.

const said = (n: number, k: number, part?: string): AnswerQuote => {
  const text = segment(n, k).text;
  if (part !== undefined && !text.includes(part)) throw new Error(`fixtures: "${part}" is not in answer ${n}, sentence ${k}`);
  return { quote: part ?? text, turnId: answer(n).turnId, question: q(SCRIPT[n - 1].questionId), atMs: segment(n, k).startMs, endMs: segment(n, k).endMs };
};

const PROBES: Record<PositioningCriterionId, PositioningCriterion["probe"]> = {
  "values-match": {
    format: "behavioural",
    kind: "A values story",
    example: "Tell me about a time you had to choose between doing something fast and doing it right. Which did you pick, and why?",
  },
  adaptability: { format: "behavioural", kind: "A setback story", example: "Tell me about a project that went wrong. What did you do next?" },
  "analytical-approach": { format: "portfolio", kind: "An open-ended problem", example: "Walk me through how you broke down the least well-defined problem you've worked on." },
  "decision-trade-offs": { format: "portfolio", kind: "A trade-off", example: "What did you cut from a project, and why that rather than something else?" },
  "active-listening": {
    format: "behavioural",
    kind: "A disagreement story",
    example: "Tell me about a time a teammate disagreed with you. How did you make sure you understood their view?",
  },
  "cross-functional-communication": {
    format: "behavioural",
    kind: "A stakeholder story",
    example: "Tell me about a time you explained a technical decision to someone outside your field.",
  },
  "learning-agility": { format: "behavioural", kind: "A learning story", example: "Tell me about something you had to learn quickly for a project. How did you go about it?" },
  "role-trajectory": { format: "behavioural", kind: "A goals question", example: "Where do you want to be in two years, and how does this role get you there?" },
};

const NO_POSTING = "This needs the job posting, and this track has none to read.";

const CRITERIA: PositioningCriterion[] = [
  { id: "values-match", area: "alignment", label: "Core Values Match", level: "not-enough-evidence", note: NO_POSTING, evidence: [], posting: [], gap: "no-posting", probe: PROBES["values-match"] },
  {
    id: "adaptability",
    area: "alignment",
    label: "Adaptability & Resilience",
    level: "strong",
    note: "You owned a launch that missed, found out why from the data, and changed how you choose who to research.",
    evidence: [said(7, 3), said(7, 5)],
    posting: [],
    gap: null,
    probe: PROBES.adaptability,
  },
  {
    id: "analytical-approach",
    area: "problem-solving",
    label: "Analytical Approach",
    level: "some-evidence",
    note: "You checked the usage data before arguing for a design, though the story stops short of how you framed the question.",
    evidence: [said(3, 3), said(3, 4)],
    posting: [],
    gap: null,
    probe: PROBES["analytical-approach"],
  },
  {
    id: "decision-trade-offs",
    area: "problem-solving",
    label: "Decision-Making Trade-offs",
    level: "strong",
    note: "You named what each cut would have cost in weeks and tied every one back to the problem you were there to fix.",
    evidence: [said(4, 2), said(4, 4)],
    posting: [],
    gap: null,
    probe: PROBES["decision-trade-offs"],
  },
  {
    id: "active-listening",
    area: "collaboration",
    label: "Active Listening & Empathy",
    level: "some-evidence",
    note: "You turned a disagreement into a test the product manager could agree to, but said little about how you heard their side.",
    evidence: [said(5, 3)],
    posting: [],
    gap: null,
    probe: PROBES["active-listening"],
  },
  {
    id: "cross-functional-communication",
    area: "collaboration",
    label: "Cross-Functional Communication",
    level: "strong",
    note: "You explained the cuts to sales, support and customers in their terms, before anyone had to ask.",
    evidence: [said(4, 5), said(4, 6)],
    posting: [],
    gap: null,
    probe: PROBES["cross-functional-communication"],
  },
  {
    id: "learning-agility",
    area: "growth",
    label: "Learning Agility",
    level: "some-evidence",
    note: "The dashboard that missed changed a habit you still keep, which is the kind of learning a panel listens for.",
    evidence: [said(7, 7)],
    posting: [],
    gap: null,
    probe: PROBES["learning-agility"],
  },
  { id: "role-trajectory", area: "growth", label: "Role Trajectory", level: "not-enough-evidence", note: NO_POSTING, evidence: [], posting: [], gap: "no-posting", probe: PROBES["role-trajectory"] },
];

const POSITIONING: PositioningSection = {
  status: "ready",
  failure: null,
  criteria: CRITERIA,
  companyValues: "no-posting",
  statedValues: [],
  posting: { source: "none", jdHash: null, requirements: [], readAt: "2026-09-14T09:45:47.000Z" },
};

const finding = (id: string, kind: DictionFinding["kind"], quoted: AnswerQuote, note: string, suggestion: string): DictionFinding => ({ id, kind, ...quoted, note, suggestion });

const DICTION: DictionSection = {
  status: "ready",
  failure: null,
  enoughEvidence: true,
  findings: [
    finding(
      "dg-1",
      "fillers",
      said(5, 1, "because we were, like, already two weeks behind on the roadmap"),
      "“Like” lands in the middle of the reason, which is the part the panel is weighing.",
      "because we were already two weeks behind on the roadmap"
    ),
    finding("dg-2", "concision", said(3, 1), "A line spent finding the story tells the panel you had not picked one yet.", "The clearest one is from the same checkout project."),
    finding(
      "dg-3",
      "word-choice",
      said(2, 1, "Honestly, the handoff started on day one"),
      "“Honestly” suggests the rest was less so; the sentence is stronger without it.",
      "The handoff started on day one"
    ),
  ],
  fillers: { value: `${BUILT.totalFillers} across your answers`, good: BUILT.totalFillers <= 3 },
  wordsRead: BUILT_ANSWERS.reduce((sum, a) => sum + a.wordCount, 0),
};

const OVERALL_SCORE = Math.round((DIMENSIONS.reduce((s, d) => s + d.score, 0) / DIMENSIONS.length) * 10);

const REPORT: PrepReportPayload = {
  overallScore: OVERALL_SCORE,
  dimensions: DIMENSIONS,
  languageStats: LANGUAGE_STATS,
  rewrites: REWRITES,
  actionItems: ACTION_ITEMS,
  coachNote: SUMMARY.map((line) => line.text).join(" "),
  tooShort: false,
  scoreConfidence: "full",
  scoreReason: null,
  unscoredDimensions: [],
  scoreEvidence: {
    answers: BUILT_ANSWERS.length,
    substantiveAnswers: BUILT_ANSWERS.length,
    contentWords: BUILT.totalWords - BUILT.totalFillers,
    speechMs: BUILT_ANSWERS.reduce((sum, a) => sum + a.speechMs, 0),
    scoredDimensions: DIMENSIONS.length,
  },
  positioning: POSITIONING,
  diction: DICTION,
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const TRACK = { id: "track-vercel", company: "Vercel", role: "Senior Product Designer", roundLabel: "Round 3 · Design craft" } as const;

const QUESTIONS: PrepQuestion[] = SCRIPT.map((a) => ({ id: a.questionId, text: q(a.questionId) }));

const PREP: PrepSnapshot = {
  trackId: TRACK.id,
  trackSnapshot: { company: TRACK.company, role: TRACK.role, roundLabel: TRACK.roundLabel },
  formats: ["behavioural", "portfolio"],
  difficulty: "standard",
  lengthMinutes: 15,
  questions: QUESTIONS,
};

const CREATED_AT = "2026-09-14T09:30:00.000Z";
const at = (offsetS: number) => new Date(Date.parse(CREATED_AT) + offsetS * 1000).toISOString();
const step = (status: StepState["status"], offsetS: number | null = null, error: string | null = null): StepState => ({
  status,
  at: offsetS === null ? null : at(offsetS),
  error,
});
const steps = (entries: Record<AnalysisStep, StepState>) => entries;

export const FIXTURE_DELIVERY: DeliveryReport = {
  durationMs: BUILT.durationMs,
  liveProvider: "elevenlabs",
  summary: SUMMARY,
  metrics: METRICS,
  flags: FLAGS,
  series: BUILT.series,
  answers: DELIVERY_ANSWERS,
  transcript: {
    segments: BUILT_ANSWERS.flatMap((a) => a.segments),
    words: BUILT_ANSWERS.flatMap((a) => a.words),
  },
};

export const FIXTURE_TURNS: PrepTurn[] = BUILT.turns;
export const FIXTURE_SUMMARY_LINES: DeliverySummaryLine[] = SUMMARY;
export const FIXTURE_REPORT: PrepReportPayload = REPORT;

/** 5 credits for 10 minutes, +1 for each of the 4 minutes started after. */
const CREDITS = 9;

/** The share of the answer windows that timed words cover. */
const SPEECH_COVERAGE = round2(
  BUILT_ANSWERS.reduce((sum, a) => sum + a.words.reduce((s, w) => s + (w.e - w.s), 0), 0) / BUILT_ANSWERS.reduce((sum, a) => sum + (a.endMs - a.startMs), 0)
);

/** A finished 14-minute voice session: report, delivery and recording all present. */
export const VOICE_READY_SESSION: PrepSessionDetail = {
  id: "66e5586801a2b3c4d5e6f701",
  mode: "voice",
  status: "ready",
  trackId: TRACK.id,
  company: TRACK.company,
  role: TRACK.role,
  lengthMinutes: 15,
  createdAt: CREATED_AT,
  completedAt: at(840 + 95),
  overallScore: OVERALL_SCORE,
  durationMs: BUILT.durationMs,
  liveProvider: "elevenlabs",
  billing: { credits: CREDITS, state: "charged" },
  locked: false,
  tooShort: false,
  progress: 100,
  prep: PREP,
  turns: FIXTURE_TURNS,
  analysis: {
    progress: 100,
    steps: steps({
      assemble: step("done", 852),
      transcribe: step("done", 889),
      prosody: step("done", 902),
      flags: step("done", 903),
      report: step("done", 931),
      charge: step("done", 934),
      insights: step("done", 947),
    }),
    error: null,
    retriesLeft: 3,
    transcriptCoverage: 1,
    speechCoverage: SPEECH_COVERAGE,
  },
  report: REPORT,
  delivery: FIXTURE_DELIVERY,
  summaryLines: SUMMARY,
  rating: null,
  recording: { durationMs: BUILT.durationMs, playbackReady: true },
};

/** Before the batch transcript lands, the turns still hold the live captions. */
const LIVE_TURNS: PrepTurn[] = FIXTURE_TURNS.map((t) => (t.who === "user" && t.liveText ? { ...t, text: t.liveText } : t));

const IN_FLIGHT = {
  overallScore: null,
  completedAt: null,
  billing: { credits: CREDITS, state: "pending" },
  locked: false,
  rating: null,
  turns: LIVE_TURNS,
} as const satisfies Partial<PrepSessionDetail>;

/** Transcribing: the recording is assembled and playable, nothing is graded yet. */
export const VOICE_PROCESSING_SESSION: PrepSessionDetail = {
  ...VOICE_READY_SESSION,
  ...IN_FLIGHT,
  id: "66e5586801a2b3c4d5e6f702",
  status: "processing",
  progress: 32,
  turns: LIVE_TURNS,
  analysis: {
    progress: 32,
    steps: steps({
      assemble: step("done", 852),
      transcribe: step("running", 853),
      prosody: step("pending"),
      flags: step("pending"),
      report: step("pending"),
      charge: step("pending"),
      insights: step("pending"),
    }),
    error: null,
    retriesLeft: 3,
    transcriptCoverage: null,
    speechCoverage: null,
  },
  report: undefined,
  delivery: undefined,
  summaryLines: undefined,
};

/** Gave up while measuring delivery; the transcript made it, the report didn't. */
export const VOICE_FAILED_SESSION: PrepSessionDetail = {
  ...VOICE_READY_SESSION,
  ...IN_FLIGHT,
  id: "66e5586801a2b3c4d5e6f703",
  status: "failed",
  progress: 45,
  turns: FIXTURE_TURNS,
  analysis: {
    progress: 45,
    steps: steps({
      assemble: step("done", 852),
      transcribe: step("done", 889),
      prosody: step("failed", 1_030, "timeout"),
      flags: step("pending"),
      report: step("pending"),
      charge: step("pending"),
      insights: step("pending"),
    }),
    error: "We couldn't measure your delivery this time. Your recording and transcript are safe.",
    // One retry already used, so the failed card still offers two more.
    retriesLeft: 2,
    transcriptCoverage: 1,
    speechCoverage: SPEECH_COVERAGE,
  },
  report: undefined,
  delivery: undefined,
  summaryLines: undefined,
};

/**
 * How many retries the failed session has left. The contract's detail doesn't
 * carry this yet (only the retry call answers with it), so it lives beside
 * the fixture.
 */
export const VOICE_FAILED_RETRIES_LEFT = 2;

/** Charged with 402: graded sections withheld; the recording and batch transcript stay. */
export const VOICE_LOCKED_SESSION: PrepSessionDetail = {
  ...VOICE_READY_SESSION,
  id: "66e5586801a2b3c4d5e6f704",
  overallScore: null,
  billing: { credits: CREDITS, state: "insufficient" },
  locked: true,
  report: undefined,
  delivery: undefined,
  summaryLines: undefined,
};

/** The balance the locked session found. */
export const VOICE_LOCKED_BALANCE = 6;

const TYPED_ANSWERS = [
  "I led the checkout redesign at Tally for eight weeks. I cut the flow from six steps to two, and time to first payment went from four minutes to ninety seconds.",
  "I worked with engineering from the first research call, so the handoff was a shared decision log rather than a spec. We shipped a week early.",
  "Engineering said infinite scroll would take three extra weeks. I checked the data, saw under five percent of sessions went past page two, and we shipped pagination instead.",
  "We cut bulk editing. It mattered to eight percent of accounts and needed a new permissions model. We added it two months later.",
];

/** The same item without recording times: a typed session has nothing to point into. */
function untimed<T extends { atMs?: number; endMs?: number }>(item: T): T {
  const copy = { ...item };
  delete copy.atMs;
  delete copy.endMs;
  return copy;
}

/** A typed session: no recording, no delivery, graded from the text alone and free. */
export const TYPED_READY_SESSION: PrepSessionDetail = {
  id: "66e5586801a2b3c4d5e6f705",
  mode: "text",
  status: "ready",
  trackId: TRACK.id,
  company: TRACK.company,
  role: TRACK.role,
  lengthMinutes: 6,
  createdAt: "2026-09-12T18:05:00.000Z",
  completedAt: "2026-09-12T18:14:40.000Z",
  overallScore: 68,
  durationMs: null,
  liveProvider: null,
  billing: { credits: 0, state: "not-charged" },
  locked: false,
  tooShort: false,
  progress: 100,
  prep: { ...PREP, lengthMinutes: 6, formats: ["behavioural", "portfolio"], questions: QUESTIONS.slice(0, 4) },
  turns: QUESTIONS.slice(0, 4).flatMap((question, i): PrepTurn[] => [
    { id: `typed-q${i + 1}`, who: "ai", questionId: question.id, text: question.text, source: "typed" },
    { id: `typed-a${i + 1}`, who: "user", questionId: question.id, text: TYPED_ANSWERS[i], source: "typed" },
  ]),
  analysis: {
    progress: 100,
    steps: {
      assemble: { status: "skipped", at: null, error: null },
      transcribe: { status: "skipped", at: null, error: null },
      prosody: { status: "skipped", at: null, error: null },
      flags: { status: "done", at: "2026-09-12T18:14:02.000Z", error: null },
      report: { status: "done", at: "2026-09-12T18:14:38.000Z", error: null },
      charge: { status: "done", at: "2026-09-12T18:14:40.000Z", error: null },
      // Analysed before the Positioning and Diction step existed: the service reads that as `skipped` and sends no sections.
      insights: { status: "skipped", at: null, error: null },
    },
    error: null,
    retriesLeft: 3,
    transcriptCoverage: null,
    speechCoverage: null,
  },
  report: {
    ...REPORT,
    overallScore: 68,
    rewrites: REWRITES.map(untimed),
    actionItems: ACTION_ITEMS.map(untimed),
    dimensions: DIMENSIONS.map((d) => ({ ...d, evidence: d.evidence.map(untimed) })),
    languageStats: LANGUAGE_STATS.map((s) => ({ ...s, evidence: s.evidence.map(untimed) })),
    coachNote: "The content is there. What's costing you points is how sure you sound saying it.",
    // A report from before the evidence gates: the service derives `full` and has no amounts to give.
    scoreEvidence: null,
    // "Not analysed": absent, as the service sends a report from before the sections existed.
    positioning: undefined,
    diction: undefined,
  },
  rating: null,
  recording: null,
};

/** The ready session as the report screen holds it: prep-data's `PrepSession` with the Part 5 fields. */
export const VOICE_READY_PREP_SESSION: PrepSession = {
  id: VOICE_READY_SESSION.id,
  serverId: VOICE_READY_SESSION.id,
  trackId: TRACK.id,
  formats: PREP.formats,
  difficulty: PREP.difficulty,
  lengthMinutes: PREP.lengthMinutes,
  completedAt: VOICE_READY_SESSION.completedAt ?? CREATED_AT,
  transcript: FIXTURE_TURNS.map((t) => ({ id: t.id, who: t.who, text: t.text, questionId: t.questionId, startMs: t.startMs, endMs: t.endMs })),
  // The constant, not REPORT's field: a payload's score may be null, a PrepSession's is always a number.
  overallScore: OVERALL_SCORE,
  dimensions: REPORT.dimensions,
  languageStats: REPORT.languageStats,
  rewrites: REPORT.rewrites,
  actionItems: REPORT.actionItems,
  coachNote: REPORT.coachNote,
  tooShort: REPORT.tooShort,
  scoreConfidence: "full",
  scoreReason: null,
  scoreEvidence: REPORT.scoreEvidence,
  unscoredDimensions: [],
  positioning: POSITIONING,
  diction: DICTION,
  mode: "voice",
  status: "ready",
  delivery: FIXTURE_DELIVERY,
  summary: SUMMARY,
  billing: VOICE_READY_SESSION.billing,
  locked: false,
  rating: null,
  liveProvider: "elevenlabs",
};

/**
 * A playback link that resolves but never plays: `.invalid` never resolves in
 * DNS, so the player shows its failure and retry states.
 */
export function getFixturePlaybackLink(): Promise<PlaybackLink> {
  return Promise.resolve({ url: "https://recordings.example.invalid/fixture/playback.m4a", expiresAt: new Date(Date.now() + 6 * 3_600_000).toISOString() });
}

// ---------------------------------------------------------------------------
// Every component's props, held to the fixtures
// ---------------------------------------------------------------------------

const noop = () => {};
const resolved = () => Promise.resolve();

export const FIXTURE_PROPS = {
  playbackProvider: { durationMs: VOICE_READY_SESSION.recording?.durationMs } satisfies Omit<PlaybackProviderProps, "children">,
  recordingPlayer: { getUrl: getFixturePlaybackLink, title: `${TRACK.company} · ${TRACK.roundLabel}` } satisfies RecordingPlayerProps,
  timestampChip: { atMs: FLAGS[0].atMs, endMs: FLAGS[0].endMs } satisfies TimestampChipProps,
  timeline: { delivery: FIXTURE_DELIVERY, turns: FIXTURE_TURNS } satisfies DeliveryTimelineProps,
  timelineFromPrepSession: { delivery: FIXTURE_DELIVERY, turns: VOICE_READY_PREP_SESSION.transcript } satisfies DeliveryTimelineProps,
  transcript: { segments: FIXTURE_DELIVERY.transcript.segments, words: FIXTURE_DELIVERY.transcript.words, turns: FIXTURE_TURNS } satisfies SyncedTranscriptProps,
  // Locked: the delivery transcript is withheld, so the turns carry the text.
  transcriptLocked: { segments: [], words: [], turns: VOICE_LOCKED_SESSION.turns } satisfies SyncedTranscriptProps,
  findings: { flags: FIXTURE_DELIVERY.flags, metrics: FIXTURE_DELIVERY.metrics, turns: FIXTURE_TURNS } satisfies DeliveryFindingsProps,
  findingsNone: {
    flags: [],
    metrics: { ...FIXTURE_DELIVERY.metrics, pitchVariationSt: null, energyTrendDbPerAnswer: null },
  } satisfies DeliveryFindingsProps,
  // The report transcript failed for good (transcriptCoverage 0): nothing measured from words.
  findingsNoWordTimings: {
    flags: FIXTURE_DELIVERY.flags.filter((f) => f.kind !== "rushing" && f.kind !== "fillers"),
    metrics: { ...FIXTURE_DELIVERY.metrics, wpmMean: null, fillersPer100Words: null },
    turns: FIXTURE_TURNS,
    noWordTimings: true,
  } satisfies DeliveryFindingsProps,
  timelineNoWordTimings: {
    delivery: {
      ...FIXTURE_DELIVERY,
      metrics: { ...FIXTURE_DELIVERY.metrics, wpmMean: null, fillersPer100Words: null },
      flags: FIXTURE_DELIVERY.flags.filter((f) => f.kind !== "rushing" && f.kind !== "fillers"),
      series: { ...FIXTURE_DELIVERY.series, pace: [] },
      answers: FIXTURE_DELIVERY.answers.map((a) => ({ ...a, wpm: null })),
      transcript: { segments: [], words: [] },
    },
    turns: FIXTURE_TURNS,
  } satisfies DeliveryTimelineProps,
  summary: { lines: FIXTURE_SUMMARY_LINES } satisfies SummaryLinesProps,
  rating: { value: VOICE_READY_SESSION.rating?.score ?? null, onRate: resolved } satisfies AccuracyRatingProps,
  progressProcessing: {
    status: VOICE_PROCESSING_SESSION.status,
    steps: VOICE_PROCESSING_SESSION.analysis.steps,
    progress: VOICE_PROCESSING_SESSION.analysis.progress,
    error: VOICE_PROCESSING_SESSION.analysis.error,
    retriesLeft: 3,
    onRetry: noop,
  } satisfies AnalysisProgressProps,
  progressFailed: {
    status: VOICE_FAILED_SESSION.status,
    steps: VOICE_FAILED_SESSION.analysis.steps,
    progress: VOICE_FAILED_SESSION.analysis.progress,
    error: VOICE_FAILED_SESSION.analysis.error,
    retriesLeft: VOICE_FAILED_RETRIES_LEFT,
    onRetry: noop,
  } satisfies AnalysisProgressProps,
  progressTyped: {
    status: "processing",
    steps: { ...TYPED_READY_SESSION.analysis.steps, report: { status: "running", at: null, error: null }, charge: { status: "pending", at: null, error: null } },
    progress: 70,
    error: null,
    retriesLeft: 3,
    onRetry: noop,
  } satisfies AnalysisProgressProps,
  locked: {
    credits: VOICE_LOCKED_SESSION.billing.credits,
    balance: VOICE_LOCKED_BALANCE,
    onUnlock: noop,
  } satisfies LockedReportProps,
  deleteVoice: { onDelete: resolved, mode: VOICE_READY_SESSION.mode } satisfies DeleteSessionButtonProps,
  deleteTyped: { onDelete: noop, mode: TYPED_READY_SESSION.mode } satisfies DeleteSessionButtonProps,
  evidenceDialog: {
    open: true,
    onOpenChange: noop,
    title: DIMENSIONS[5].label,
    value: `${DIMENSIONS[5].score} / 10`,
    summary: DIMENSIONS[5].note,
    howToImprove: DIMENSIONS[5].howToImprove,
    evidence: DIMENSIONS[5].evidence,
  } satisfies EvidenceDialogProps,
} as const;

/** The analysis states a report page cycles through, in order. */
export const FIXTURE_ANALYSIS_STATES: Record<"processing" | "failed" | "ready", PrepAnalysisState> = {
  processing: VOICE_PROCESSING_SESSION.analysis,
  failed: VOICE_FAILED_SESSION.analysis,
  ready: VOICE_READY_SESSION.analysis,
};
