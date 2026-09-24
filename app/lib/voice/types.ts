// Voice interviews — the frontend's copy of the contract.
//
// The AI service owns it: remoteworldwideai/src/types/voice.ts. This is a copy
// by hand (no import crosses repos), and that repo's
// tests/contracts/voice-types.test.ts compares the two field for field.
//
// The report shapes the contract builds on (EvidenceItem, DimensionScore,
// LanguageStat, Rewrite, ActionItem, TranscriptTurn) are mirrored once, in
// app/lib/dashboard/prep-data.ts, and only re-exported here, so the in-memory
// demo sessions and the server's reports can never drift into two copies.
//
// Two rules hold for every shape here:
//  - No storage key, bucket, path, job name or provider id ever appears in a
//    response. A recording is reached only through `PlaybackLink`.
//  - Nothing here judges who is speaking or how they feel. Delivery coaching
//    is measured pace, pauses, fillers, pitch variation and energy, and
//    nothing else.
//
// Times are milliseconds on the session clock (0 = the recorder's `start`
// event) unless a name says otherwise. Dates travel as ISO strings.

import type { ActionItem, DimensionScore, EvidenceItem, LanguageStat, Rewrite, TranscriptTurn } from "@/app/lib/dashboard/prep-data";

export type { ActionItem, DimensionScore, EvidenceItem, LanguageStat, Rewrite, TranscriptTurn };

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * Who writes the live captions during an interview. The AI service's
 * environment chooses `elevenlabs` or `web-speech`, and a session falls back
 * from `elevenlabs` to `web-speech` when no engine is configured.
 * `aws-transcribe` remains for the STT lab and for sessions recorded before the
 * AWS stream was retired. The recording and the report are unaffected either way.
 */
export const LIVE_STT_PROVIDERS = ["elevenlabs", "aws-transcribe", "web-speech"] as const;
export type LiveSttProvider = (typeof LIVE_STT_PROVIDERS)[number];

/** Every engine a report transcript can come from; old rows keep the one that wrote them. */
export const REPORT_STT_PROVIDERS = ["aws-transcribe-batch", "elevenlabs-scribe"] as const;
export type ReportSttProvider = (typeof REPORT_STT_PROVIDERS)[number];
/** The engine new report transcripts come from. */
export const REPORT_STT_PROVIDER: ReportSttProvider = "elevenlabs-scribe";

/** Why a speech-to-text call failed, provider-neutral. */
export const STT_ERROR_KINDS = ["limited", "bad-audio", "unavailable", "auth", "timeout"] as const;
export type SttErrorKind = (typeof STT_ERROR_KINDS)[number];

// ---------------------------------------------------------------------------
// Session vocabulary
// ---------------------------------------------------------------------------

/** `voice` records and is analysed; `text` is typed (or dictated in the browser) and skips the audio steps. */
export const PREP_SESSION_MODES = ["voice", "text"] as const;
export type PrepSessionMode = (typeof PREP_SESSION_MODES)[number];

/**
 * - `open`: created; the user is in the interview.
 * - `uploading`: finished, but recording parts are still missing.
 * - `queued` / `processing`: the analysis job is waiting / running.
 * - `delayed`: the analysis is parked on a spent platform budget and retried later.
 * - `ready`: the report exists (it may still be `locked`).
 * - `failed`: the analysis gave up; the user may retry up to `PREP_LIMITS.retriesMax` times.
 * - `deleting`: the user deleted it; storage is being purged.
 */
export const PREP_SESSION_STATUSES = ["open", "uploading", "queued", "processing", "delayed", "ready", "failed", "deleting"] as const;
export type PrepSessionStatus = (typeof PREP_SESSION_STATUSES)[number];

/**
 * - `completed`: every question was asked and answered.
 * - `ended-early`: the user ended it.
 * - `time-limit` / `credit-limit`: recording stopped at the cap, for that reason.
 * - `pagehide`: the tab closed and the browser's beacon finished it.
 * - `abandoned`: nothing was heard for a while; the server finished it.
 */
export const END_REASONS = ["completed", "ended-early", "time-limit", "credit-limit", "pagehide", "abandoned"] as const;
export type EndReason = (typeof END_REASONS)[number];

/** Which term set the recording cap: the chosen length (+10 min), the balance, or the platform maximum. */
export const CAP_REASONS = ["length", "credits", "max"] as const;
export type CapReason = (typeof CAP_REASONS)[number];

/**
 * The analysis pipeline, in order. Text sessions mark `assemble`, `transcribe` and `prosody` as `skipped`.
 *
 * `insights` writes the report's Positioning and Diction sections AFTER the
 * session is `ready`, so a report can be open while it runs. Read the
 * sections' own `status` (on `PrepReportPayload`), not this step.
 */
export const ANALYSIS_STEPS = ["assemble", "transcribe", "prosody", "flags", "report", "charge", "insights"] as const;
export type AnalysisStep = (typeof ANALYSIS_STEPS)[number];

