// What the apply wizard keeps in its session (`./sessions.ts`), and how it is
// read back.
//
// The backend stores `state` as an opaque object, so everything that comes back
// is read defensively here: a field of the wrong type, or one from an older
// build, falls back to its default rather than breaking the page someone is
// trying to continue. Pure, and its imports are types or pure modules:
// tests/apply.test.mjs runs it under plain `node --test`.

import type { ScanReport } from "@/app/lib/ats/types";
import type { CoverTone } from "@/app/lib/cover/api";
import { DEFAULT_LETTER_DESIGN, LETTERHEAD_OPTIONS, LETTER_FONT_OPTIONS, SPACING_OPTIONS, THEME_OPTIONS } from "@/app/lib/cover/presentation";
import type { LetterDesign, ResumeContent } from "@/app/lib/dashboard/types";

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
  scan: { resumeId: string; version: number; report: ScanReport; previousScore: number | null } | null;
  proposal: ApplyProposal | null;
  cover: ApplyCoverState;
  questions: ApplyQuestion[];
  tracked: boolean;
}

export const EMPTY_QUESTION: ApplyQuestion = { id: "q-0", question: "", answer: "", drafted: null, edited: false };

export const EMPTY_APPLY_STATE: ApplyState = {
  resume: { baseId: null, baseName: null, draftId: null, draftName: null, draftFromId: null, sendDraft: false, creatorDocId: null },
  scan: null,
  proposal: null,
  cover: { letter: "", html: "", design: DEFAULT_LETTER_DESIGN, skipped: false, tone: "warm", shown: null, drafts: {}, writtenFrom: null },
  questions: [EMPTY_QUESTION],
  tracked: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
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
  const rows = (Array.isArray(value) ? value : []).filter(isRecord).map(
    (row, index): ApplyQuestion => ({
      id: str(row.id) ?? `q-${index}`,
      question: str(row.question) ?? "",
      answer: str(row.answer) ?? "",
      drafted:
        isRecord(row.drafted) && typeof row.drafted.confidence === "number" && typeof row.drafted.cat === "string"
          ? { confidence: row.drafted.confidence, cat: row.drafted.cat }
          : null,
      edited: row.edited === true,
    }),
  );
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
    },
    scan:
      scan && report && typeof scan.resumeId === "string" && typeof scan.version === "number"
        ? { resumeId: scan.resumeId, version: scan.version, report, previousScore: typeof scan.previousScore === "number" ? scan.previousScore : null }
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
