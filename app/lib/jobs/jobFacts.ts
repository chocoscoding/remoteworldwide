import type { PublicJobFacts } from "@/types/jobMetadata";

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "TEMPORARY" | "INTERN";
export type SalaryPeriod = "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
export type Salary = { min: number | null; max: number | null; currency: string; period: SalaryPeriod };
export type JobFacts = { employmentType: EmploymentType | null; salary: Salary | null };
const employment: Record<string, EmploymentType> = {"full-time":"FULL_TIME","part-time":"PART_TIME",contract:"CONTRACTOR",freelance:"CONTRACTOR",temporary:"TEMPORARY",internship:"INTERN"};

/** Rendering never re-scrapes an employer. Use reviewed database facts; an employment type we could not
 * work out is FULL_TIME (owner, 2026-11-09), the same as the page's chip (publicJobFacts.ts). */
export async function jobFacts(job: { facts?: PublicJobFacts | null }): Promise<JobFacts> {
  const facts = job.facts;
  if (!facts) return {employmentType:"FULL_TIME",salary:null};
  // Multiple/location-dependent bands cannot be represented as one unqualified base salary.
  const bands = facts.salaryBands.filter(b => b.kind === "base");
  const band = bands.length === 1 && !bands[0].conditions ? bands[0] : null;
  return {
    employmentType: (facts.employmentType ? employment[facts.employmentType] : undefined) ?? "FULL_TIME",
    salary: band?.currency && band.period && (band.min !== null || band.max !== null)
      ? {min:band.min,max:band.max,currency:band.currency,period:band.period.toUpperCase() as SalaryPeriod} : null,
  };
}
