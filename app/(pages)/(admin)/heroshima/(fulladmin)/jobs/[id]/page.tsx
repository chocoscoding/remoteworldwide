import JobActions from "@/app/components/ADMIN/JobActions";
import CompanySection from "@/app/components/main/job/CompanySection";
import JobDescription from "@/app/components/main/job/JobDescription";
import NotFound from "@/app/components/NotFound";
import { prisma } from "@/prisma";
import { Job } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

const fetchJob = async (slug: string): Promise<Job | null> => {
  try {
    const job = await prisma.job.findUnique({
      where: {
        slug,
      },
      include: {
        company: {
          select: {
            id: true,
            about: true,
            name: true,
            logo: true,
          },
        },
      },
    });
    return job;
  } catch (error) {
    throw new Error("Something went wrong");
  }
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const jobSlug = decodeURIComponent((await params).id);
  const JOB = await fetchJob(jobSlug);

  if (!JOB) return <NotFound buttonType="link" title="Company" link="/heroshima/companies/create" />;

  return (
    <main className="min-h-screen">
      <section className="w-full m-auto max-w-[1200px] min-h-screen my-2 p-3">
        {/* main section */}
        <section className="grid grid-cols-1 md:grid-cols-10 h-full w-full gap-5 md:gap-10">
          {/* |-job info */}
          <div className="col-span-full md:col-span-7 h-fit">
            <JobDescription />
          </div>
          {/* |-company info */}
          <div className="col-span-full -order-1 md:order-2 md:col-span-3 h-fit">
            <CompanySection />

            <JobActions />
          </div>
        </section>
      </section>
    </main>
  );
}