export const STEP_STATUSES = ["pending", "running", "done", "skipped", "failed"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/**
 * - `pending`: not charged yet.
 * - `charged`: the spend is confirmed.
 * - `unbilled`: billing was unreachable; it is posted later under the same reference.
 * - `insufficient`: refused (402); the report is `locked` until an unlock succeeds.
 * - `not-charged`: nothing is owed — too short, no audio, a free typed session, or deleted first.
 */
export const BILLING_STATES = ["pending", "charged", "unbilled", "insufficient", "not-charged"] as const;
export type BillingState = (typeof BILLING_STATES)[number];

/** How an answer was given. `mixed` is a spoken answer the user edited before sending. */
export const TURN_SOURCES = ["voice", "typed", "mixed"] as const;
export type TurnSource = (typeof TURN_SOURCES)[number];

export const TURN_SPEAKERS = ["ai", "user"] as const;
export type TurnSpeaker = (typeof TURN_SPEAKERS)[number];

/** Measured delivery findings, each against this session's own baselines, never absolute values. */
export const DELIVERY_FLAG_KINDS = ["rushing", "monotone", "fading-energy", "hesitation", "fillers", "flat-value-prop"] as const;
export type DeliveryFlagKind = (typeof DELIVERY_FLAG_KINDS)[number];

/** Mirrors `SessionFormat` in prep-data.ts. */
export const PREP_FORMATS = ["behavioural", "portfolio", "salary"] as const;
export type PrepFormat = (typeof PREP_FORMATS)[number];

/** Mirrors `Difficulty` in prep-data.ts. */
export const PREP_DIFFICULTIES = ["warm-up", "standard", "tough"] as const;
export type PrepDifficulty = (typeof PREP_DIFFICULTIES)[number];

/** Mirrors `SESSION_LENGTHS` in prep-data.ts: the lengths a user can choose, in minutes. */
export const PREP_SESSION_LENGTHS = [6, 15, 25] as const;
export type PrepSessionLength = (typeof PREP_SESSION_LENGTHS)[number];

/** Why a create was refused with 429. */
export const PREP_LIMIT_REASONS = ["voice-minutes", "text-sessions"] as const;
export type PrepLimitReason = (typeof PREP_LIMIT_REASONS)[number];

/**
 * Which recording a part belongs to:
 *  - `voice`: the candidate's own echo-cancelled mic. The record: the report
 *    transcript and the delivery analysis are built from it alone.
 *  - `mix`: playback only. The candidate and the interviewer together, as the
 *    browser played them, so the report's recording has both voices. Nothing
 *    is measured from it, and a session without a usable one plays `voice`.
 */
export const RECORDING_TRACKS = ["voice", "mix"] as const;
export type RecordingTrack = (typeof RECORDING_TRACKS)[number];

export const PREP_LIMITS = {
  /** Turns stored per session, both speakers. */
  turnsMax: 60,
  /** Characters in one turn's text. */
  turnTextMax: 4_000,
  /** Questions in one session's snapshot. */
  questionsMax: 30,
  /** Presigned part URLs handed out per request. */
  partUrlBatchMax: 20,
  /** User-triggered analysis retries after a final failure. */
  retriesMax: 3,
  ratingMin: 1,
  ratingMax: 5,
  /** Muted stretches one finish may carry. */
  mutedSpansMax: 200,
  /** How far a playback mix's first sample may sit from the session clock's zero, either way. */
  mixOffsetMaxMs: 10_000,
} as const;

/**
 * When a report has a score, and how far it can be trusted. The first three
 * are the charge rule (under any of them a session is `tooShort` and not
 * charged); the rest are the evidence gates a dimension must pass to be scored.
 */
export const SCORE_RULES = {
  minAnswers: 2,
  minSpeechMs: 30_000,
  minTypedWords: 30,
  minAnswerWords: 5,
  minContentWords: 30,
  minFirstPersonMentions: 3,
  minJudgedSpeechMs: 15_000,
  minScoredDimensions: 4,
  minContentDimensions: 2,
} as const;

/**
 * - `full`: long enough to charge, and enough dimensions had evidence.
 * - `provisional`: too short to charge, but scored from the dimensions that had
 *   evidence. Show it labelled; it never counts towards preparedness.
 * - `none`: too few dimensions had evidence; there is no overall score.
 */
export const SCORE_CONFIDENCES = ["full", "provisional", "none"] as const;
export type ScoreConfidence = (typeof SCORE_CONFIDENCES)[number];

/** Why a score is provisional (the charge rule it fell under) or missing (`little-evidence`). */
export const SCORE_REASONS = ["few-answers", "little-speech", "few-words", "little-evidence"] as const;
export type ScoreReason = (typeof SCORE_REASONS)[number];

/** The evidence gate an unscored dimension missed. */
export const DIMENSION_GATES = ["few-words", "few-mentions", "no-questions", "little-speech", "no-timings", "short-session"] as const;
export type DimensionGate = (typeof DIMENSION_GATES)[number];

// ---------------------------------------------------------------------------
// Configuration the client reads
// ---------------------------------------------------------------------------

/** `GET /api/ai/prep/voice-config` — what the setup screen needs to offer and price a session. */
export interface PrepVoiceConfig {
  interviewsEnabled: boolean;
  liveProvider: LiveSttProvider;
  /** The consent version the create call must echo back. */
  consentVersion: string;
  maxMinutes: number;
  /** `credits(ms) = base + ceil(max(0, ms - includedMinutes·60 000) / 60 000) · perExtraMinute`. */
  credits: { base: number; includedMinutes: number; perExtraMinute: number };
  /** Typed sessions: credits each, and how many a user may start per UTC day. */
  textSession: { credits: number; perDay: number };
}

// ---------------------------------------------------------------------------
// Creating a session
// ---------------------------------------------------------------------------

export interface PrepQuestion {
  id: string;
  text: string;
}

/** What the browser set up, frozen at create, so a report stays readable for a mock or since-deleted track. */
export interface PrepSnapshot {
  trackId: string;
  trackSnapshot: { company: string; role: string; roundLabel: string };
  formats: PrepFormat[];
  difficulty: PrepDifficulty;
  lengthMinutes: PrepSessionLength;
  /** At most `PREP_LIMITS.questionsMax`. */
  questions: PrepQuestion[];
}

/** Required for `mode: "voice"`; a missing or stale version is a 400. */
export interface PrepConsent {
  version: string;
  accepted: true;
}

/** `POST /api/ai/prep/sessions` — 201. */
export interface CreatePrepSessionInput {
  mode: PrepSessionMode;
  prep: PrepSnapshot;
  consent?: PrepConsent;
}

/**
 * One presigned PUT for recording part `seq`: the part is the whole request
 * body, sent with exactly the headers in `headers` — the Content-Type is part
 * of the signature, so a different one is refused. `expiresAt` is when to ask
 * for a fresh one.
 *
 * A PUT rather than a POST policy because storage is Cloudflare R2, which
 * presigns GET, HEAD, PUT and DELETE and does not implement POST object.
 */
export interface PartUrl {
  seq: number;
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

/**
 * `POST /api/ai/prep/sessions` — 201.
 *
 * A typed session records nothing: `capMs`, `capReason` and `liveProvider`
 * are null, `partUrls` is empty and `maxParts` / `partMaxBytes` are 0. A voice
 * session's `liveProvider` says who captions it: `elevenlabs`, or `web-speech`.
 */
export interface CreatePrepSessionResult {
  session: PrepSessionSummary;
  /** Recording stops here; the client warns 60 s before. */
  capMs: number | null;
  capReason: CapReason | null;
  liveProvider: LiveSttProvider | null;
  /** Parts `0..n`, at most `PREP_LIMITS.partUrlBatchMax`. */
  partUrls: PartUrl[];
  /** Parts past this `seq` are refused. */
  maxParts: number;
  partMaxBytes: number;
  /** The advisory balance read at create; null when it could not be read. */
  balance: number | null;
}

/** Data on a 402 from create: a known balance below the base price. */
export interface PrepInsufficientCredits {
  balance: number;
  required: number;
}

/** Data on a 409 from create: the user's voice session that is still open or uploading. */
export interface PrepOpenSessionConflict {
  sessionId: string;
}

/** Data on a 429 from create. */
export interface PrepLimited {
  reason: PrepLimitReason;
  /** Until the UTC day rolls over; null when unknown. */
  retryAfterMs: number | null;
}

/**
 * `POST /api/ai/prep/sessions/:id/parts/urls` — more part URLs from `from`.
 * Doubles as the session heartbeat, so call it at least every few minutes even
 * with URLs in hand.
 */
export interface PartUrlsInput {
  from: number;
  /** Which recording's parts; absent is `voice`. Each track numbers its parts from 0 under the same cap. */
  track?: RecordingTrack;
}

export interface PartUrlsResult {
  partUrls: PartUrl[];
  maxParts: number;
}

// ---------------------------------------------------------------------------
// Finishing a session
// ---------------------------------------------------------------------------

/**
 * One turn as the browser recorded it. For a voice answer `text` is what the
 * user sent (captions, possibly edited); the analysis replaces it with the
 * report transcript unless the turn was `typed`. `startMs`/`endMs` are the
 * answer window (AI speech end to submit) or the AI's own speech.
 */
export interface PrepTurnInput {
  id: string;
  who: TurnSpeaker;
  questionId?: string;
  /** At most `PREP_LIMITS.turnTextMax` characters. */
  text: string;
  /** The live captions as shown, kept for the live-versus-batch agreement measure. */
  liveText?: string;
  source: TurnSource;
  startMs?: number;
  endMs?: number;
  /** The user spoke over the interviewer, which cut its speech short. */
  bargedIn?: boolean;
}

/** A stored turn is the turn as sent, with `text` filled from the report transcript once analysed. */
export type PrepTurn = PrepTurnInput;

/** What the browser believes it uploaded. The server checks each part against it. */
export interface PartManifestEntry {
  seq: number;
  bytes: number;
  /** Lowercase hex. */
  sha256: string;
}

/**
 * A stretch the candidate had muted themselves, whole ms on the session clock.
 * The recording holds silence there; the delivery analysis leaves it out, so
 * it never reads as a long pause or a slow start.
 */
export interface MutedSpan {
  startMs: number;
  endMs: number;
}

/**
 * The playback-only mix recorded beside the candidate's own track (`mix`
 * parts). Only ever played: the analysis reads the candidate's track alone,
 * and a mix the service cannot line up falls back to that track.
 */
export interface PlaybackMixInput {
  /** At least one; the mix's parts from 0 without a gap. */
  parts: PartManifestEntry[];
  /** Where the mix's first sample sits on the session clock (negative: before the zero). Within `PREP_LIMITS.mixOffsetMaxMs`. */
  offsetMs: number;
}

/**
 * `POST /api/ai/prep/sessions/:id/finish` — also sent by `sendBeacon` when the
 * tab closes, so it is idempotent: a second finish answers with the current state.
 */
export interface FinishPrepSessionInput {
  /** At most `PREP_LIMITS.turnsMax`. */
  turns: PrepTurnInput[];
  /** Voice sessions only. */
  parts?: PartManifestEntry[];
  endReason: EndReason;
  /** The browser's own wall clock, ISO. Informational; durations come from the audio. */
  clock: { startedAt: string; endedAt: string };
  /** The recording track reported `autoGainControl: false`, so its loudness is the speaker's own. */
  agcOff?: boolean;
  /** Voice sessions only. Sorted, non-overlapping, ending by the cap plus a minute as turn times do; at most `PREP_LIMITS.mutedSpansMax`. */
  mutedSpans?: MutedSpan[];
  /** Voice sessions only; absent when no usable mix was recorded. */
  mix?: PlaybackMixInput;
}

export interface FinishPrepSessionResult {
  status: PrepSessionStatus;
  /** Part numbers in the manifest that have not reached storage yet; upload them and finish again. */
  missingParts: number[];
}

// ---------------------------------------------------------------------------
// Reading sessions
// ---------------------------------------------------------------------------

export interface StepState {
  status: StepStatus;
  at: string | null;
  error: string | null;
}

export interface PrepBilling {
  /** What was, or will be, charged; null until the duration is known. */
  credits: number | null;
  state: BillingState;
}

/** One row of the session list, and the head of a session's detail. */
export interface PrepSessionSummary {
  id: string;
  mode: PrepSessionMode;
  status: PrepSessionStatus;
  trackId: string;
  company: string;
  role: string;
  lengthMinutes: PrepSessionLength;
  createdAt: string;
  completedAt: string | null;
  /** 0-100, once the report exists. Null while locked, and when there is no score (`scoreConfidence: "none"`). */
  overallScore: number | null;
  /** The billed recording length, `min(probed, cap)`; null for typed sessions and before assembly. */
  durationMs: number | null;
  /** The provider that ended up writing the captions; null for typed sessions. */
  liveProvider: LiveSttProvider | null;
  billing: PrepBilling;
  /** A 402 at charge time: the report and delivery sections are withheld until an unlock succeeds. */
  locked: boolean;
  /** Too short to charge (`SCORE_RULES`); any score is provisional and must not count towards preparedness. */
  tooShort: boolean;
  /** 0-100. */
  progress: number;
  /** How far `overallScore` can be trusted; set once `ready`. Absent from an older service: read `mapSession.scoreDisplayOf`. */
  scoreConfidence?: ScoreConfidence;
}

/** `GET /api/ai/prep/sessions?trackId=` — newest first. */
export interface PrepSessionList {
  sessions: PrepSessionSummary[];
}

export interface PrepRating {
  score: number;
  ratedAt: string;
}

export interface PrepRecordingState {
  durationMs: number | null;
  /** The playback copy exists, so `GET …/playback` will answer. */
  playbackReady: boolean;
}

export interface PrepAnalysisState {
  progress: number;
  steps: Record<AnalysisStep, StepState>;
  /** A short, user-facing reason after a failure. */
  error: string | null;
  /** `PREP_LIMITS.retriesMax` minus the retries already used; the report page's Retry shows only while above 0. */
  retriesLeft: number;
  /** How much of the recording the report transcript covers, 0-1; 0 means it has no word timings at all, so the delivery section says so instead of measuring. Null until transcribed. */
  transcriptCoverage?: number | null;
  /** The share of the answer windows' time that timed words cover, 0-1; null until transcribed. */
  speechCoverage?: number | null;
}

/**
 * `GET /api/ai/prep/sessions/:id` — polled while `queued` or `processing`.
 *
 * `report`, `delivery` and `summaryLines` are absent until the report exists,
 * and withheld while `locked`; the recording and transcript stay visible.
 */
export interface PrepSessionDetail extends PrepSessionSummary {
  prep: PrepSnapshot;
  turns: PrepTurn[];
  analysis: PrepAnalysisState;
  report?: PrepReportPayload;
  delivery?: DeliveryReport;
  /** The report's summary, each line tied to a moment in the recording. */
  summaryLines?: DeliverySummaryLine[];
  rating: PrepRating | null;
  /** Null for a typed session. */
  recording: PrepRecordingState | null;
}

/** `GET /api/ai/prep/sessions/:id/playback` — `Cache-Control: no-store`. A 403 from S3 (an expired presigned URL) means fetch a new one. */
export interface PlaybackLink {
  url: string;
  expiresAt: string;
}

/** `POST /api/ai/prep/sessions/:id/rating` — how accurate the transcript felt, 1-5; a second rating replaces the first. Answers with `PrepRating`. */
export interface PrepRatingInput {
  score: number;
}

/** `POST /api/ai/prep/sessions/:id/unlock` — retries the charge under the same reference. Answers with the detail. */
export type UnlockPrepSessionResult = PrepSessionDetail;

/** `POST /api/ai/prep/sessions/:id/retry` — after a final failure; a new analysis run. */
export interface RetryPrepSessionResult {
  status: PrepSessionStatus;
  retriesLeft: number;
}

/** `DELETE /api/ai/prep/sessions/:id` — the recording, transcript and report are purged. */
export interface DeletePrepSessionResult {
  deleted: true;
}

// ---------------------------------------------------------------------------
// The report — the graded half; the shapes inside it live in prep-data.ts
// ---------------------------------------------------------------------------

/**
 * The graded half of a prep-data.ts `PrepSession`; the client joins it with the summary and turns.
 *
 * `tooShort` is the charge rule and only that; how the score reads is
 * `scoreConfidence` (see `mapSession.scoreDisplayOf`).
 */
export interface PrepReportPayload {
  /** 0-100; null when too few dimensions could be judged (`scoreConfidence: "none"`). */
  overallScore: number | null;
  /** The dimensions this session gave enough evidence to judge, in rubric order. */
  dimensions: DimensionScore[];
  languageStats: LanguageStat[];
  rewrites: Rewrite[];
  actionItems: ActionItem[];
  /** The summary lines, joined. */
  coachNote: string;
  /** Too short to charge (`SCORE_RULES`). */
  tooShort: boolean;
  /** Absent only from a service older than the evidence gates. */
  scoreConfidence?: ScoreConfidence;
  /** Why the score is provisional or missing; null for a full score. */
  scoreReason?: ScoreReason | null;
  /** The dimensions not scored, each with the gate it missed: show "not enough to judge", never a number. */
  unscoredDimensions?: UnscoredDimension[];
  /** What the verdict rests on, for "Provisional — based on only 12 s of your voice". Null on a report from before the gates. */
  scoreEvidence?: ScoreEvidence | null;
  /** Absent: analysed before this section existed ("not analysed"), which is not `ready` with nothing found. */
  positioning?: PositioningSection;
  /** Absent: analysed before this section existed. */
  diction?: DictionSection;
}

/** A rubric dimension listed instead of scored: its gate, and a line to show. */
export interface UnscoredDimension {
  id: string;
  label: string;
  gate: DimensionGate;
  note: string;
  howToImprove: string;
}

/** The amounts behind a report's verdict. */
export interface ScoreEvidence {
  /** Answers with text, as the charge rule counts them. */
  answers: number;
  /** Answers with at least `SCORE_RULES.minAnswerWords` content words. */
  substantiveAnswers: number;
  /** Content words across the real answers. */
  contentWords: number;
  /** The candidate's measured voice; null for a typed session. */
  speechMs: number | null;
  scoredDimensions: number;
}

// ---------------------------------------------------------------------------
// Positioning and Diction — the report's two analysed sections
// ---------------------------------------------------------------------------
//
// Every finding quotes the candidate's own words from one answer, checked
// against the transcript; every claim about the company or role cites a
// numbered posting requirement or a line of the posting. "Not enough evidence"
// is the honest, expected answer for most criteria after a short interview.
// Nothing here is a score: a level and its evidence is all a section claims.

/**
 * - `ready`: analysed (any criterion may still be `not-enough-evidence`).
 * - `pending`: the report is out and this section is still being written; poll the detail.
 * - `unavailable`: it could not be analysed (`failure` says why); the rest of the report stands.
 */
export const REPORT_SECTION_STATUSES = ["ready", "pending", "unavailable"] as const;
export type ReportSectionStatus = (typeof REPORT_SECTION_STATUSES)[number];

/**
 * - `model-unavailable`: the text model was down, busy or gave nothing usable.
 * - `interrupted`: the analysis stopped before it finished.
 * - `switched-off`: the analysis was switched off when this session was analysed.
 */
export const REPORT_SECTION_FAILURES = ["model-unavailable", "interrupted", "switched-off"] as const;
export type ReportSectionFailure = (typeof REPORT_SECTION_FAILURES)[number];

export const POSITIONING_AREAS = ["alignment", "problem-solving", "collaboration", "growth"] as const;
export type PositioningArea = (typeof POSITIONING_AREAS)[number];

export const POSITIONING_AREA_LABELS = {
  alignment: "Behavioral & Cultural Alignment",
  "problem-solving": "Problem-Solving & Critical Thinking",
  collaboration: "Collaboration & Interpersonal Dynamics",
  growth: "Drive, Ambition & Growth Potential",
} as const;

/** In area order, two per area. */
export const POSITIONING_CRITERIA = [
  "values-match",
  "adaptability",
  "analytical-approach",
  "decision-trade-offs",
  "active-listening",
  "cross-functional-communication",
  "learning-agility",
  "role-trajectory",
] as const;
export type PositioningCriterionId = (typeof POSITIONING_CRITERIA)[number];

/** A qualitative level, never a number. `concern`: the answers show the opposite of what the criterion looks for. */
export const POSITIONING_LEVELS = ["strong", "some-evidence", "concern", "not-enough-evidence"] as const;
export type PositioningLevel = (typeof POSITIONING_LEVELS)[number];

/**
 * Why a criterion is `not-enough-evidence`:
 * - `not-discussed`: nothing the candidate said shows it either way.
 * - `values-not-stated`: the posting states no values to match against.
 * - `no-posting`: it needs the posting, and none could be read.
 */
export const EVIDENCE_GAPS = ["not-discussed", "values-not-stated", "no-posting"] as const;
export type EvidenceGap = (typeof EVIDENCE_GAPS)[number];

/** Whether the posting states the company's values. Nothing else is a source for them. */
export const COMPANY_VALUES_STATES = ["stated", "not-stated", "no-posting"] as const;
export type CompanyValuesState = (typeof COMPANY_VALUES_STATES)[number];

/** The posting text an analysis read: the track's saved job, else text pasted onto the track, else none; `unavailable` when it could not be read. */
export const POSTING_SOURCES = ["saved-job", "track-text", "none", "unavailable"] as const;
export type PostingSourceKind = (typeof POSTING_SOURCES)[number];

export const DICTION_KINDS = ["grammar", "word-choice", "hedging", "repetition", "fillers", "concision"] as const;
export type DictionKind = (typeof DICTION_KINDS)[number];

/** The candidate's own words from one answer, verbatim. */
export interface AnswerQuote {
  quote: string;
  /** The answer's turn id. */
  turnId: string;
  /** The question it answered. */
  question?: string;
  atMs?: number;
  endMs?: number;
}

/** What a claim about the job rests on: a numbered requirement (its text as extracted), or a line of the posting, verbatim. */
export interface PostingCitation {
  /** 1-based, in `PostingUsed.requirements` order; null for a quoted line. */
  requirement: number | null;
  text: string;
}

/** The kind of question that would give a criterion evidence; fixed per criterion. */
export interface EvidenceProbe {
  format: PrepFormat;
  /** "A setback story". */
  kind: string;
  /** One way an interviewer asks it. */
  example: string;
}

export interface PositioningCriterion {
  id: PositioningCriterionId;
  area: PositioningArea;
  label: string;
  level: PositioningLevel;
  /** What the evidence shows, or why there is none. */
  note: string;
  /** Empty exactly when `level` is `not-enough-evidence`. */
  evidence: AnswerQuote[];
  /** What a claim about the company or role rests on. */
  posting: PostingCitation[];
  /** Set exactly when `level` is `not-enough-evidence`. */
  gap: EvidenceGap | null;
  probe: EvidenceProbe;
}

/** Which posting text grounded an analysis; postings change after a session. */
export interface PostingUsed {
  source: PostingSourceKind;
  /** sha256 of the canonical posting text; null without one. */
  jdHash: string | null;
  /** The numbered requirements, in the order `PostingCitation.requirement` counts. */
  requirements: string[];
  readAt: string;
}

export interface PositioningSection {
  status: ReportSectionStatus;
  /** Set when `unavailable`. */
  failure: ReportSectionFailure | null;
  /** Every criterion, in `POSITIONING_CRITERIA` order, when `ready`; empty otherwise. */
  criteria: PositioningCriterion[];
  /** Null unless `ready`, and when too little was said for the posting to be read. */
  companyValues: CompanyValuesState | null;
  /** The values or principles the posting states, verbatim. */
  statedValues: string[];
  /** Null unless `ready` and a posting was looked for. */
  posting: PostingUsed | null;
}

export interface DictionFinding {
  id: string;
  kind: DictionKind;
  quote: string;
  turnId: string;
  question?: string;
  /** Why it reads poorly to an interviewer. */
  note: string;
  /** The same point, said better. */
  suggestion: string;
  atMs?: number;
  endMs?: number;
}

export interface DictionSection {
  status: ReportSectionStatus;
  failure: ReportSectionFailure | null;
  /** False: too little was said to judge how it was said, so no findings is not a clean bill. */
  enoughEvidence: boolean;
  findings: DictionFinding[];
  /** The report's own Filler words stat, repeated rather than recounted. */
  fillers: { value: string; good: boolean } | null;
  /** Words of the candidate's answers the analysis read. */
  wordsRead: number;
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export interface DeliverySummaryLine {
  id: string;
  text: string;
  atMs: number;
  endMs?: number;
}

/** The number behind a flag, against this session's own baseline. */
export interface DeliveryMeasure {
  label: string;
  value: number;
  baseline: number;
  /** "wpm", "st", "dB", "ms", "per 100 words". */
  unit: string;
}

export interface DeliveryFlag {
  id: string;
  kind: DeliveryFlagKind;
  turnId: string;
  atMs: number;
  endMs: number;
  severity: 1 | 2 | 3;
  measure: DeliveryMeasure;
  /** One line on what to do about it. */
  coaching: string;
}

/** Null where the recording gave nothing to measure (no voiced frames, too little speech). */
export interface DeliveryMetrics {
  wpmMean: number | null;
  /** Context for the pace chart, not a target the scores use. */
  wpmReferenceBand: { low: 140; high: 160 };
  /** Pitch variation in semitones; pitch never leaves the server in Hz. */
  pitchVariationSt: number | null;
  /** Loudness change per answer, dB; negative means fading. */
  energyTrendDbPerAnswer: number | null;
  /** Speech time over answer time, 0-1. */
  speechRatio: number | null;
  fillersPer100Words: number | null;
  longPauses: number;
}

/**
 * Fixed-step series over the recording; index i covers
 * `[i·stepMs, (i+1)·stepMs)`. Pitch is semitones and energy is dB, each
 * relative to the session median; null outside answers.
 */
export interface DeliverySeries {
  stepMs: number;
  pace: Array<{ atMs: number; wpm: number }>;
  pitchSt: Array<number | null>;
  energyDb: Array<number | null>;
}

export interface DeliveryAnswer {
  turnId: string;
  startMs: number;
  endMs: number;
  wpm: number | null;
  pitchRangeSt: number | null;
  energyDeltaDb: number | null;
  /** From the end of the question to the first speech; null when nothing was said. */
  leadInMs: number | null;
  fillers: number;
}

export interface DeliveryTranscriptSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  /** The answer it falls in; null for speech outside every answer window. */
  turnId: string | null;
}

export interface DeliveryTranscriptWord {
  w: string;
  s: number;
  e: number;
}

export interface DeliveryReport {
  durationMs: number;
  liveProvider: LiveSttProvider;
  summary: DeliverySummaryLine[];
  metrics: DeliveryMetrics;
  flags: DeliveryFlag[];
  series: DeliverySeries;
  answers: DeliveryAnswer[];
  transcript: { segments: DeliveryTranscriptSegment[]; words: DeliveryTranscriptWord[] };
}

// ---------------------------------------------------------------------------
// Normalized transcripts — server side; no response carries these. Mirrored
// only so the contract test can hold the whole file to the service's.
// ---------------------------------------------------------------------------

/** One recognised word: text, start and end (ms), confidence 0-1. */
export interface TimedWord {
  w: string;
  s: number;
  e: number;
  c: number;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface NormalizedTranscript {
  provider: LiveSttProvider | ReportSttProvider;
  languageCode: string;
  durationMs: number;
  text: string;
  words: TimedWord[];
  segments: TranscriptSegment[];
}

// ---------------------------------------------------------------------------
// The gateway stream protocol (the STT lab's AWS captions)
// ---------------------------------------------------------------------------

/**
 * The WebSocket subprotocol. The browser offers two: this one, and
 * `STREAM_TICKET_PREFIX + ticket`. The gateway selects this one, so the ticket
 * is never echoed back, and never appears in a URL or a log line.
 */
export const STREAM_SUBPROTOCOL = "rww.voice.v1" as const;
export const STREAM_TICKET_PREFIX = "ticket." as const;
/** The relay's WebSocket route, relative to `LabRunCreateResult.gatewayUrl`. */
export const STREAM_PATH = "/v1/voice/stream" as const;

/**
 * Binary frames carry 16 kHz mono signed 16-bit little-endian PCM (not WAV).
 * The client sends silence rather than gaps, as AWS asks.
 */
export const PCM = {
  sampleRate: 16_000,
  bytesPerSecond: 32_000,
  frameMs: 100,
  frameBytes: 3_200,
  /** A larger frame closes the stream with `STREAM_CLOSE.tooLarge`. */
  maxFrameBytes: 65_536,
} as const;

/**
 * Text frames from the browser. `start` comes first, before any audio;
 * `t0OffsetMs` is where the stream's zero sits on the session clock, so caption
 * times come back on that clock.
 */
export type StreamClientMessage = { type: "start"; sampleRate: typeof PCM.sampleRate; t0OffsetMs: number } | { type: "stop" };

/**
 * - `limited`: the lease, budget or AWS quota is full; fall back to Web Speech.
 * - `unavailable`: AWS failed; fall back.
 * - `bad-audio`: AWS refused the audio; fall back.
 * - `cap`: the session's recording cap was reached.
 * - `reconnect`: this stream ended early; ask for a new ticket and reconnect once.
 * - `internal`: the gateway's fault; fall back.
 */
export const STREAM_ERROR_CODES = ["limited", "unavailable", "bad-audio", "cap", "reconnect", "internal"] as const;
export type StreamErrorCode = (typeof STREAM_ERROR_CODES)[number];

/** Text frames from the gateway. Caption times are on the session clock. */
export type StreamServerMessage =
  | { type: "ready"; provider: LiveSttProvider }
  | { type: "partial" | "final"; resultId: string; text: string; startMs: number; endMs: number }
  | { type: "error"; code: StreamErrorCode; message: string }
  | { type: "end"; audioSeconds: number };

/** Application close codes (4000-4999). */
export const STREAM_CLOSE = {
  /** No audio for 30 s. */
  idle: 4000,
  /** A malformed or out-of-order message. */
  protocol: 4002,
  /** The ticket was missing, forged, expired, reused or for another session. */
  badTicket: 4401,
  /** The Origin is not an allowed frontend. */
  badOrigin: 4403,
  /** The session's recording cap (plus 5 s of grace) was reached. */
  cap: 4408,
  /** This user already has a stream open. */
  busy: 4409,
  /** A frame above `PCM.maxFrameBytes`. */
  tooLarge: 4413,
} as const;
export type StreamCloseCode = (typeof STREAM_CLOSE)[keyof typeof STREAM_CLOSE];

// ---------------------------------------------------------------------------
// The admin STT lab (/api/ai/voice/lab/*, ADMIN only)
// ---------------------------------------------------------------------------

/**
 * Every engine the lab compares; Web Speech runs in the admin's browser and its
 * text is posted back. `LIVE_STT_PROVIDERS` without `elevenlabs` since the
 * batch engine went: the lab scores what the browser and the gateway heard
 * while the clip was recorded, and nothing transcribes it a second time.
 */
export const LAB_PROVIDERS = ["aws-transcribe", "web-speech"] as const;
export type LabProvider = (typeof LAB_PROVIDERS)[number];

/**
 * A run records, then is scored in the same request that finishes it — there is
 * no longer anything to wait for, so nothing is ever `processing`.
 */
export const LAB_RUN_STATUSES = ["recording", "ready", "failed"] as const;
export type LabRunStatus = (typeof LAB_RUN_STATUSES)[number];

/** `POST /api/ai/voice/lab/runs` body. */
export interface LabRunCreateInput {
  /** The recorder's MIME type (codec parameters ignored), so the clip is stored under the right container. Defaults to WebM. */
  mime?: string;
}

/** `POST /api/ai/voice/lab/runs` — 201. One clip: an AWS stream ticket and one upload URL. */
export interface LabRunCreateResult {
  runId: string;
  gatewayUrl: string | null;
  streamTicket: string | null;
  /** A single presigned PUT for the whole clip (`seq` is 0). */
  upload: PartUrl;
  maxMs: number;
  /** Lab minutes left today, platform-wide. */
  minutesLeft: number;
}

/** What the browser measured for a live engine. */
export interface LabLiveResult {
  provider: Extract<LabProvider, LiveSttProvider>;
  text: string;
  /** From the first audio to the first partial. */
  firstPartialMs: number | null;
}

/** `POST /api/ai/voice/lab/runs/:id/finish` */
export interface LabRunFinishInput {
  durationMs: number;
  /** The reference transcript, when the admin pasted one. */
  reference?: string;
  live: LabLiveResult[];
  /** "Save to bake-off set": keep the audio past the run. */
  keepAudio: boolean;
}

export interface LabProviderResult {
  provider: LabProvider;
  text: string;
  /** Null without a reference transcript. */
  wer: number | null;
  normalizedWer: number | null;
  /** Milliseconds from the clip starting to this engine's first partial result. */
  firstPartialMs: number | null;
  estimatedUsd: number | null;
}

/** `GET /api/ai/voice/lab/runs/:id`, and each row of the list. */
export interface LabRun {
  id: string;
  status: LabRunStatus;
  createdAt: string;
  durationMs: number;
  reference: string | null;
  results: LabProviderResult[];
  audioKept: boolean;
  error: string | null;
}

/** `GET /api/ai/voice/lab/runs` — newest first. */
export interface LabRunList {
  runs: LabRun[];
}

/** `GET /api/ai/voice/lab/stats` — the last `days` of real interview sessions. */
export interface LabStats {
  days: number;
  /** Transcript accuracy ratings by the provider that wrote the captions. */
  ratings: Array<{ provider: LiveSttProvider; sessions: number; meanScore: number | null }>;
  /** Word error rate of the live captions against the batch transcript. A comparison, not accuracy. */
  liveAgreement: Array<{ provider: LiveSttProvider; sessions: number; medianWer: number | null }>;
  /** Share of voice sessions whose captions fell back from AWS to Web Speech. */
  fallbackRate: number | null;
}
