import CompaniesList from "@/app/(pages)/(general)/companies/Client";
import { CompanyList } from "@/types/main";
import { backendWithCount } from "@/app/lib/backend";

// Behind the admin's session, read fresh on every visit: never prerendered at build time.
export const dynamic = "force-dynamic";

const getCompanies = async (): Promise<{ data: CompanyList[]; count: number }> => {
  try {
    return await backendWithCount<CompanyList[]>("/companies");
  } catch (error) {
    console.error("Error fetching companies:", error);
    return { data: [], count: 0 };
  }
};

export default async function Home() {
  const companies = await getCompanies();
  return (
    <>
      <CompaniesList forCompany={true} initialData={companies.data} totalCompanies={companies.count} />
    </>
  );
}
