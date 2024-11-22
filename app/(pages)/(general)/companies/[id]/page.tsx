"use client";
import CompanySection from "@/app/components/main/job/CompanySection";
import JobsContainer from "@/app/components/main/JobsContainer";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

const Page = () => {
  return (
    <main className="min-h-screen">
      <section className="w-full m-auto max-w-[1200px] min-h-screen my-5 p-3">
        {/* back buttton */}
        <Link href={`/jobs`}>
          <div className="flex gap-2 w-fit items-center mb-5">
            <ArrowLeft className="w-4" />
            <p className="font-bold">Back</p>
          </div>
        </Link>

        {/* main section */}
        <section className="grid grid-cols-1 md:grid-cols-10 h-full w-full gap-5 md:gap-10">
          {/* |-company info */}
          <div className="col-span-full md:col-span-3 h-fit md:top-[70px] md:sticky">
            <CompanySection
              companyDetails={{
                id: "dklkdsklklklsd",
                name: "Tech Corp",
                about: "A leading tech company specializing in innovative solutions.",
                _count: { jobs: 5 },
                website: "https://techcorp.com",
                logo: "https://via.placeholder.com/150",
                createdAt: new Date(),
                updatedAt: new Date(),
                linkedin: "https://linkedin.com/company/techcorp",
                twitter: "https://twitter.com/techcorp",
                facebook: "https://facebook.com/techcorp",
              }}
              showFullDetails
            />
          </div>
          {/* |-job lists */}
          <div className="col-span-full md:col-span-7 h-fit">
            <JobsContainer />
          </div>
        </section>
      </section>
    </main>
  );
};

export default Page;
