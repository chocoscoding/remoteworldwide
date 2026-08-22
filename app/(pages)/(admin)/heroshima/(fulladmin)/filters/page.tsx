import FiltersClient from "./Client";
import { getFilters } from "@/libs/query";

export default async function CategoriesPage() {
  const { data } = await getFilters();
  return (
    <>
      <FiltersClient initialData={data} />
    </>
  );
}
