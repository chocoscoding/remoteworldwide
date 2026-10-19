// What the apply wizard keeps in its session (`./sessions.ts`), and how it is
// read back.
//
// The backend stores `state` as an opaque object, so everything that comes back
// is read defensively here: a field of the wrong type, or one from an older
// build, falls back to its default rather than breaking the page someone is
// trying to continue. Pure, and its imports are types or pure modules:
// tests/apply.test.mjs runs it under plain `node --test`.

import { isCurrentScore } from "@/app/lib/ats/score";
import type { CoverageState, ScanReport } from "@/app/lib/ats/types";
import type { TermAdvice } from "@/app/lib/dashboard/resume/ai-tools";
import type { CoverTone } from "@/app/lib/cover/api";
import { DEFAULT_LETTER_DESIGN, LETTERHEAD_OPTIONS, LETTER_FONT_OPTIONS, SPACING_OPTIONS, THEME_OPTIONS } from "@/app/lib/cover/presentation";
import type { AtsMetric, LetterDesign, ResumeContent } from "@/app/lib/dashboard/types";
import { metricValues } from "./fixes";
import type { ApplyHistoryStep, ScoreBasis } from "./history";

/** Mirrors `COVER_TONES` in app/lib/cover/api.ts, which this module cannot import at runtime. */
const TONES: readonly CoverTone[] = ["warm", "formal", "story", "short"];

/** Which draft the cover step shows: a tone the service wrote, or the user's own. */
export type CoverShown = CoverTone | "own";

export type ResumeToolId = "tailor" | "keywords";

/** One question from the employer's form, with its answer as it stands. */
export interface ApplyQuestion {
  id: string;
  question: string;
  answer: string;
  /** What the drafter said about the answer it filled; null before a draft, or once the user has typed. */
  drafted: { confidence: number; cat: string } | null;
  /** The user typed this answer, so a draft never replaces it. */
  edited: boolean;
  /** Read off a pasted form already answered in the saved-answer library: answering it is free. */
  answeredBefore?: boolean;
}

/** A tool's proposal, waiting for "Use this version" — kept, because it cost a credit. */
export interface ApplyProposal {
  tool: ResumeToolId;
  /** The resume it was proposed against; it means nothing once another is being sent. */
  forResumeId: string;
  content: ResumeContent;
  /** The terms it worked in. */
  terms: string[];
  /** Terms it worked in with nothing on the resume behind them yet: advice to be ready to back them up. */
  unbacked: string[];
  /** Picked terms that wouldn't go in as resume lines: nothing of them is in `content`, and they can be tried again on it. */
  missed: string[];
  /** Picked terms the resume's history doesn't show, each with advice. Never tried again. */
  notShown: TermAdvice[];
  /** Where each worked-in term went: the lines that show it ("Skills" for a skill name). */
  placed: Record<string, string[]>;
}

export interface ApplyResumeState {
  /** The resume this application started from: picked, uploaded, or the master by default. */
  baseId: string | null;
  baseName: string | null;
  /**
   * This application's one working copy (an `ai_resumes` draft). Every "Use this version"
   * updates it in place; it stays out of every resume list until the application is tracked.
   */
  draftId: string | null;
  draftName: string | null;
  /** The base the draft's current words were built from: a draft from another base is shown as such. */
  draftFromId: string | null;
  /** The draft, not the base, is what goes out. */
  sendDraft: boolean;
  /** The resume creator's copy of the draft, reused so opening it again doesn't make another. */
  creatorDocId: string | null;
  /**
   * What that copy said when the wizard last wrote or read it (`textPrint` of its text). Only a
   * change made in the creator since is brought back: a stale copy never overwrites a later change
   * made here (review, 2026-10-19). Null before any, and for sessions saved before it was kept.
   */
  creatorSeen: string | null;
  /** Every change to the draft, oldest first (owner's design, 2026-10-19): what undo, redo and the history list walk. */
  history: ApplyHistoryStep[];
  /** Which step of `history` the draft is at now; later steps are what redo brings back. */
  historyAt: number;
  /**
   * The keywords the AI already worked in for this application, each with the lines it put it in
   * ("Skills" for the list). Never offered again while those lines stand: the scan may still call
   * one partly shown, and adding it again added nothing (50-job run, 2026-10-19). Undo takes the
   * lines away, and the chip comes back. One it tried and could place nowhere is `[TRIED, ...the
   * places tried]` (fixes.ts): hidden only while the same places are picked, since undo goes back
   * to the very words it was tried on. Emptied when another base resume is picked.
   */
  worked: WorkedTerm[];
}

export interface WorkedTerm {
  label: string;
  lines: string[];
}

