import { FilterData } from "@/types/main";
import type { AdminJobPage } from "@/types/main";
import NotFound from "@/app/components/NotFound";
import UpdateJob from "./Client";
import { backend, backendOrNull } from "@/app/lib/backend";
import { getCompanyOptions } from "@/libs/query";

// The listing as stored (the description unsanitized, so an edit keeps everything it had), with
// every company and filter for the form's dropdowns. All from the backend, fresh on every visit.
const fetchJob = (slug: string) => backendOrNull<AdminJobPage>(`/jobs/admin/${encodeURIComponent(slug)}`, { session: true });

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

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const jobSlug = decodeURIComponent((await params).id);
  const [JOB, allCompanies, filters] = await Promise.all([fetchJob(jobSlug), getAllCompanies(), getAllFilters()]);

  if (!JOB) return <NotFound buttonType="link" title="Job" link="/heroshima/companies/create" />;
  return (
    <>
      <UpdateJob job={JOB} allCompanies={allCompanies} filters={filters} key={"createJobPage"} />
    </>
  );
}
