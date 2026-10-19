// What the ATS scorer returns.
//
// Mirrors the AI service by hand: `src/types/index.ts` (ScanResult and the
// verdict shapes) and `src/services/scanService.ts` (ScanEnvelope,
// ScanExplanation). The two projects are separate packages with no shared
// build, so the service's `tests/contracts/frontend-types.test.ts` reads this
// file and fails if the field names drift — a mirror that drifts silently
// shows up as a blank panel in production rather than a red build.

import type { AtsKeyword, AtsMetric, ResumeContent } from "@/app/lib/dashboard/types";

export type { AtsKeyword, AtsMetric };

export const REQUIREMENT_TYPES = ["required", "preferred"] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

/**
 * `eligibility` (where the candidate must live or may work, visa, time zone) and `trait` (curiosity,
 * passion) are never scored and never resume text: shown beside the score as notes
 * (RWW/ATS-QUALITY-PLAN.md, 1.2/1.3).
 */
export const REQUIREMENT_CATEGORIES = ["skill", "experience", "education", "responsibility", "eligibility", "trait"] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

/** Whether a requirement is a note beside the score rather than something the resume shows. */
export const isPostingNote = (requirement: Pick<Requirement, "category">): boolean =>
  requirement.category === "eligibility" || requirement.category === "trait";

export interface Requirement {
  id: string;
  text: string;
  type: RequirementType;
  category: RequirementCategory;
  /** 1-5; the extractor's view of how load-bearing this requirement is. */
  weight: number;
  /** 2 to 5 words, the way a resume writer names it. Absent on scans from before 2026-10-18. */
  label?: string;
  /** Words a resume could prove it with ("SaaS", "ARR"). Absent on older scans. */
  proof?: string[];
}

/** An eligibility line or a trait from the posting, shown beside the score. */
export interface PostingNote {
  id: string;
  label: string;
  text: string;
}

export const COVERAGE_STATES = ["satisfied", "partial", "missing", "undetermined"] as const;
export type CoverageState = (typeof COVERAGE_STATES)[number];

/** The cascade stage that decided a requirement. Shown nowhere; kept for parity with the service. */
export type ResolvedBy = "lexical" | "cosine" | "rerank" | "fallback";

export type ChunkSection = "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "header";

/** A resume line the scorer retrieved for a requirement — "you matched this with this bullet". */
export interface Evidence {
  chunkId: string;
  text: string;
  section: ChunkSection;
  role: string | null;
  score: number;
}

export interface RequirementVerdict {
  requirement: Requirement;
  state: CoverageState;
  score: number;
  resolvedBy: ResolvedBy;
  evidence: Evidence[];
  confidence: "high" | "medium" | "low";
}

/** One suggested bullet edit. `before` is the service's own copy of the line, never the model's. */
export interface BulletRewrite {
  chunkId: string;
  before: string;
  after: string;
  why: string;
}

/** A fix a general score suggests, said plainly, with the resume's own lines it is about. Mirrors the scorer's. */
export interface ScanAdvice {
  id: string;
  /** The metric it lifts: parseability, impact-language or length-format. */
  metric: string;
  title: string;
  detail: string;
  /** Up to two of the resume's own lines it is about. */
  lines: string[];
}

/**
 * A finished scan. `explanation` and `rewrites` are empty until phase two
 * lands — the score does not wait on the write-up, so a report is renderable
 * with them absent.
 */
export interface ScanReport {
  scanId: string;
  resumeVersion: number;
  /**
   * 0-99 ATS score, never 100. Not the match: 70% keyword match, 15% impact language, 10%
   * parseability, 5% length & format (HEADLINE_SHARES), or the mean of the last three when keyword
   * match was not checked; stuffing comes off only from 94. The match is the keyword-match metric.
   * Scans from before 2026-10-19 scored the match alone (`isCurrentScore`).
   */
  score: number;
  metrics: AtsMetric[];
  /** Missing keywords, highest impact first. */
  gaps: AtsKeyword[];
  verdicts: RequirementVerdict[];
  /** True when a provider was unavailable and the score came from a reduced path. */
  degraded: boolean;
  degradedReason: string | null;
  /** Where the candidate must live or may work, as the posting says it. Never scored. Absent on older scans. */
  eligibility?: PostingNote[];
  /** Personal qualities the posting asks for: for the cover letter or interview. Never scored. */
  traits?: PostingNote[];
  /** The 2 to 4 problems the employer is hiring to solve. */
  needs?: string[];
  /** Why the resume reads as keyword- or number-stuffed. A suggestion: nothing is refused. */
  stuffing?: string[];
  /** The points those reasons took off the score (0 to 4). */
  stuffingPenalty?: number;
  /** One or two fixes for a general score under 85, from its weakest sections. Absent on older scans. */
  advice?: ScanAdvice[];
  explanation: string | null;
  rewrites: BulletRewrite[];
}

