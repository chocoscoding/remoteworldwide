import NotFound from "@/app/components/NotFound";
import CompanyClient from "./Client";
import { findCompany, findCompanyJobs } from "@/libs/query";
import { revalidatePath } from "next/cache";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  revalidatePath("./");
  const companySlug = decodeURIComponent((await params).slug);
  const companyData = await findCompany(companySlug);
  if (!companyData) return <NotFound buttonType="link" title="Company" link="/heroshima/companies/create" />;
  const companyJobs = await findCompanyJobs(companyData.data.id, 1);
  return <CompanyClient companyData={companyData.data} initialJobs={companyJobs.data} initialCount={companyJobs.count} />;
}
