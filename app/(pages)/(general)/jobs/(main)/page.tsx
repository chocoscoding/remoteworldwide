import { FilterProvider } from "@/provider/FilterProvider";
import Client from "../Client";

import { Suspense } from "react";
import { getFilters } from "@/libs/query";
import { showsAds } from "@/app/lib/ads";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [{ data: filters }, ads] = await Promise.all([getFilters(), showsAds()]);

  return (
    <main className="p-3 md:p-6 w-full max-w-[1300px] m-auto min-h-screen">
      <h2 className="text-2xl md:text-3xl font-bold text-center">Explore latest and exiciting jobs now</h2>
      <br />
      <Suspense>
        <FilterProvider filterData={filters}>
          <Client showAds={ads} />
        </FilterProvider>
      </Suspense>
    </main>
  );
}