/**
 * Where a stored scan's written half stands. Mirrors `EXPLANATION_STATUSES` in
 * the service's `scanService.ts`:
 *
 *   ready        `explanation` is the write-up
 *   pending      still on the service's queue — an email follows when it lands
 *   unavailable  not written, and nothing is writing it
 *   none         a general score, which has nothing to explain
 */
export const EXPLANATION_STATUSES = ["ready", "pending", "unavailable", "none"] as const;
export type ExplanationStatus = (typeof EXPLANATION_STATUSES)[number];

/**
 * `GET /api/ai/scan/:id` — one of this user's stored scans, read back whole:
 * the same report a live scan renders, plus which resume and posting it was,
 * when it ran, and where its write-up stands. Free: nothing is scored or
 * written. What the late-explanation email's link (`?scan=<id>`) opens.
 *
 * Mirrors `ScanRecord` in the service's `scanService.ts`.
 */
export interface ScanRecord extends ScanReport {
  /** The ingested resume that was scored — an `IngestedResume["resumeId"]`, not a vault document id. */
  resumeId: string;
  /** The file that was scored. Null when that resume has since been removed. */
  fileName: string | null;
  /** The saved job it was scored against; null for a general score. */
  jobId: string | null;
  /** When the scan ran, ISO-8601. */
  scannedAt: string;
  explanationStatus: ExplanationStatus;
}

/** `POST /api/ai/scan` body. Omit `jdText` for the general score. */
export interface ScanInput {
  resumeId: string;
  jdText?: string | null;
  /** The saved job's id, when the description came from one rather than being pasted. */
  jobId?: string | null;
}

/** `POST /api/ai/scan/requirements` — what a posting asks for, with no resume and no credit spent. */
export interface ExtractedRequirements {
  requirements: Requirement[];
  /** "heuristic" means the model was unavailable and this list came from the fallback extractor. */
  source: "model" | "heuristic";
  /** The 2 to 4 problems the employer is hiring to solve ([] from the fallback). */
  needs?: string[];
  version?: number;
}

export const RESUME_STATUSES = ["pending", "ready", "failed"] as const;
export type ResumeStatus = (typeof RESUME_STATUSES)[number];

/**
 * `GET /api/ai/resume` — one ingested resume. This is what a scan names:
 * `resumeId` here is the only valid `ScanInput["resumeId"]`.
 *
 * `content` is always null in a list; the route drops it rather than shipping
 * every parsed resume to draw a row of filenames.
 */
export interface IngestedResume {
  resumeId: string;
  version: number;
  status: ResumeStatus;
  fileName: string;
  content: null;
  /** Why parsing failed. Non-null only when `status` is "failed". */
  error: string | null;
}

/**
 * `POST /api/ai/scan/lookup` — the latest scan this user already ran against
 * one posting, with any of their resumes; `null` when there is none. Free and
 * read-only: it reads back a score already paid for and never runs a scan.
 *
 * Mirrors `StoredScan` in the service's `scanService.ts`. What the log-an-
 * application payoff shows instead of an estimate.
 */
export interface StoredScan {
  scanId: string;
  resumeId: string;
  /** The file that was scored, as the ATS picker names it. Null when that resume has since been removed. */
  fileName: string | null;
  /** The ATS score, as on `ScanReport.score`: not the match, which is the keyword-match metric. */
  score: number;
  metrics: AtsMetric[];
  /** Missing keywords, highest impact first — exactly as the scan stored them. */
  gaps: AtsKeyword[];
  degraded: boolean;
  degradedReason: string | null;
  /** When the scan ran, ISO-8601. */
  scannedAt: string;
}

/**
 * `GET /api/ai/resume/:id` — one ingested resume with the parsed content the
 * list leaves out. `content` is null only for a row whose parsing failed.
 */
export interface IngestedResumeDetail extends Omit<IngestedResume, "content"> {
  content: ResumeContent | null;
}
