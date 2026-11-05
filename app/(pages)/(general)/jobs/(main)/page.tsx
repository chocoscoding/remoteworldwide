import { FilterProvider } from "@/provider/FilterProvider";
import Client from "../Client";
import { cache, Suspense } from "react";
import { getFilters } from "@/libs/query";
import { showsAds } from "@/app/lib/ads";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/app/lib/seo";
import { searchJobs } from "@/app/lib/jobs/searchJobs";
import { pageParam } from "@/app/lib/landing/catalogue";
import type { InitialJobs } from "@/app/components/main/JobsContainerForSearch";
export const dynamic = "force-dynamic";
type Params = Record<string, string | string[] | undefined>;
const queryOf = (params: Params) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  return query.toString();
};
const firstJobs = cache(async (query: string): Promise<InitialJobs | undefined> => {
  try {
    const { data, count } = await searchJobs(new URLSearchParams(query));
    return { query, data, count };
  } catch {
    return undefined;
  }
});
const DESCRIPTION =
  "Browse current remote jobs worldwide. Filter by role, eligible country, salary, employment type and supported visa sponsorship.";
export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const params = await searchParams;
  const page = pageParam(params.page);
  if (page === null) notFound();
  const filtered = Object.keys(params).some((key) => key !== "page");
  const result = await firstJobs(queryOf(params));
  if (result && page > Math.max(1, Math.ceil(result.count / 50))) notFound();
  const path = page > 1 ? `/jobs?page=${page}` : "/jobs";
  const title =
    params.status === "archived"
      ? "Archived remote jobs | Remote Worldwide"
      : page > 1
        ? `Remote Jobs Worldwide, Page ${page} | Remote Worldwide`
        : `Remote Jobs Worldwide${result ? `: ${result.count.toLocaleString("en-US")} Open Roles` : ""} | Remote Worldwide`;
  return {
    title: { absolute: title },
    description: DESCRIPTION,
    alternates: { canonical: path },
    ...(filtered || !result ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "website",
      url: absoluteUrl(path),
      title,
      description: DESCRIPTION,
      images: [absoluteUrl("/api/og/job")],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: DESCRIPTION,
      images: [absoluteUrl("/api/og/job")],
    },
  };
}
export default async function JobsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams,
    page = pageParam(params.page);
  if (page === null) notFound();
  const [{ data: filters }, ads, initialJobs] = await Promise.all([getFilters(), showsAds(), firstJobs(queryOf(params))]);
  if (initialJobs && page > Math.max(1, Math.ceil(initialJobs.count / 50))) notFound();
  return (
    <main className="p-3 md:p-6 w-full max-w-[1300px] m-auto min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-center">
        {params.status === "archived" ? "Archived remote jobs" : "Remote jobs worldwide"}
        {page > 1 ? `, page ${page}` : ""}
      </h1>
      <br />
      <Suspense>
        <FilterProvider filterData={filters}>
          <Client showAds={ads} initialJobs={initialJobs} />
        </FilterProvider>
      </Suspense>
    </main>
  );
}
