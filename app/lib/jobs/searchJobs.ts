import { backendWithCount } from "@/app/lib/backend";
import type { JobAndCompany } from "@/types/main";
export const JOBS_PER_PAGE = 50;
export const PARAMS = [
  "page",
  "roles",
  "regions",
  "seniority",
  "search",
  "dateFrom",
  "dateTo",
  "roleCategory",
  "countries",
  "employmentType",
  "visaSponsorship",
  "visaType",
  "salaryMin",
  "salaryCurrency",
  "salaryPeriod",
  "worldwide",
  "status",
] as const;
export type BoardJobItem = Pick<
  JobAndCompany,
  | "id"
  | "slug"
  | "title"
  | "isActive"
  | "applicationUrl"
  | "createdAt"
  | "updatedAt"
  | "category"
  | "region"
  | "seniority"
> &
  Pick<Partial<JobAndCompany>, "facts" | "lifecycle"> & {
    company: { name: string; logo: string; slug: string };
  };
export async function searchJobs(searchParams: URLSearchParams) {
  const query = new URLSearchParams();
  for (const key of PARAMS) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }
  return backendWithCount<BoardJobItem[]>(
    `/jobs${query.size ? `?${query}` : ""}`,
  );
}
