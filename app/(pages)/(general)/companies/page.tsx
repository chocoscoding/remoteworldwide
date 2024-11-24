import CompaniesList from "./Client";
import { CompanyList } from "@/types/main";

const getCompanies = async (): Promise<{ data: CompanyList[]; count: number }> => {
  try {
    const response = await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/companies", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Failed to fetch companies");
    }
    const companies = await response.json();
    return companies;
  } catch (error) {
    console.error("Error fetching companies:", error);
    return { data: [], count: 0 };
  }
};

export default async function Home() {
  const companies = await getCompanies();
  return (
    <>
      <CompaniesList initialData={companies.data} totalCompanies={companies.count} />
    </>
  );
}
