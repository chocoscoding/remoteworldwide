// The job an application is being prepared for, as every step of the wizard
// reads it.
//
// Almost always a saved job: the front door saves whatever it is given (a
// listing, a link it read, a pasted description), because a saved job's id is
// what the rest of the product keys on — the warm-intro search, the scan's and
// the letter's requirement cache, and the application row's `savedJobId`. When
// that save fails the wizard still runs on what was read; only the steps that
// need the id say so and step aside.

import { applicationUrl } from "@/app/lib/applications/api";
import type { EmploymentType, JobDetails, RemoteType } from "@/app/lib/jobs/types";
import type { ParsedJob } from "@/app/lib/dashboard/parse-jd";

export type StartSource = "link" | "paste" | "saved" | "board";

export interface StartedJob {
  /**
   * Minted when the job is started, never during a render: the application's
   * client id and idempotency key, so a retried "Track as applied" writes once.
   */
  clientId: string;
  /** Null only when saving it failed; `unsavedReason` then says why. */
  savedJobId: string | null;
  unsavedReason: string | null;
  company: string;
  role: string;
  description: string | null;
  summary: string | null;
  /** The posting. */
  url: string | null;
  /** Where the application form is, when the posting names one apart from itself. */
  applyUrl: string | null;
  salary: string | null;
  location: string | null;
  remoteType: RemoteType | null;
  employmentType: EmploymentType | null;
  requirements: string[];
  /** A Remote Worldwide listing: the application is logged as `internal`. */
  platform: boolean;
  /** How it got here, shown as a small provenance chip. */
  source: StartSource;
}

/** What the front door hands over. The wizard mints `clientId` when it takes it. */
export type PickedJob = Omit<StartedJob, "clientId">;

export const SOURCE_LABELS: Record<StartSource, string> = {
  link: "From a link",
  paste: "Pasted in",
  saved: "From your jobs",
  board: "Remote Worldwide listing",
};

/** A saved job, which is what nearly every start becomes. */
export function fromSavedJob(job: JobDetails, source: StartSource): PickedJob {
  return {
    savedJobId: job.id,
    unsavedReason: null,
    company: job.company?.trim() || "Company not named",
    role: job.role?.trim() || "Role not named",
    description: job.description?.trim() || null,
    summary: job.summary?.trim() || null,
    url: job.url,
    applyUrl: job.applyUrl,
    salary: job.salary,
    location: job.location,
    remoteType: job.remoteType,
    employmentType: job.employmentType,
    requirements: job.requirements,
    platform: job.source === "platform",
    source,
  };
}

/** What was read, when saving it failed. Everything the read did not carry is simply absent. */
export function fromParsed(parsed: ParsedJob, url: string | null, source: StartSource, unsavedReason: string): PickedJob {
  return {
    savedJobId: null,
    unsavedReason,
    company: parsed.company,
    role: parsed.role,
    description: parsed.jdText?.trim() || null,
    summary: null,
    url,
    applyUrl: null,
    salary: null,
    location: parsed.location ?? null,
    remoteType: null,
    employmentType: null,
    requirements: [],
    platform: false,
    source,
  };
}

/**
 * The link "Apply" opens: the form when the posting names one, else the posting
 * itself. Only ever http(s) — it goes straight into an href.
 */
export const applyLinkOf = (job: Pick<StartedJob, "applyUrl" | "url">): string | null => applicationUrl(job.applyUrl) ?? applicationUrl(job.url);

/** "jobs.lever.co", for a button label. */
export function hostOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./i, "");
  } catch {
    return "the posting";
  }
}
