import type { Author } from "@/app/lib/blog/types";
import type { PublicJobFacts, JobLifecycle, CompanyHiringProfile } from "./jobMetadata";
export type { PublicJobFacts, JobLifecycle, CompanyHiringProfile, SalaryBand } from "./jobMetadata";

// The job board's listing and company, as the backend sends them (remoteworldwidebackend
// src/types/board.ts, BoardJob and BoardCompany): change one, change the other. The dates arrive
// as ISO strings and app/lib/api/core.ts revives them into Dates.
export interface Job {
  facts?: PublicJobFacts | null;
  lifecycle?: JobLifecycle;
  id: string;
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  companyId: string;
  applicationUrl: string;
  category: string;
  region: string[];
  seniority: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  sponsorshipHistory?: {periodStart:string;periodEnd:string;certifiedCases:number;medianWage:number|null;topTitles:string[];lastFilingDate:string|null;sourceUrl:string;sourceUrls?:string[];matchStatus:"reviewed"|"unreviewed";updatedAt:string;wageCurrency:"USD";wagePeriod:"year";wageSampleCount?:number;wageBasis?:string} | null;
  hiringProfile?: CompanyHiringProfile | null;
  hiringRegions?: string[];
  openJobsCount?: number;
  similarCompanies?: CompanyList[];
  id: string;
  name: string;
  slug: string;
  about: string;
  logo: string;
  website: string;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** How a listing is doing, on the admin's job page. */
export interface JobStats {
  applyClicks: number;
  lastApplyClickAt: string | null;
  impressions: number;
  lastImpressionAt: string | null;
}

export interface AdminJobPage extends JobAndCompany {
  factsDraft?: PublicJobFacts | null;
  enrichment?: unknown;
  postedAt?: Date | string | null;
  employerExpiresAt?: Date | string | null;
  closedAt?: Date | string | null;
  closureReason?: string | null;
  archiveIndexable?: boolean | null;
  stats: JobStats;
}

export interface FilterData {
  category: FilterType[];
  seniority: FilterType[];
  region: FilterType[];
}

export interface FilterType {
  value: string;
  label: string;
}
export interface Option {
  value: string;
  label: string;
  href?: string;
}

export interface FilterData2 {
  companies: Option[];
  sectors: Option[];
  roleTypes: Option[];
  regions: Option[];
}

export interface CompanyList extends Pick<Company, "slug" | "name" | "about" | "logo"> {
  _count: {
    jobs: number;
  };
}

export interface CompanyWithJobs extends Company {
  jobs: Jobs[];
}
export interface JobAndCompany extends Job {
  company: Company;
}
export interface CompanyWithJobsCount extends Company {
  _count?: {
    jobs: number;
  };
}
export interface JobAndCompanyWithCount extends Job {
  company: CompanyWithJobsCount;
}

export interface FormValues {
  title: string;
  company: Option | null;
  link: string;
  category: Option | null;
  region: Option[];
  seniority: Option | null;
  body: string;
}

export interface WithPaginationProps {
  jobs: Job[];
  currentPage: number;
  totalJobs: number;
  totalPages: number;
  startJobIndex: number;
  endJobIndex: number;
  handlePrevious: () => void;
  handleNext: () => void;
  loading: boolean; // Added loading state
}

export interface FetchDataFunction<T> {
  (currentPage: number, jobsPerPage: number): Promise<{ jobs: T[]; total: number }>;
}

export interface JobTileType {
  facts?: PublicJobFacts | null;
  lifecycle?: JobLifecycle;
  title: string;
  id: string;
  company: {
    logo: string;
    name: string;
    slug: string;
  };
  slug: string;
  category: string;
  region: string[];
  seniority: string;
  createdAt: Date;
}
export interface OneJobListType {
  title: string;
  id: string;
  company: {
    logo: string;
    name: string;
    slug: string;
  };
  slug: string;
  category: string;
  region: string[];
  seniority: string;
  isActive: boolean;
  createdAt?: Date;
}

export type AuthorListChildType = {
  name: string;
  slug: string;
  about: string;
  id: string;
  profileImage: string;
  _count: {
    blogs: number;
  };
};

export type BlogSummaryForAuthorList = {
  title: string;
  createdAt: Date | string;
  slug: string;
  description: string;
};
export interface AuthorWithBlog extends Author {
  blogs: BlogSummaryForAuthorList[];
  _count?: {
    blogs: number;
  };
}

export type FormStateAuthor_Client = {
  userId: string;
  website: string;
  twitter: string;
  linkedin: string;
  instagram: string;
  name: string;
  about: string;
  profileImage: string;
};


export interface OneBookmarkType {
  job: {
    region: string[];
    seniority: string;
    company: {
      name: string;
      logo: string;
    };
    category: string;
    id: string;
    slug: string;
    title: string;
  };
}
