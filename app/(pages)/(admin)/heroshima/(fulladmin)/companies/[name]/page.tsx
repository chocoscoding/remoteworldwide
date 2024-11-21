import NotFound from "@/app/components/NotFound";
import { Company } from "@prisma/client";
import CompanyClient from "./Client";

const fetchCompany = async (name: string): Promise<Company | null> => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/companies/${name}`, { cache: "no-cache" });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Failed to fetch company:", error);
    return null;
  }
};
export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const companyId = decodeURIComponent((await params).name);
  const companyData = await fetchCompany(companyId);
  if (!companyData) return <NotFound buttonType="link" title="Company" link="/heroshima/companies/create" />;
  return <CompanyClient companyData={companyData} />;
}
