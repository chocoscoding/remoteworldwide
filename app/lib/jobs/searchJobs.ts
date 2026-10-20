import { backendWithCount } from "@/app/lib/backend";
import type { JobAndCompany } from "@/types/main";

// The job board's search, for the /jobs page's first paint on the server, so the list (and
// every job link) is in the HTML that crawlers read instead of arriving only after the
// browser's fetch. The browser's later searches go to the same backend route, GET /api/jobs
// (remoteworldwidebackend src/services/jobBoardService.ts), through the site's rewrite.

export const JOBS_PER_PAGE = 50;

/** The search's own parameters; anything else on the page's URL stays here. */
const PARAMS = ["page", "roles", "regions", "seniority", "search", "dateFrom", "dateTo"] as const;

export type BoardJobItem = Pick<JobAndCompany, "id" | "slug" | "title" | "isActive" | "applicationUrl" | "createdAt" | "updatedAt" | "category" | "region" | "seniority"> & {
  company: { name: string; logo: string; slug: string };
};

export async function searchJobs(searchParams: URLSearchParams) {
  const query = new URLSearchParams();
  for (const key of PARAMS) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return backendWithCount<BoardJobItem[]>(`/jobs${qs ? `?${qs}` : ""}`);
}
