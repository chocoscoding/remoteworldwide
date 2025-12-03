import CompanySection from "@/app/components/main/job/CompanySection";
import JobsContainer from "@/app/components/main/JobsContainer";
import NotFound from "@/app/components/NotFound";
import { CompanyWithJobsCount } from "@/types/main";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Metadata } from "next";

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
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/companies/${name}`);
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

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const companyName = decodeURIComponent((await params).name);
  const companyData = await fetchCompany(companyName);

  if (!companyData) {
    return {
      title: "Company Not Found",
      description: "The requested company could not be found.",
    };
  }

  const jobCount = companyData._count?.jobs;
  const title = `${companyData.name} - Remote Jobs`;
  const description = companyData.about
    ? `${companyData.about.substring(0, 100)}... Explore ${jobCount ?? "several"} remote ${jobCount === 1 ? "job" : "jobs"} at ${
        companyData.name
      }. Find your next remote opportunity.`
    : `Explore ${jobCount ?? "several"} remote ${jobCount === 1 ? "job" : "jobs"} at ${
        companyData.name
      }. Find your next remote opportunity.`;

  const ogImageUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/og/company?name=${encodeURIComponent(companyData.name)}${
    companyData.logo ? `&logo=${encodeURIComponent(companyData.logo)}` : ""
  }${jobCount ? `&jobs=${jobCount}` : ""}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/companies/${encodeURIComponent(companyData.name)}`,
      siteName: "Remote Worldwide",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${companyData.name} - Remote Jobs`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}
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
