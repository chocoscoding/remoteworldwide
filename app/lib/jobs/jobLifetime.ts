// How long a posting counts as open: a month and a half from the day it was posted (owner,
// 2026-10-07). The job page's "This job has expired" banner, its JobPosting markup
// (validThrough), its robots tag and the sitemap all read this one rule, so Google never sees a
// page that says "expired" while the markup says "open" (Google's job guidelines treat that as a
// violation). Counted from createdAt, not updatedAt: an edit doesn't make a posting new again.

export const JOB_LIFETIME_DAYS = 45;
const LIFETIME_MS = JOB_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

/** When a posting stops counting as open: the day it was posted plus the lifetime. */
export function jobExpiresAt(createdAt: Date | string): Date {
  return new Date(new Date(createdAt).getTime() + LIFETIME_MS);
}

export function isJobExpired(createdAt: Date | string, now = Date.now()): boolean {
  return jobExpiresAt(createdAt).getTime() < now;
}

/** Published and not past its lifetime: the only jobs search engines should index. */
export function isJobLive(job: { isActive: boolean; createdAt: Date | string }, now = Date.now()): boolean {
  return job.isActive && !isJobExpired(job.createdAt, now);
}

/** The oldest `createdAt` a live job can have right now, for database filters. */
export function liveJobsSince(now = Date.now()): Date {
  return new Date(now - LIFETIME_MS);
}
