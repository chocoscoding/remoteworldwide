import FiltersClient from "./Client";
import { FilterData } from "@/types/main";

const getFilters: () => Promise<FilterData> = async () => {
  const res = await fetch("http://localhost:3000/api/filters");
  if (!res.ok) {
    return {
      jobTypes: [],
      categories: [],
      seniorities: [],
      regions: [],
    } as FilterData;
  }
  const data: Promise<{ data: FilterData }> = await res.json();
  return (await data).data;
};

export default async function CategoriesPage() {
  const data = await getFilters();
  return (
    <div>
      <FiltersClient initialData={data} />
    </div>
  );
}
