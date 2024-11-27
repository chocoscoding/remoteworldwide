"use client";
import CompanySection from "@/app/components/main/job/CompanySection";
import JobDescription from "@/app/components/main/job/JobDescription";
import { JobAndCompany } from "@/types/main";
import { Job } from "@prisma/client";
import { FC } from "react";

const OneJobClient: FC<{ Job: JobAndCompany; hasUserBookmarked: boolean | undefined }> = ({ Job, hasUserBookmarked }) => {
  const { company: companyDetails, ..._jobDetails } = Job;
  const jobDetails = _jobDetails as unknown as Job;
  return (
    <main className="min-h-screen w-full">
      <section className="w-full m-auto max-w-[1200px] min-h-screen my-2 p-3">
        {/* main section */}
        <section className="grid grid-cols-1 md:grid-cols-10 h-full w-full gap-5 md:gap-10">
          {/* |-job info */}
          <div className="col-span-full md:col-span-7 h-fit">
            <JobDescription hasUserBookmarked={hasUserBookmarked} showBookmark={true} data={jobDetails} />
          </div>
          {/* |-company info */}
          <div className="col-span-full -order-1 md:order-2 md:col-span-3 h-fit">
            <CompanySection companyDetails={companyDetails} />
          </div>
        </section>
      </section>
    </main>
  );
};

export default OneJobClient;
