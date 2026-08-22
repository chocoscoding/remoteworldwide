import { FilterProvider } from "@/provider/FilterProvider";
import Client from "../Client";

import { Suspense } from "react";
import SearchBar from "@/app/components/SearchBar";
import { getFilters } from "@/libs/query";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { data: filters } = await getFilters();

  return (
    <main className="p-3 md:p-10 w-full max-w-[1100px] m-auto min-h-screen">
      <h2 className="text-2xl md:text-3xl font-bold text-center">Explore latest and exiciting jobs now</h2>
      <br />
      <Suspense>
        <div className="w-full max-w-[1500px] mb-20">
          <SearchBar activeSearch />
        </div>
        <FilterProvider filterData={filters}>
          <Client />
        </FilterProvider>
      </Suspense>
    </main>
  );
}
