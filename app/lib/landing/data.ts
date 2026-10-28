import { cache } from "react";
import { backendWithCount } from "@/app/lib/backend";
import type { BoardJobItem } from "@/app/lib/jobs/searchJobs";
import type { CompanyList } from "@/types/main";
import { landingApiPath, MIN_INDEXABLE, type CompanyLanding, type JobLanding, type Landing } from "./catalogue";

// One page of a landing's list, from the backend. cache() lets generateMetadata (which needs the
// count to decide noindex) and the page share one read per request. A failed read is null: the page
// then says so and is noindexed, rather than an empty list being indexed as the real answer.

export const PER_PAGE = 50;

export type LandingPage<T> = { data: T[]; count: number } | null;

export const landingJobs = cache(async (landing: JobLanding, page: number): Promise<LandingPage<BoardJobItem>> => {
  try {
    return await backendWithCount<BoardJobItem[]>(landingApiPath(landing, page));
  } catch {
    return null;
  }
});

export const landingCompanies = cache(async (landing: CompanyLanding, page: number): Promise<LandingPage<CompanyList>> => {
  try {
    return await backendWithCount<CompanyList[]>(landingApiPath(landing, page));
  } catch {
    return null;
  }
});

export const totalPages = (count: number) => Math.max(1, Math.ceil(count / PER_PAGE));

/** Whether a page of a live landing is worth indexing: the read worked and the list is not thin. */
export const indexable = (result: LandingPage<unknown>) => Boolean(result && result.count >= MIN_INDEXABLE);

/** The sitemap's check: the live landings whose list is long enough to index. */
export async function indexableLandings(landings: Landing[]): Promise<Landing[]> {
  const checked = await Promise.all(
    landings.map(async (landing) => {
      const first = landing.kind === "jobs" ? await landingJobs(landing, 1) : await landingCompanies(landing, 1);
      return indexable(first) ? landing : null;
    }),
  );
  return checked.filter((landing): landing is Landing => landing !== null);
}
