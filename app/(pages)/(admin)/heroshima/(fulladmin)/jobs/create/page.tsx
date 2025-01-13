import { prisma } from "@/prisma";
import CreateJob from "./Client";
import { FilterData, FilterType } from "@/types/main";
const getAllFilters = async (): Promise<FilterData> => {
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/filters", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("error");
    }
    const data: Promise<{ data: FilterData }> = await res.json();
    return (await data).data;
  } catch (error) {
    throw new Error("Failed to fetch filters.");
  }
};

const getAllCompanies = async () => {
  try {
    const companies = (await prisma.company.aggregateRaw({
      pipeline: [
        {
          $project: {
            _id: { $toString: "$_id" }, // Selects the `_id` field
            name: 1, // Selects the `name` field
          },
        },
        {
          $project: {
            value: "$_id", // Maps `_id` to `value`
            label: "$name", // Maps `name` to `label`
          },
        },
      ],
    })) as unknown as FilterType[];
    return companies;
  } catch (error) {
    throw new Error("Failed to fetch companies.");
  }
};
const Page = async () => {
  const allCompanies = await getAllCompanies();
  const filters = await getAllFilters();

  return (
    <>
      <CreateJob allCompanies={allCompanies} filters={filters} key={"createJobPage"} />
    </>
  );
};

export default Page;
