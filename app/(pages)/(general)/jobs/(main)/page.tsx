import { FilterProvider } from "@/provider/FilterProvider";
import Client from "../Client";

import { Suspense } from "react";
import { getFilters } from "@/libs/query";
import { showsAds } from "@/app/lib/ads";
import type { Metadata } from "next";
import { absoluteUrl } from "@/app/lib/seo";
import { searchJobs } from "@/app/lib/jobs/searchJobs";
import type { InitialJobs } from "@/app/components/main/JobsContainerForSearch";

export const dynamic = "force-dynamic";

// "Jobs" leads the title so Google's sitelink for this page reads "Jobs". The canonical
// folds every filtered or paged variant (?roles=…, ?page=…) back into /jobs.
const TITLE = "Jobs – Remote jobs open worldwide | Remote Worldwide";
const DESCRIPTION =
  "Browse vetted remote jobs you can do from anywhere: engineering, design, marketing, sales and more. Filter by role, seniority and region, and apply in minutes.";

// A plain page of the board (?page=3 and nothing else) is its own page, so its canonical is
// itself and Google follows the job links on it: folding every page into /jobs hid all but the
// first 50 jobs. Filtered and searched views still fold into /jobs.
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  const keys = Object.keys(params);
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const ownPage = keys.length === 1 && keys[0] === "page" && Number.isInteger(page) && page > 1;
  const path = ownPage ? `/jobs?page=${page}` : "/jobs";
  const title = ownPage ? `Jobs, page ${page} – Remote jobs open worldwide | Remote Worldwide` : TITLE;
  return {
    // Already carries the site name, so it skips the root template rather than doubling it.
    title: { absolute: title },
    description: DESCRIPTION,
    alternates: { canonical: path },
    openGraph: { type: "website", url: absoluteUrl(path), title, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
  };
}

/** The first page of results for this URL, queried here so the HTML carries the job links. Undefined on a failure: the list then fetches as before. */
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

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ data: filters }, ads, initialJobs] = await Promise.all([getFilters(), showsAds(), searchParams.then(firstJobs)]);

  return (
    <main className="p-3 md:p-6 w-full max-w-[1300px] m-auto min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-center">Remote jobs you can do from anywhere</h1>
      <br />
      <Suspense>
        <FilterProvider filterData={filters}>
          <Client showAds={ads} initialJobs={initialJobs} />
        </FilterProvider>
      </Suspense>
    </main>
  );
}
