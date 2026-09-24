// Interview Prep — the screens' shapes, plus the practice question bank.
//
// Tracks are the user's own now, saved in the backend (app/lib/prep/types.ts)
// and mapped into `PrepTrack` below by app/lib/prep/tracks.ts; sessions are
// the AI service's saved interviews, graded there (app/lib/voice/mapSession.ts
// maps them into `PrepSession`). What stays here is what the screens render
// and the bank a live session draws its questions from. The seeded companies,
// the invented panel research and the in-browser scorer are gone: there was
// no source behind any of them.
//
// The times on a session are milliseconds into its recording.

import type {
  BillingState,
  DeliveryReport,
  DeliverySummaryLine,
  DictionSection,
  LiveSttProvider,
  PositioningSection,
  PrepSessionMode,
  PrepSessionStatus,
  ScoreConfidence,
  ScoreEvidence,
  ScoreReason,
  UnscoredDimension,
} from "@/app/lib/voice/types";
import type { PrepTrackItem } from "@/app/lib/prep/types";

export type SessionFormat = "behavioural" | "portfolio" | "salary";
export type Difficulty = "warm-up" | "standard" | "tough";
export type TrackStatus = "not-started" | "in-progress" | "awaiting-outcome" | "closed";
export type RoundOutcome = "offer" | "rejected" | "waiting" | null;

export const SESSION_LENGTHS = [6, 15, 25] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

export const QUESTIONS_FOR_LENGTH: Record<SessionLength, number> = { 6: 4, 15: 7, 25: 10 };

export const FORMAT_META: Record<SessionFormat, { label: string; sub: string }> = {
  behavioural: { label: "Behavioural", sub: "How you work, told through past projects" },
  portfolio: { label: "Portfolio walkthrough", sub: "One project taken apart in detail" },
  salary: { label: "Salary conversation", sub: "Anchoring and handling pushback" },
};

/**
 * One piece of concrete backing for a score or a stat — the user's own words,
 * what to notice about them, and where possible a rewrite of that specific
 * line. This is what turns "Specifics 6.1" from a verdict into something
 * actionable.
 */
export interface EvidenceItem {
  id: string;
  /** The user's own words, verbatim. */
  quote: string;
  /** What to notice about this specific line. */
  note: string;
  /** A concrete rewrite of just this line, where one is worth giving. */
  fix?: string;
  /** The question it answered, for context. */
  question?: string;
  /** Where the line starts in the recording, for a chip that plays it. */
  atMs?: number;
  endMs?: number;
}

export interface DimensionScore {
  id: string;
  label: string;
  /** 0-10 */
  score: number;
  note: string;
  /** What to show when this dimension is opened up. */
  evidence: EvidenceItem[];
  /** One line on how to move this specific score. */
  howToImprove: string;
}

export interface LanguageStat {
  id: string;
  label: string;
  value: string;
  good: boolean;
  evidence: EvidenceItem[];
  howToImprove: string;
}

export interface Rewrite {
  id: string;
  question: string;
  /** The user's own typed answer. */
  said: string;
  /** An authored exemplar for this question — not a literal edit of `said`. */
  better: string;
  why: string;
  /** Where `said` was spoken in the recording. */
  atMs?: number;
  endMs?: number;
}

export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  effortMinutes: number;
  done: boolean;
  source: string;
  /** The moment in the recording this action comes from. */
  atMs?: number;
  endMs?: number;
}

export interface TranscriptTurn {
  id: string;
  who: "ai" | "user";
  text: string;
  questionId?: string;
  /** For an answer, its window (the question ending to the send); for the interviewer, its own speech. */
  startMs?: number;
  endMs?: number;
}

