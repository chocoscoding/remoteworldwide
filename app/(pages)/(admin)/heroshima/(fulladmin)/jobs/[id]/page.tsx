import JobActions from "@/app/components/ADMIN/JobActions";
import CompanySection from "@/app/components/main/job/CompanySection";
import JobDescription from "@/app/components/main/job/JobDescription";
import NotFound from "@/app/components/NotFound";
import { prisma } from "@/prisma";
import { JobAndCompany } from "@/types/main";
import { Job } from "@prisma/client";
import React from "react";
import { revalidatePath } from "next/cache";
const fetchJob = async (slug: string): Promise<JobAndCompany | null> => {
  try {
    const job = await prisma.job.findUnique({
      where: {
        slug,
      },
      include: {
        company: true,
      },
    });
    return job;
  } catch (error) {
    throw new Error("Something went wrong");
  }
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  revalidatePath("./");

  const jobSlug = decodeURIComponent((await params).id);
  const JOB = await fetchJob(jobSlug);
  if (!JOB) return <NotFound buttonType="link" title="Job" link="/heroshima/companies/create" />;
  const { company: companyDetails, ..._jobDetails } = JOB!;
  const jobDetails = _jobDetails as unknown as Job;
  return (
    <main className="min-h-screen w-full">
      <section className="w-full m-auto max-w-[1200px] min-h-screen my-2 p-3">
        {/* main section */}
        <section className="grid grid-cols-1 md:grid-cols-10 h-full w-full gap-5 md:gap-10">
          {/* |-job info */}
          <div className="col-span-full md:col-span-7 h-fit">
            <JobDescription showBookmark={false} data={jobDetails} />
          </div>
          {/* |-company info */}
          <div className="col-span-full -order-1 md:order-2 md:col-span-3 h-fit">
            <CompanySection forAdmin companyDetails={companyDetails} />

            <JobActions id={jobDetails.id} isJobActive={jobDetails.isActive} slug={jobDetails.slug} />
          </div>
        </section>
      </section>
    </main>
  );
}