export interface ApplyCoverState {
  /** The letter as it will be sent: plain text, what the application records. */
  letter: string;
  /** The editor's HTML for that letter, formatting included. Empty: the editor builds it from `letter`. */
  html: string;
  /** How the letter looks: the cover letter creator's theme, font, spacing and letterhead. */
  design: LetterDesign;
  skipped: boolean;
  /** Tone for the next letter. */
  tone: CoverTone;
  shown: CoverShown | null;
  /** Each tone's latest text, edits included, so going back to one is free. */
  drafts: Partial<Record<CoverShown, string>>;
  /** The resume the shown letter was written from. */
  writtenFrom: string | null;
}

export interface ApplyState {
  resume: ApplyResumeState;
  /**
   * The last score, for the resume and the version it was run on, with the score of the version
   * scored before it, so the screen can say how much a change moved it.
   */
  scan: {
    resumeId: string;
    version: number;
    report: ScanReport;
    previousScore: number | null;
    /** Each requirement's state on the version scored before, by id: what "Up 15" is explained from. */
    previousStates?: Record<string, CoverageState>;
    /** Each check's value on the version scored before, by metric id: the small "+18" beside a check. */
    previousMetrics?: Record<string, number>;
  } | null;
  proposal: ApplyProposal | null;
  cover: ApplyCoverState;
  questions: ApplyQuestion[];
  tracked: boolean;
}

export const EMPTY_QUESTION: ApplyQuestion = { id: "q-0", question: "", answer: "", drafted: null, edited: false };

export const EMPTY_APPLY_STATE: ApplyState = {
  resume: {
    baseId: null,
    baseName: null,
    draftId: null,
    draftName: null,
    draftFromId: null,
    sendDraft: false,
    creatorDocId: null,
    creatorSeen: null,
    history: [],
    historyAt: 0,
    worked: [],
  },
  scan: null,
  proposal: null,
  cover: { letter: "", html: "", design: DEFAULT_LETTER_DESIGN, skipped: false, tone: "warm", shown: null, drafts: {}, writtenFrom: null },
  questions: [EMPTY_QUESTION],
  tracked: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

const STATES: readonly CoverageState[] = ["satisfied", "partial", "missing", "undetermined"];

/** A stored map of requirement id to its state; anything else is dropped. */
const readStates = (value: Record<string, unknown>): Record<string, CoverageState> =>
  Object.fromEntries(Object.entries(value).filter((entry): entry is [string, CoverageState] => STATES.includes(entry[1] as CoverageState)));
const isTone = (value: unknown): value is CoverTone => TONES.includes(value as CoverTone);
const oneOf = <T extends string>(value: unknown, options: readonly { id: T }[], fallback: T): T =>
  options.some((option) => option.id === value) ? (value as T) : fallback;
const isShown = (value: unknown): value is CoverShown => value === "own" || isTone(value);

/** Enough of a report to draw: a score and the lists the panel maps over. */
function readReport(value: unknown): ScanReport | null {
  if (!isRecord(value) || typeof value.score !== "number") return null;
  if (!Array.isArray(value.gaps) || !Array.isArray(value.verdicts) || !Array.isArray(value.metrics)) return null;
  return { ...(value as unknown as ScanReport), rewrites: Array.isArray(value.rewrites) ? (value.rewrites as ScanReport["rewrites"]) : [] };
}

/** Enough of a resume to render and send back: every list the tools and the paper map over. */
/** A stored map of metric id to its value; anything else is dropped. */
const readNumbers = (value: Record<string, unknown>): Record<string, number> =>
  Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])));

/** What a step's score was made from, once its report was dropped for room. */
function readBasis(value: unknown): ScoreBasis | null {
  if (!isRecord(value) || !Array.isArray(value.metrics)) return null;
  return {
    metrics: value.metrics.filter(isRecord) as unknown as AtsMetric[],
    stuffingPenalty: typeof value.stuffingPenalty === "number" ? value.stuffingPenalty : 0,
  };
}

/** The most worked-in keywords kept, and lines per keyword (room for `TRIED` and the three places), and characters per line. */
const MAX_WORKED = 60;
const MAX_WORKED_LINES = 4;
// The AI writes summaries up to 900 characters, and a term placed there is kept with the whole summary.
const MAX_WORKED_LINE_CHARS = 1_000;

function readWorked(value: unknown): WorkedTerm[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { label: string; lines: unknown } => isRecord(item) && typeof item.label === "string" && item.label.trim() !== "")
    .map((item) => ({
      label: item.label.slice(0, 120),
      lines: (Array.isArray(item.lines) ? item.lines : [])
        .filter((line): line is string => typeof line === "string" && line.trim() !== "")
        .slice(0, MAX_WORKED_LINES)
        .map((line) => line.slice(0, MAX_WORKED_LINE_CHARS)),
    }))
    .filter((item) => item.lines.length > 0)
    .slice(-MAX_WORKED);
}

