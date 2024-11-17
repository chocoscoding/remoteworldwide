"use client";
import JobActions from "@/app/components/ADMIN/JobActions";
import CompanySection from "@/app/components/main/job/CompanySection";
import JobDescription from "@/app/components/main/job/JobDescription";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

const Page = () => {
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
};

export default Page;
