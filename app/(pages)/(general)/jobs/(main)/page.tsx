import { FilterProvider } from "@/provider/FilterProvider";
import Client from "../Client";

import { FilterData } from "@/types/main";
import { Suspense } from "react";
import SearchBar from "@/app/components/SearchBar";

const getFilters: () => Promise<FilterData> = async () => {
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/filters", { cache: "no-cache" });
    if (!res.ok) {
      return {
        job_type: [],
        category: [],
        seniority: [],
        region: [],
      } as FilterData;
    }
    const data: Promise<{ data: FilterData }> = await res.json();
    return (await data).data;
  } catch (error) {
    throw new Error("Something went wrong");
  }
};

export default async function CategoriesPage() {
  const filters = await getFilters();

  return (
    <main className="p-3 md:p-10 w-full max-w-[1100px] m-auto">
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
