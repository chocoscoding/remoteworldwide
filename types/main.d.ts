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
