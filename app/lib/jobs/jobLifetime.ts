import type { JobLifecycle } from "@/types/jobMetadata";

export const JOB_LIFETIME_DAYS = 56;
const LIFETIME_MS = JOB_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
type LifetimeJob = { isActive?: boolean; createdAt: Date | string; lifecycle?: JobLifecycle };

/** A legacy listing's fallback. A known employer deadline can only shorten its life. */
export function jobExpiresAt(postedAt: Date | string, employerExpiresAt?: Date | string | null): Date {
  const maximum = new Date(postedAt).getTime() + LIFETIME_MS;
  const employer = employerExpiresAt ? new Date(employerExpiresAt).getTime() : NaN;
  return new Date(Number.isFinite(employer) ? Math.min(maximum, employer) : maximum);
}
export function isJobExpired(createdAt: Date | string, now = Date.now()): boolean {
  return !(jobExpiresAt(createdAt).getTime() > now);
}
export function effectiveExpiry(job: Pick<LifetimeJob, "createdAt" | "lifecycle">): Date {
  return job.lifecycle ? new Date(job.lifecycle.expiresAt) : jobExpiresAt(job.createdAt);
}
export function isJobLive(job: LifetimeJob, now = Date.now()): boolean {
  if (job.isActive === false) return false;
  if (job.lifecycle && job.lifecycle.status !== "open") return false;
  return effectiveExpiry(job).getTime() > now;
}
export function isJobIndexable(job: LifetimeJob, now = Date.now()): boolean {
  return isJobLive(job, now) || (job.isActive !== false && job.lifecycle?.status !== "unpublished" && job.lifecycle?.archiveIndexable === true);
}
export function expiredJobMessage(job: LifetimeJob): string {
  if (job.lifecycle?.status === "closed") return "The employer has closed this role. This page is kept as an archive.";
  if (job.lifecycle?.status === "unpublished" || job.isActive === false) return "This listing is no longer published on Remote Worldwide.";
  const expires = effectiveExpiry(job);
  const date = Number.isNaN(expires.getTime()) ? "" : ` on ${expires.toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}`;
  return `This listing expired on Remote Worldwide${date}. The employer's current hiring status has not been confirmed.`;
}
export function liveJobsSince(now = Date.now()): Date { return new Date(now - LIFETIME_MS); }
