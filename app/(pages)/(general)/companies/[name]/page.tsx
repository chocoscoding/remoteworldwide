import CompanySection from "@/app/components/main/job/CompanySection";
import JobsContainer from "@/app/components/main/JobsContainer";
import NotFound from "@/app/components/NotFound";
import { CompanyWithJobsCount } from "@/types/main";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

interface PageProps {
  companyDetails: {
    id: string;
    name: string;
    about: string;
    _count: { jobs: number };
    website: string;
    logo: string;
    createdAt: string;
    updatedAt: string;
    linkedin: string;
    twitter: string;
    facebook: string;
  };
}
const fetchCompany = async (name: string): Promise<CompanyWithJobsCount | null> => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/companies/${name}`, { cache: "no-cache" });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Failed to fetch company:", error);
    return null;
  }
};
const Page = async ({ params }: { params: Promise<{ name: string }> }) => {
  const companyName = decodeURIComponent((await params).name);
  const companyData = await fetchCompany(companyName);

  if (!companyData) return <NotFound buttonType="back" title="Company" />;
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
            <CompanySection companyDetails={companyData} showFullDetails />
          </div>
          {/* |-job lists */}
          <div className="col-span-full md:col-span-7 h-fit">
            <JobsContainer companyId={companyData.id} />
          </div>
        </section>
      </section>
    </main>
  );
};

export default Page;
