import NotFound from "@/app/components/NotFound";
import EditCompanyClient from "./Client";
import { Company } from "@prisma/client";

const fetchCompany = async (slug: string): Promise<Company | null> => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/companies/${slug}`, { cache: "reload" });
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
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const companySlug = decodeURIComponent((await params).slug);
  const companyData = await fetchCompany(companySlug);
  if (!companyData) return <NotFound buttonType="link" title="Company" link="/hesroshima/companies/create" />;
  return <EditCompanyClient companyData={companyData} />;
}
