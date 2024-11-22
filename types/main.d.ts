import { Author, Blog, Company } from "@prisma/client";

export interface FilterData {
  job_type: FilterType[];
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

export interface CompanyList extends Pick<Company, "name" | "about" | "logo"> {
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
  region: Option | null;
  job_type: Option | null;
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

interface FetchDataFunction_2<T> {
  (currentPage: number, jobsPerPage: number): Promise<{ data: T[]; count: number }>;
}

interface OneJobListType {
  title: string;
  id: string;
  company: {
    logo: string;
    name: string;
  };
  slug: string;
  category: string;
  region: string;
  jobType: string;
  seniority: string;
  isActive: boolean;
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
  createdAt: string;
  slug: string;
  description: string;
};
export interface AuthorWithBlog extends Author {
  blogs: BlogSummaryForAuthorList[];
}

export type FormStateAuthor_Client = {
  website: string;
  twitter: string;
  linkedin: string;
  instagram: string;
  name: string;
  about: string;
  profileImage: string;
};

export interface BlogListWithAuthor extends Blog {
  author: {
    name: string;
    profileImage: string;
  };
}