export interface PrepSession {
  id: string;
  trackId: string;
  /** A session can drill more than one format in a single run. */
  formats: SessionFormat[];
  difficulty: Difficulty;
  lengthMinutes: SessionLength;
  /** ISO timestamp. */
  completedAt: string;
  transcript: TranscriptTurn[];
  /** 0-100; 0 when there is no score. Read it through mapSession's `scoreDisplayOf`, never on its own. */
  overallScore: number;
  /** The judged dimensions only; the rest are in `unscoredDimensions`. */
  dimensions: DimensionScore[];
  languageStats: LanguageStat[];
  rewrites: Rewrite[];
  actionItems: ActionItem[];
  coachNote: string;
  /** Too short to charge; any score is provisional. */
  tooShort: boolean;
  /** How far `overallScore` can be trusted. Absent: `full` unless `tooShort` (see `scoreDisplayOf`). */
  scoreConfidence?: ScoreConfidence;
  /** Why the score is provisional or missing. */
  scoreReason?: ScoreReason | null;
  /** What the verdict rests on: answers, words and seconds of voice. */
  scoreEvidence?: ScoreEvidence | null;
  /** Dimensions with too little evidence to judge: "not enough to judge", never a number. */
  unscoredDimensions?: UnscoredDimension[];
  /** The report's Positioning section. Absent: analysed before it existed. */
  positioning?: PositioningSection;
  /** The report's Diction and Grammar section. Absent: analysed before it existed. */
  diction?: DictionSection;
  /** The AI service's id for the session. Every session is a saved one now; the field stays optional for the report's own previews. */
  serverId?: string;
  mode?: PrepSessionMode;
  status?: PrepSessionStatus;
  /** Measured pace, pauses, fillers, pitch variation and energy. Voice sessions only. */
  delivery?: DeliveryReport;
  /** The report's summary, a line at a time, each tied to a moment in the recording. */
  summary?: DeliverySummaryLine[];
  /** `credits` is null until the recording's length is known. */
  billing?: { credits: number | null; state: BillingState };
  /** The charge was refused: the graded sections are withheld until an unlock succeeds. */
  locked?: boolean;
  /** The user's 1-5 rating of the transcript's accuracy; null when not rated. */
  rating?: number | null;
  /** Who wrote the live captions. */
  liveProvider?: LiveSttProvider;
}

/**
 * A track as the screens read it. Built from the saved track by
 * app/lib/prep/tracks.ts `toPrepTrack`: the round label, date, status and
 * outcome are derived from its rounds, the actions are its plan tasks, and the
 * sessions are the AI service's scored sessions for it.
 */
export interface PrepTrack {
  id: string;
  company: string;
  companyMark: string;
  /** The linked job's logo, when it has one. Optional because the stand-in a report builds from a session snapshot has no job behind it (app/lib/voice/mapSession.ts `trackFromSnapshot`). */
  companyLogo?: string | null;
  role: string;
  location: string;
  roundLabel: string;
  /** The current round's date (ISO), or null if nothing's scheduled yet. */
  roundDate: string | null;
  status: TrackStatus;
  sessions: PrepSession[];
  actions: ActionItem[];
  outcome: RoundOutcome;
  /**
   * The saved track behind this view: rounds, links, whether a posting is on
   * it. Absent only on the stand-in a report builds from a session's snapshot
   * when its track is gone (app/lib/voice/mapSession.ts `trackFromSnapshot`).
   */
  saved?: PrepTrackItem;
}

export interface QuestionBankEntry {
  id: string;
  text: string;
  sub: string;
  better: string;
  why: string;
}

// ---------------------------------------------------------------------------
// Question bank — what a live practice session asks. Six per format; a session
// needing more questions than a format has cycles back through the bank (see
// pickQuestionsForSession in prep-engine.ts) rather than requiring a huge
// upfront bank for the 25-minute tier. A track's "likely questions" are not
// drawn from here: they are written for it from its posting and the resume
// (app/lib/prep/api.ts `generateLikelyQuestions`).
// ---------------------------------------------------------------------------

