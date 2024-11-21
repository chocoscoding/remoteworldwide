import { Company } from "@prisma/client";

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

interface FetchDataFunction {
  (currentPage: number, jobsPerPage: number): Promise<{ jobs: Job[]; total: number }>;
}

interface OneJobListType {
  title: string;
  company: {
    logo: string;
    name: string;
  };
  slug: string;
  category: string;
  region: string;
  jobType: string;
  seniority: string;
}