/**
 * The draft's change history, each step read whole or dropped, and where it stands. A step's score
 * stands only when its report (or the basis kept in its place) makes it by today's formula (owner,
 * 2026-10-19: no longer keyword match alone). Any other reads as none, never worked out again from
 * old numbers: the list shows "–", and going back to the step rescores it.
 */
function readHistory(value: unknown, at: unknown): { history: ApplyHistoryStep[]; historyAt: number } {
  const history: ApplyHistoryStep[] = (Array.isArray(value) ? value : []).filter(isRecord).flatMap((row) => {
    const content = readContent(row.content);
    if (!content || typeof row.id !== "string" || typeof row.label !== "string" || typeof row.at !== "string") return [];
    const report = readReport(row.report);
    const basis = report ? null : readBasis(row.basis);
    const score = typeof row.score === "number" ? row.score : null;
    const stands = score !== null && (report ? isCurrentScore(report) : basis !== null && isCurrentScore({ score, ...basis }));
    return [
      {
        id: row.id,
        label: row.label,
        at: row.at,
        content,
        version: typeof row.version === "number" ? row.version : null,
        score: stands ? score : null,
        report: stands ? report : null,
        ...(stands && basis ? { basis } : {}),
      },
    ];
  });
  const index = typeof at === "number" && Number.isInteger(at) ? at : history.length - 1;
  return { history, historyAt: Math.max(0, Math.min(index, history.length - 1)) };
}

function readContent(value: unknown): ResumeContent | null {
  if (!isRecord(value)) return null;
  const lists = ["links", "experience", "education", "projects", "certifications", "skills"] as const;
  if (lists.some((key) => !Array.isArray(value[key]))) return null;
  return value as unknown as ResumeContent;
}

/** A stored letter design, each control falling back to the default when it isn't one of the creator's options. */
function readDesign(value: unknown): LetterDesign {
  const raw = isRecord(value) ? value : {};
  return {
    theme: oneOf(raw.theme, THEME_OPTIONS, DEFAULT_LETTER_DESIGN.theme),
    font: oneOf(raw.font, LETTER_FONT_OPTIONS, DEFAULT_LETTER_DESIGN.font),
    spacing: oneOf(raw.spacing, SPACING_OPTIONS, DEFAULT_LETTER_DESIGN.spacing),
    letterhead: oneOf(raw.letterhead, LETTERHEAD_OPTIONS, DEFAULT_LETTER_DESIGN.letterhead),
  };
}

function readQuestions(value: unknown): ApplyQuestion[] {
  const rows = (Array.isArray(value) ? value : []).filter(isRecord).map((row, index): ApplyQuestion => ({
    id: str(row.id) ?? `q-${index}`,
    question: str(row.question) ?? "",
    answer: str(row.answer) ?? "",
    drafted:
      isRecord(row.drafted) && typeof row.drafted.confidence === "number" && typeof row.drafted.cat === "string"
        ? { confidence: row.drafted.confidence, cat: row.drafted.cat }
        : null,
    edited: row.edited === true,
    ...(row.answeredBefore === true ? { answeredBefore: true } : {}),
  }));
  return rows.length > 0 ? rows : [EMPTY_QUESTION];
}

