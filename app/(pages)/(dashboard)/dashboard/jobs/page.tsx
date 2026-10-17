import { Suspense } from "react";
import { FilterProvider } from "@/provider/FilterProvider";
import { getFilters } from "@/libs/query";
import { searchJobs } from "@/app/lib/jobs/searchJobs";
import type { InitialJobs } from "@/app/components/main/JobsContainerForSearch";
import DashboardJobsClient from "./Client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs", robots: { index: false, follow: false } };

/** The first page of results for this URL, as the public /jobs board does. Undefined on a failure: the list then fetches. */
async function firstJobs(params: Record<string, string | string[] | undefined>): Promise<InitialJobs | undefined> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  }
  try {
    const { data, count } = await searchJobs(query);
    return { query: query.toString(), data, count };
  } catch {
    return undefined;
  }
}

// The job board inside the dashboard. Auth is gated in ../layout.tsx. The public /jobs board
// is untouched; this one keeps search, filters and paging on /dashboard/jobs and opens each
// job at /dashboard/jobs/[id].
export default async function DashboardJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ data: filters }, initialJobs] = await Promise.all([getFilters(), searchParams.then(firstJobs)]);

  return (
    <Suspense>
      <FilterProvider filterData={filters}>
        <DashboardJobsClient initialJobs={initialJobs} />
      </FilterProvider>
    </Suspense>
  );
}
