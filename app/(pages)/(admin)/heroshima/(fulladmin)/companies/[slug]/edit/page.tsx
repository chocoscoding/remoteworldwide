import NotFound from "@/app/components/NotFound";
import EditCompanyClient from "./Client";
import type { Company } from "@/types/main";
import { backendOrNull } from "@/app/lib/backend";

const fetchCompany = async (slug: string): Promise<Company | null> => {
  try {
    return await backendOrNull<Company>(`/companies/${encodeURIComponent(slug)}`);
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
