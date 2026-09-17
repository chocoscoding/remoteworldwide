// Mirror of the job picker contracts.
//
// The backend owns these shapes (`remoteworldwidebackend/src/types/jobs.ts`)
// and the AI service owns the thread shapes at the bottom
// (`remoteworldwideai/src/types/jobs.ts`). Neither can be imported across the
// repo boundary, so this file is kept by hand and a contract test compares the
// three field for field. Change one, change all of them, in the same piece of
// work.
//
// One deliberate difference from the backend file: `createdAt` and `updatedAt`
// are `Date` here because `app/lib/api/core.ts` revives those keys, while every
// other timestamp stays an ISO string because it is not in DATE_KEYS.

export const JOB_SOURCES = ["platform", "link", "paste", "manual"] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

export const REMOTE_TYPES = ["remote", "hybrid", "onsite"] as const;
export type RemoteType = (typeof REMOTE_TYPES)[number];

export const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship", "temporary"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const SALARY_PERIODS = ["hour", "day", "week", "month", "year"] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

/**
 * Everything the picker can know about a job. Nullable wherever a value is not
 * guaranteed; list fields are always arrays, `[]` meaning none. Only
 * `descriptionHtml` is HTML, and it arrives sanitized.
 */
export interface JobDetails {
  /** Always the saved job's id — every pick upserts one. */
  id: string;
  source: JobSource;
  company: string | null;
  role: string | null;
  description: string | null;
  url: string | null;
  salary: string | null;
  platformJobId: string | null;
  slug: string | null;
  applyUrl: string | null;
  category: string | null;
  regions: string[];
  seniority: string | null;
  postedAt: string | null;
  companyLogo: string | null;
  companyWebsite: string | null;
  companyAbout: string | null;
  companyLinkedin: string | null;
  descriptionHtml: string | null;
  summary: string | null;
  location: string | null;
  remoteType: RemoteType | null;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
  requirements: string[];
  responsibilities: string[];
  niceToHaves: string[];
  benefits: string[];
  skills: string[];
  yearsExperienceMin: number | null;
  yearsExperienceMax: number | null;
}

export type JobDetailsKey = keyof JobDetails;

export type JobDraft = Omit<JobDetails, "id">;

export const JOB_FIELD_SOURCES = ["platform", "ats-api", "crawl", "paste", "model", "manual"] as const;
export type JobFieldSource = (typeof JOB_FIELD_SOURCES)[number];

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

export const JOB_IMPORT_STATUSES = ["queued", "reading", "extracting", "done", "failed", "abandoned"] as const;
export type JobImportStatus = (typeof JOB_IMPORT_STATUSES)[number];

export const JOB_IMPORT_MODES = ["link", "text", "enrich"] as const;
export type JobImportMode = (typeof JOB_IMPORT_MODES)[number];

export const JOB_IMPORT_ERROR_CODES = [
  "invalid-url",
  "target-blocked",
  "target-closed",
  "target-unreachable",
  "not-a-posting",
  "limited",
  "paused",
  "timeout",
  "provider-error",
  "too-long",
] as const;
export type JobImportErrorCode = (typeof JOB_IMPORT_ERROR_CODES)[number];

export const JOB_IMPORT_VIA = ["ats-api", "crawl", "paste", "listing"] as const;
export type JobImportVia = (typeof JOB_IMPORT_VIA)[number];

export const SLICE_STRATEGIES = ["ats-api", "lines", "fallback", "none"] as const;
export type SliceStrategy = (typeof SLICE_STRATEGIES)[number];

export interface JobImportMeta {
  cached: boolean;
  rendered: boolean;
  via: JobImportVia;
  sliceStrategy: SliceStrategy;
  missing: JobDetailsKey[];
  sources: Partial<Record<JobDetailsKey, JobFieldSource>>;
}

export interface JobImportError {
  code: JobImportErrorCode;
  message: string;
  retryAfterMs: number | null;
}

export interface JobImportItem {
  id: string;
  mode: JobImportMode;
  status: JobImportStatus;
  savedJobId: string | null;
  draft: JobDraft | null;
  meta: JobImportMeta | null;
  error: JobImportError | null;
  startedAt: string;
  updatedAt: Date;
}

export type StartJobImportInput = { url: string } | { text: string } | { savedJobId: string };

/** Terminal statuses stop polling. */
export const TERMINAL_IMPORT_STATUSES: readonly JobImportStatus[] = ["done", "failed", "abandoned"];

// ---------------------------------------------------------------------------
// Saved jobs
// ---------------------------------------------------------------------------

export interface SavedJobExtraction {
  mode: JobImportMode | "listing" | "manual";
  rendered: boolean;
  sliceStrategy: SliceStrategy;
  extractedAt: string | null;
  /** Set with `refusal` when an enrichment refused this text for good; both cleared when the description changes. */
  attemptedAt: string | null;
  refusal: JobImportErrorCode | null;
  missing: JobDetailsKey[];
  sources: Partial<Record<JobDetailsKey, JobFieldSource>>;
}

export interface SavedJobItem extends JobDetails {
  extraction: SavedJobExtraction;
  lastUsedAt: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SaveJobInput =
  | { platformJobId: string }
  | { importId?: string; draft: Partial<JobDraft> & { company: string; role: string } };

export const EDITABLE_JOB_FIELDS = [
  "company",
  "role",
  "description",
  "url",
  "salary",
  "location",
  "remoteType",
  "employmentType",
] as const;
export type EditableJobField = (typeof EDITABLE_JOB_FIELDS)[number];
export type UpdateSavedJobInput = Partial<Pick<JobDetails, EditableJobField>>;

// ---------------------------------------------------------------------------
// Remote Worldwide listings
// ---------------------------------------------------------------------------

export interface PlatformJobSearchItem {
  id: string;
  slug: string;
  role: string;
  company: string;
  companyLogo: string | null;
  seniority: string | null;
  regions: string[];
  postedAt: string;
}

// ---------------------------------------------------------------------------
// Ask about a job — owned by the AI service (remoteworldwideai/src/types/jobs.ts)
// ---------------------------------------------------------------------------

export const JD_QUICK_QUESTION_IDS = ["fit", "really-asking", "salary", "questions-to-ask"] as const;
export type JdQuickQuestionId = (typeof JD_QUICK_QUESTION_IDS)[number];

export interface JobAnswerEvidence {
  /** A resume bullet the answer relied on. */
  text: string;
  /** The role that bullet sits under, when it has one. */
  role: string | null;
}

/** The frontend's existing `JdQaAnswer` shape, plus evidence the UI may show. */
export interface JobAnswer {
  id: string;
  question: string;
  verdict: string;
  missing: string;
  tips: string[];
  evidence: JobAnswerEvidence[];
}

export interface JobThreadEntry {
  id: string;
  questionId: JdQuickQuestionId | null;
  question: string;
  answer: JobAnswer;
  /** ISO 8601. */
  askedAt: string;
}

export interface JobThreadItem {
  id: string;
  savedJobId: string;
  company: string | null;
  role: string | null;
  entries: JobThreadEntry[];
  answeredQuestionIds: JdQuickQuestionId[];
}

export type AskJobInput = { questionId: JdQuickQuestionId } | { question: string };

export interface AskJobResult {
  entry: JobThreadEntry;
  /** False when the answer was already on the thread and nothing was spent. */
  charged: boolean;
  /** Balance after the spend, when the billing service reported one. */
  credits: number | null;
}
