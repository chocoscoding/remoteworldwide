import { FilterProvider } from "@/provider/FilterProvider";
import Client from "../Client";

import { FilterData } from "@/types/main";
import { Suspense } from "react";

const getFilters: () => Promise<FilterData> = async () => {
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_URL + "/api/filters");
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
    <Suspense>
      <FilterProvider filterData={filters}>
        <Client />
      </FilterProvider>
    </Suspense>
  );
}