export const QUESTION_BANK: Record<SessionFormat, QuestionBankEntry[]> = {
  behavioural: [
    {
      id: "beh-owned-outcome",
      text: "Walk me through a project where you owned the outcome end-to-end.",
      sub: "Standard opener — almost every panel leads with this",
      better:
        "I led the checkout redesign for eight weeks, end to end. I cut the flow from six steps to two, which took first-payment time from four minutes to ninety seconds, and support tickets on setup dropped 31% in the first month.",
      why: "A decision, a number, and an outcome — not just a description of the work.",
    },
    {
      id: "beh-disagree",
      text: "Tell me about a time you disagreed with a design decision.",
      sub: "Tests whether you can push back without stalling a team",
      better:
        "A PM wanted to ship without usability testing. I ran a three-day guerrilla test with six users on the existing flow, paired the findings with a lightweight redesign, and we shipped a week later with a 14% lift in completed checkouts.",
      why: "Names the disagreement plainly, then resolves it with evidence instead of just describing a feeling.",
    },
    {
      id: "beh-pushback-eng",
      text: "Tell me about a time you pushed back on an engineering constraint.",
      sub: "Wants to hear you reason out loud, not just present a finished call",
      better:
        "Engineering flagged the infinite-scroll list as expensive to paginate correctly. I looked at the actual usage data, saw nobody scrolled past page two anyway, and we shipped simple pagination a week early instead of the fancier version.",
      why: "Shows you changed your mind when the evidence said to — reads as senior, not stubborn.",
    },
    {
      id: "beh-conflict-teammate",
      text: "Describe a conflict with a teammate and how you resolved it.",
      sub: "Follow-up question in about a third of loops",
      better:
        "A senior engineer and I disagreed on how much of the settings redesign to ship at once. We agreed on a two-week trial of my version with a rollback plan if support volume rose — it didn't, and that became our default way of resolving scope disputes.",
      why: "Concrete resolution mechanism, not just \"we talked it out.\"",
    },
    {
      id: "beh-failure",
      text: "Tell me about a project that didn't go the way you planned.",
      sub: "Tests self-awareness more than the failure itself",
      better:
        "I shipped a dashboard redesign based on interviews with five power users, and adoption barely moved — turns out the bulk of usage was from a segment I hadn't talked to. I ran a proper usage-weighted study afterward and it's now how I scope every redesign.",
      why: "Owns the miss specifically and names what changed in the process afterward.",
    },
    {
      id: "beh-async",
      text: "How do you work across time zones with a distributed team?",
      sub: "Common for remote-first companies specifically",
      better:
        "I write decisions down before I make them, not after — a short doc with the options and my recommendation, open for 24 hours, then I move unless someone blocks it. It means nobody's blocked waiting for a call that has to fit six time zones.",
      why: "A concrete mechanism, not just \"I communicate well.\"",
    },
  ],
  portfolio: [
    {
      id: "port-walkthrough",
      text: "Walk me through one project from problem to shipped result.",
      sub: "The core portfolio question — expect 10-15 minutes on this alone",
      better:
        "The problem was a 60% drop-off at step three of a five-step form. I collapsed it to one screen, tested it with eight users first, and drop-off fell to 9% after we shipped — I can walk through the two versions side by side.",
      why: "States the before number, the change, and the after number — the shape a panel is listening for.",
    },
    {
      id: "port-cut",
      text: "What did you cut from that project, and why?",
      sub: "Tests judgment under constraint, not just execution",
      better:
        "We cut the bulk-edit feature from the first release. It tested well but only mattered to 8% of accounts, and shipping it would have pushed the release by three weeks — we shipped without it and added it two months later once the core flow had adoption data behind it.",
      why: "A real trade-off with a reason, not \"we ran out of time.\"",
    },
    {
      id: "port-metric",
      text: "How did you know the redesign actually worked?",
      sub: "Wants a real metric, not a vibe",
      better:
        "First-payment completion time went from four minutes to ninety seconds, and support tickets tagged 'checkout confusion' dropped by a third in the first month after launch.",
      why: "Two independent numbers, not one cherry-picked stat.",
    },
    {
      id: "port-handoff",
      text: "Walk me through how you handed this off to engineering.",
      sub: "Developer-tool companies ask this almost every time",
      better:
        "I paired with an engineer from the first prototype, not after the design was final, so feasibility shaped the design instead of trimming it later — the handoff doc was really just a shared history of decisions we'd already made together.",
      why: "Frames handoff as ongoing collaboration, which is what most eng-heavy teams are actually screening for.",
    },
    {
      id: "port-critique",
      text: "What would you change about this project if you did it again?",
      sub: "A self-critique question — vague answers stand out badly here",
      better:
        "I'd run the usability test before committing to the single-screen direction, not after — we got lucky that it tested well, and I'd rather not need the luck next time.",
      why: "Specific and slightly uncomfortable — that's what makes it credible.",
    },
    {
      id: "port-scale",
      text: "How would this design hold up at ten times the current scale?",
      sub: "Common at companies past Series B",
      better:
        "The single-screen checkout assumes a handful of fields; at ten times the SKU complexity we'd need progressive disclosure, which I already sketched as a v2 direction but didn't need to ship — happy to walk through it.",
      why: "Shows you'd already thought past the shipped version, not scrambling to invent an answer live.",
    },
  ],
  salary: [
    {
      id: "sal-expectations",
      text: "What are your salary expectations for this role?",
      sub: "Almost always the opening question in a comp conversation",
      better:
        "Based on the scope described, I'm looking at $140,000 to $165,000 base, with the specific number depending on equity and the level this lands at internally.",
      why: "Gives a real range anchored to the role, not a vague deflection.",
    },
    {
      id: "sal-current",
      text: "What's your current compensation?",
      sub: "You're not obligated to answer this directly in most locations",
      better:
        "I'd rather anchor on the value of this specific role than my current package, which reflects a different scope — what's the range budgeted for this position?",
      why: "Redirects to the role's value without being evasive or confrontational.",
    },
    {
      id: "sal-lowball",
      text: "The range we have budgeted is lower than what you mentioned. Is there flexibility on your end?",
      sub: "Tests whether you fold at the first sign of resistance",
      better:
        "I'm flexible on structure — base versus equity versus a signing bonus — but the total comp needs to reflect the seniority of what's being asked. Can you tell me more about how the range was set?",
      why: "Holds the number while staying collaborative, and asks a real question back instead of just conceding.",
    },
    {
      id: "sal-equity",
      text: "How do you think about equity versus base salary?",
      sub: "Common at earlier-stage companies",
      better:
        "I weight base more heavily at this stage of my career since equity outcomes are hard to predict, but I'd want to understand the vesting schedule and the last valuation before treating equity as a meaningful part of the offer.",
      why: "A real framework, not just a number.",
    },
    {
      id: "sal-timeline",
      text: "What's your timeline, and are you interviewing elsewhere?",
      sub: "Partly a comp-leverage question in disguise",
      better:
        "I'm a few weeks into a focused search and have two other conversations at a similar stage, so I'd like to keep this moving at a similar pace if the fit feels right on both sides.",
      why: "Honest without handing over unnecessary leverage.",
    },
    {
      id: "sal-close",
      text: "If we made you an offer at the number we discussed today, would you accept on the spot?",
      sub: "A pressure-close — expect this more in \"tough\" mode",
      better:
        "I'd want it in writing to review properly, but if the number and the role match what we've talked through today, I don't expect a long back-and-forth.",
      why: "Signals real interest without committing to something you haven't seen written down.",
    },
  ],
};

/** "Behavioural + Salary conversation" — one label for a session's format mix. */
export function formatsLabel(formats: SessionFormat[]): string {
  if (formats.length === 0) return "Mixed";
  return formats.map((f) => FORMAT_META[f].label).join(" + ");
}
