import FiltersClient from "./Client";
import { FilterData } from "@/types/main";

const getFilters: () => Promise<FilterData> = async () => {
  const res = await fetch(process.env.NEXT_PUBLIC_URL + "/api/filters", { cache: "no-cache" });
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
};

export default async function CategoriesPage() {
  const data = await getFilters();
  return (
    <>
      <FiltersClient initialData={data} />
    </>
  );
}
