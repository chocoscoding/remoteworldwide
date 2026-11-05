/** Public facts are reviewed facts, never an unreviewed extraction result. */
export type SalaryBand = { min: number | null; max: number | null; currency: string | null; period: "hour" | "day" | "week" | "month" | "year" | null; kind: "base" | "total" | "ote" | "unspecified"; conditions: string | null };
export interface PublicJobFacts {
  salaryBands: SalaryBand[];
  visaSponsorship: "yes" | "no" | "unknown";
  visaTypes: string[];
  sponsorshipConditions: string | null;
  countries: string[];
  regions: string[];
  worldwideEligible: boolean | null;
  workLocation: string | null;
  timezoneOverlap: string | null;
  roleCategory: string | null;
  seniority: string | null;
  employmentType: string | null;
  contractModel: string | null;
  remotePolicy: string | null;
  relocationSupport: boolean | null;
  relocationConditions: string | null;
  languages: string[];
  benefits: string[];
  skills: string[];
  education: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  requiredQualifications: string[];
  preferredQualifications: string[];
}
export interface JobLifecycle {
  status: "open" | "expired" | "closed" | "unpublished";
  postedAt: string;
  expiresAt: string;
  closedAt: string | null;
  closureReason: string | null;
  archiveIndexable: boolean;
}
export interface CompanyHiringProfile {
  careersUrl: string | null;
  hqCountry: string | null;
  industry: string | null;
  size: string | null;
  remotePolicy: string | null;
  hiringAbout: string | null;
  benefits: string[];
  techStack: string[];
  sourceUrls: string[];
  verifiedAt: string | null;
}
