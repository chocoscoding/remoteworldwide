import NotFound from "@/app/components/NotFound";
import { Company } from "@prisma/client";
import CompanyClient from "./Client";
import { findCompany, findCompanyJobs } from "@/libs/query";
import { revalidatePath } from "next/cache";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  revalidatePath("./");
  const companyName = decodeURIComponent((await params).name);
  const companyData = await findCompany(companyName);
  if (!companyData) return <NotFound buttonType="link" title="Company" link="/heroshima/companies/create" />;
  const companyJobs = await findCompanyJobs(companyData.data.id, 1);
  return <CompanyClient companyData={companyData.data} initialJobs={companyJobs.data} initialCount={companyJobs.count} />;
}
