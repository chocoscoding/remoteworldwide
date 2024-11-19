import { Company } from "@prisma/client";
import CompaniesList from "./Client";

const getCompanies = async (): Promise<Company[]> => {
  try {
    const response = await fetch(process.env.NEXT_PUBLIC_URL + "/api/companies");
    if (!response.ok) {
      throw new Error("Failed to fetch companies");
    }
    const companies = await response.json();
    return companies.data;
  } catch (error) {
    console.error("Error fetching companies:", error);
    return [];
  }
};

export default async function Home() {
  const companies = await getCompanies();
  return (
    <>
      <CompaniesList initialData={companies} />
    </>
  );
}
