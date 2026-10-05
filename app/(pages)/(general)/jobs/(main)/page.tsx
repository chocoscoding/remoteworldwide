import { FilterProvider } from "@/provider/FilterProvider";
import Client from "../Client";

import { Suspense } from "react";
import { getFilters } from "@/libs/query";
import { showsAds } from "@/app/lib/ads";
import type { Metadata } from "next";
import { absoluteUrl } from "@/app/lib/seo";

export const dynamic = "force-dynamic";

// "Jobs" leads the title so Google's sitelink for this page reads "Jobs". The canonical
// folds every filtered or paged variant (?roles=…, ?page=…) back into /jobs.
const TITLE = "Jobs – Remote jobs open worldwide | Remote Worldwide";
const DESCRIPTION =
  "Browse vetted remote jobs you can do from anywhere: engineering, design, marketing, sales and more. Filter by role, seniority and region, and apply in minutes.";

export const metadata: Metadata = {
  // Already carries the site name, so it skips the root template rather than doubling it.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/jobs" },
  openGraph: { type: "website", url: absoluteUrl("/jobs"), title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
};

export default async function CategoriesPage() {
  const [{ data: filters }, ads] = await Promise.all([getFilters(), showsAds()]);

  return (
    <main className="p-3 md:p-6 w-full max-w-[1300px] m-auto min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-center">Explore latest and exciting jobs now</h1>
      <br />
      <Suspense>
        <FilterProvider filterData={filters}>
          <Client showAds={ads} />
        </FilterProvider>
      </Suspense>
    </main>
  );
}
