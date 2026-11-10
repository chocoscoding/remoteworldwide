import type { JobLifecycle } from "@/types/jobMetadata";

/** Three months (owner, 2026-11-09; was 56 days). Mirrors the backend: src/helpers/jobMetadata.ts. */
export const JOB_LIFETIME_DAYS = 90;
const LIFETIME_MS = JOB_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
type LifetimeJob = { isActive?: boolean; createdAt: Date | string; lifecycle?: JobLifecycle; archiveIndexable?: boolean | null };

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
/** Live, or expired/closed and not marked "Don't index" by an admin: about half of expired roles are
 * still open, hiring takes longer than our lifetime (owner, 2026-11-06). The backend's lifecycle
 * decides; a listing that ran out after the backend read it (lifecycle still "open") uses the raw mark. */
export function isJobIndexable(job: LifetimeJob, now = Date.now()): boolean {
  if (isJobLive(job, now)) return true;
  if (job.isActive === false) return false;
  if (job.lifecycle && job.lifecycle.status !== "open") return job.lifecycle.status !== "unpublished" && job.lifecycle.archiveIndexable;
  return job.archiveIndexable !== false;
}
/** Live, or expired but neither closed by the employer nor unpublished: the apply link stays, since many
 * expired roles are still hiring (owner, 2026-11-06). The expired notice says the status is unconfirmed. */
export function canStillApply(job: LifetimeJob, now = Date.now()): boolean {
  if (isJobLive(job, now)) return true;
  if (job.isActive === false) return false;
  return !job.lifecycle || job.lifecycle.status === "expired" || job.lifecycle.status === "open";
}
export function expiredJobMessage(job: LifetimeJob): string {
  if (job.lifecycle?.status === "closed") return "The employer has closed this role. This page is kept as an archive.";
  if (job.lifecycle?.status === "unpublished" || job.isActive === false) return "This listing is no longer published on Remote Worldwide.";
  const expires = effectiveExpiry(job);
  const date = Number.isNaN(expires.getTime()) ? "" : ` on ${expires.toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}`;
  return `This listing expired on Remote Worldwide${date}. The employer's current hiring status has not been confirmed.`;
}
export function liveJobsSince(now = Date.now()): Date { return new Date(now - LIFETIME_MS); }
