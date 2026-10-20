import JobActions from "@/app/components/ADMIN/JobActions";
import JobAnalytics from "@/app/components/ADMIN/JobAnalytics";
import CompanySection from "@/app/components/main/job/CompanySection";
import JobDescription from "@/app/components/main/job/JobDescription";
import NotFound from "@/app/components/NotFound";
import { backendOrNull } from "@/app/lib/backend";
import type { AdminJobPage } from "@/types/main";
import React from "react";

// The listing as stored (inactive ones too) with its company and how it is doing, from the
// backend's admin route. Never cached: the click count is read fresh on every visit.
const fetchJob = (slug: string) => backendOrNull<AdminJobPage>(`/jobs/admin/${encodeURIComponent(slug)}`, { session: true });

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const jobSlug = decodeURIComponent((await params).id);
  const JOB = await fetchJob(jobSlug);
  if (!JOB) return <NotFound buttonType="link" title="Job" link="/heroshima/companies/create" />;
  const { company: companyDetails, stats, ...jobDetails } = JOB;
  return (
    <main className="min-h-screen w-full">
      <section className="w-full m-auto max-w-[1200px] min-h-screen my-2 p-3">
        {/* main section */}
        <section className="grid grid-cols-1 md:grid-cols-10 h-full w-full gap-5 md:gap-10">
          {/* |-job info */}
          <div className="col-span-full md:col-span-7 h-fit">
            {/* The admin's own presses are not counted. */}
            <JobDescription showBookmark={false} trackApply={false} data={jobDetails} />
          </div>
          {/* |-company info */}
          <div className="col-span-full -order-1 md:order-2 md:col-span-3 h-fit">
            <CompanySection forAdmin companyDetails={companyDetails} />

            <JobActions id={jobDetails.id} isJobActive={jobDetails.isActive} slug={jobDetails.slug} />

            <JobAnalytics stats={stats} />
          </div>
        </section>
      </section>
    </main>
  );
}
