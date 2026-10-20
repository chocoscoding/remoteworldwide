import type { Author } from "@/app/lib/blog/types";

// The job board's listing and company, as the backend sends them (remoteworldwidebackend
// src/types/board.ts, BoardJob and BoardCompany): change one, change the other. The dates arrive
// as ISO strings and app/lib/api/core.ts revives them into Dates.
export interface Job {
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

interface FormValues {
  title: string;
  company: Option | null;
  link: string;
  category: Option | null;
  region: Option[];
  seniority: Option | null;
  body: string;
}

interface WithPaginationProps {
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

interface FetchDataFunction<T> {
  (currentPage: number, jobsPerPage: number): Promise<{ jobs: T[]; total: number }>;
}

export interface JobTileType {
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
interface OneJobListType {
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
