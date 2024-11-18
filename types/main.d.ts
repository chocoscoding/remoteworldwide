export interface FilterData {
  jobTypes: FilterType[];
  categories: FilterType[];
  seniorities: FilterType[];
  regions: FilterType[];
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
