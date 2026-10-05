// How long a posting counts as open. The job page's "This job has expired" banner,
// its JobPosting markup (validThrough), its robots tag and the sitemap all read
// this one rule, so Google never sees a page that says "expired" while the markup
// says "open" (Google's job guidelines treat that as a violation).

export const JOB_LIFETIME_DAYS = 31;
const LIFETIME_MS = JOB_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

/** When a posting stops counting as open: its last edit plus the lifetime. */
export function jobExpiresAt(updatedAt: Date | string): Date {
  return new Date(new Date(updatedAt).getTime() + LIFETIME_MS);
}

export function isJobExpired(updatedAt: Date | string, now = Date.now()): boolean {
  return jobExpiresAt(updatedAt).getTime() < now;
}

/** Published and not past its lifetime: the only jobs search engines should index. */
export function isJobLive(job: { isActive: boolean; updatedAt: Date | string }, now = Date.now()): boolean {
  return job.isActive && !isJobExpired(job.updatedAt, now);
}

/** The oldest `updatedAt` a live job can have right now, for database filters. */
export function liveJobsSince(now = Date.now()): Date {
  return new Date(now - LIFETIME_MS);
}
