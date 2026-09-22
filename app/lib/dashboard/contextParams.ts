// A job carried from one dashboard screen to the next in the URL, so the screen
// it lands on knows what it was opened for and can offer the way back. The
// company and role are labels for copy only; the saved job id is the one thing
// a screen acts on, and it is read back from saved jobs rather than trusted.

export const JOB_CONTEXT_SOURCES = ["jdqa"] as const;
export type JobContextSource = (typeof JOB_CONTEXT_SOURCES)[number];

export interface JobContext {
  savedJobId: string | null;
  company: string | null;
  role: string | null;
  from: JobContextSource | null;
}

export interface JobContextFields {
  savedJobId?: string | null;
  company?: string | null;
  role?: string | null;
}

const MAX_LABEL_CHARS = 160;

function withParams(path: string, entries: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    const trimmed = value?.trim();
    if (trimmed) params.set(key, trimmed);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

const label = (value: string | null): string | null => value?.trim().slice(0, MAX_LABEL_CHARS) || null;

const isSource = (value: string | null): value is JobContextSource =>
  value !== null && (JOB_CONTEXT_SOURCES as readonly string[]).includes(value);

export const tailorResumeHref = (job: JobContextFields, from: JobContextSource): string =>
  withParams("/dashboard/resume", { tailor: job.savedJobId, company: job.company, role: job.role, from });

export const findReferralHref = (job: JobContextFields, from: JobContextSource): string =>
  withParams("/dashboard/referrals", { savedJobId: job.savedJobId, company: job.company, role: job.role, from });

// The screens that only need the job chosen for them name it `job`, as the job screen itself does.
export const coverLetterHref = (job: JobContextFields, from: JobContextSource): string =>
  withParams("/dashboard/cover", { job: job.savedJobId, company: job.company, role: job.role, from });

export const atsScoreHref = (job: JobContextFields, from: JobContextSource): string =>
  withParams("/dashboard/ats", { job: job.savedJobId, company: job.company, role: job.role, from });

export const coachHref = (job: JobContextFields, from: JobContextSource): string =>
  withParams("/dashboard/coach", { job: job.savedJobId, company: job.company, role: job.role, from });

/**
 * `idParam` is the name the target screen gives the saved job id: `tailor` on the resume screen, `savedJobId` on
 * referrals, `job` on the cover letter, ATS and coach screens.
 */
export function readJobContext(params: { get(name: string): string | null }, idParam: "tailor" | "savedJobId" | "job"): JobContext {
  const from = params.get("from");
  return {
    savedJobId: params.get(idParam)?.trim() || null,
    company: label(params.get("company")),
    role: label(params.get("role")),
    from: isSource(from) ? from : null,
  };
}

/** Where "Back to the job" goes, or null when the context did not come from a job screen. */
export function backToJobHref(context: Pick<JobContext, "savedJobId" | "from">): string | null {
  if (context.from !== "jdqa") return null;
  return withParams("/dashboard/jdqa", { job: context.savedJobId });
}
