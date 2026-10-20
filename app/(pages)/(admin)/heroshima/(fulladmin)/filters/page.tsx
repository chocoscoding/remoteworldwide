import FiltersClient from "./Client";
import { getFilters } from "@/libs/query";

// Behind the admin's session, read fresh on every visit: never prerendered at build time.
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { data } = await getFilters();
  return (
    <>
      <FiltersClient initialData={data} />
    </>
  );
}
