import CreateJob from "./Client";
import { FilterData } from "@/types/main";
import { backend } from "@/app/lib/backend";
import { getCompanyOptions } from "@/libs/query";

// Every company and filter for the form's dropdowns, from the backend, fresh on every visit.
const getAllFilters = async (): Promise<FilterData> => {
  try {
    return await backend<FilterData>("/filters");
  } catch (error) {
    throw new Error("Failed to fetch filters.");
  }
};

const getAllCompanies = async () => {
  try {
    return await getCompanyOptions();
  } catch (error) {
    throw new Error("Failed to fetch companies.");
  }
};
const Page = async () => {
  const [allCompanies, filters] = await Promise.all([getAllCompanies(), getAllFilters()]);

  return (
    <>
      <CreateJob allCompanies={allCompanies} filters={filters} key={"createJobPage"} />
    </>
  );
};

export default Page;