/** A session's `state` as the wizard runs on it: every field present and of its type. */
export function readApplyState(raw: unknown): ApplyState {
  if (!isRecord(raw)) return EMPTY_APPLY_STATE;
  const resume = isRecord(raw.resume) ? raw.resume : {};
  const cover = isRecord(raw.cover) ? raw.cover : {};
  const scan = isRecord(raw.scan) ? raw.scan : null;
  const proposal = isRecord(raw.proposal) ? raw.proposal : null;

  const report = scan ? readReport(scan.report) : null;
  const proposalContent = proposal ? readContent(proposal.content) : null;
  const drafts: Partial<Record<CoverShown, string>> = {};
  if (isRecord(cover.drafts)) {
    for (const [key, text] of Object.entries(cover.drafts)) if (isShown(key) && typeof text === "string") drafts[key] = text;
  }

  return {
    resume: {
      baseId: str(resume.baseId),
      baseName: str(resume.baseName),
      draftId: str(resume.draftId),
      draftName: str(resume.draftName),
      draftFromId: str(resume.draftFromId),
      sendDraft: resume.sendDraft === true && typeof resume.draftId === "string",
      creatorDocId: str(resume.creatorDocId),
      creatorSeen: str(resume.creatorSeen),
      ...readHistory(resume.history, resume.historyAt),
      worked: readWorked(resume.worked),
    },
    scan:
      scan && report && typeof scan.resumeId === "string" && typeof scan.version === "number"
        ? {
            resumeId: scan.resumeId,
            version: scan.version,
            report,
            previousScore: typeof scan.previousScore === "number" ? scan.previousScore : null,
            ...(isRecord(scan.previousStates) ? { previousStates: readStates(scan.previousStates) } : {}),
            ...(isRecord(scan.previousMetrics) ? { previousMetrics: readNumbers(scan.previousMetrics) } : {}),
          }
        : null,
    proposal:
      proposal && proposalContent && (proposal.tool === "tailor" || proposal.tool === "keywords") && typeof proposal.forResumeId === "string"
        ? {
            tool: proposal.tool,
            forResumeId: proposal.forResumeId,
            content: proposalContent,
            terms: strings(proposal.terms),
            // `skipped` is what a build from earlier on 2026-10-03 called it.
            unbacked: strings(proposal.unbacked ?? proposal.skipped),
            missed: strings(proposal.missed),
            notShown: (Array.isArray(proposal.notShown) ? proposal.notShown : [])
              .filter(isRecord)
              .filter((row) => typeof row.term === "string" && typeof row.advice === "string")
              .map((row) => ({ term: row.term as string, advice: row.advice as string })),
            placed: isRecord(proposal.placed)
              ? Object.fromEntries(Object.entries(proposal.placed).map(([term, lines]) => [term, strings(lines)]))
              : {},
          }
        : null,
    cover: {
      letter: str(cover.letter) ?? "",
      html: str(cover.html) ?? "",
      design: readDesign(cover.design),
      skipped: cover.skipped === true,
      tone: isTone(cover.tone) ? cover.tone : "warm",
      shown: isShown(cover.shown) ? cover.shown : null,
      drafts,
      writtenFrom: str(cover.writtenFrom),
    },
    questions: readQuestions(raw.questions),
    tracked: raw.tracked === true,
  };
}

type ScanBaseline = Pick<NonNullable<ApplyState["scan"]>, "previousScore" | "previousStates" | "previousMetrics">;

/**
 * What a new score of this version is measured against ("Up 3 since last change", the "+18" beside a
 * check): the last version scored, or, on a re-run of that same version, what it was measured
 * against. Never a partly checked scan (its numbers are not the resume's), and never one an older
 * formula made (owner, 2026-10-19: the score is no longer keyword match alone, so the move would be
 * the formula, not the resume).
 */
export function scanBaseline(last: ApplyState["scan"], resumeId: string, version: number): ScanBaseline {
  if (!last || !isCurrentScore(last.report)) return { previousScore: null };
  if (last.resumeId === resumeId && last.version === version) {
    return {
      previousScore: last.previousScore,
      ...(last.previousStates ? { previousStates: last.previousStates } : {}),
      ...(last.previousMetrics ? { previousMetrics: last.previousMetrics } : {}),
    };
  }
  if (last.report.degraded) return { previousScore: null };
  return {
    previousScore: last.report.score,
    previousStates: Object.fromEntries(last.report.verdicts.map((verdict) => [verdict.requirement.id, verdict.state])),
    previousMetrics: metricValues(last.report),
  };
}

/**
 * A short fingerprint of a text (FNV-1a, with its length): enough to tell whether the resume
 * creator's copy changed (`ApplyResumeState.creatorSeen`) without keeping the whole text in the session.
 */
export function textPrint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length.toString(36)}.${(hash >>> 0).toString(36)}`;
}

/** The resume that goes out with the application: the draft once its version is in use, else the base. */
export const sendingResumeId = (resume: ApplyResumeState): string | null => (resume.sendDraft && resume.draftId ? resume.draftId : resume.baseId);

/** Steps the wizard has, for reading a stored step and the visited list. */
export const APPLY_STEPS = [1, 2, 3, 4, 5] as const;
export type ApplyStepNum = (typeof APPLY_STEPS)[number];

export const APPLY_STEP_LABELS: Record<ApplyStepNum, string> = {
  1: "The role",
  2: "Resume",
  3: "Cover letter",
  4: "Warm intro",
  5: "Answers & track",
};

export const readStep = (value: unknown): ApplyStepNum => (APPLY_STEPS.includes(value as ApplyStepNum) ? (value as ApplyStepNum) : 1);

/** Visited steps, always including the one on screen. */
export function readVisited(value: unknown, step: ApplyStepNum): ApplyStepNum[] {
  const seen = new Set<ApplyStepNum>([step]);
  if (Array.isArray(value)) for (const item of value) if (APPLY_STEPS.includes(item as ApplyStepNum)) seen.add(item as ApplyStepNum);
  return APPLY_STEPS.filter((n) => seen.has(n));
}
