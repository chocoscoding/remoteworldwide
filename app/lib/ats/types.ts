// What the ATS scorer returns.
//
// Mirrors the AI service by hand: `src/types/index.ts` (ScanResult and the
// verdict shapes) and `src/services/scanService.ts` (ScanEnvelope,
// ScanExplanation). The two projects are separate packages with no shared
// build, so the service's `tests/contracts/frontend-types.test.ts` reads this
// file and fails if the field names drift — a mirror that drifts silently
// shows up as a blank panel in production rather than a red build.

import type { AtsKeyword, AtsMetric } from "@/app/lib/dashboard/types";

export type { AtsKeyword, AtsMetric };

export const REQUIREMENT_TYPES = ["required", "preferred"] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const REQUIREMENT_CATEGORIES = ["skill", "experience", "education", "responsibility"] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export interface Requirement {
  id: string;
  text: string;
  type: RequirementType;
  category: RequirementCategory;
  /** 1-5; the extractor's view of how load-bearing this requirement is. */
  weight: number;
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

/**
 * A finished scan. `explanation` and `rewrites` are empty until phase two
 * lands — the score does not wait on the write-up, so a report is renderable
 * with them absent.
 */
export interface ScanReport {
  scanId: string;
  resumeVersion: number;
  /** 0-100 overall match. */
  score: number;
  metrics: AtsMetric[];
  /** Missing keywords, highest impact first. */
  gaps: AtsKeyword[];
  verdicts: RequirementVerdict[];
  /** True when a provider was unavailable and the score came from a reduced path. */
  degraded: boolean;
  degradedReason: string | null;
  explanation: string | null;
  rewrites: BulletRewrite[];
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
