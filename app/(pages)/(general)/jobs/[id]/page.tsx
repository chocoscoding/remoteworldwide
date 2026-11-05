import { notFound } from "next/navigation";
import { cache } from "react";
import type { JobAndCompany } from "@/types/main";
import OneJobClient from "./Client";
import { absoluteUrl, breadcrumbJsonLd, jsonLd } from "@/app/lib/seo";
import { jobPostingJsonLd } from "@/app/lib/jobs/jobPostingJsonLd";
import { isJobLive, isJobIndexable } from "@/app/lib/jobs/jobLifetime";
import { jobFacts } from "@/app/lib/jobs/jobFacts";
import { jobLocations } from "@/app/lib/jobs/publicJobFacts";
import { backendOrNull } from "@/app/lib/backend";
import Link from "next/link";
import LandingPage, { landingMetadata } from "@/app/components/landing/LandingPage";
import { landingBySlug } from "@/app/lib/landing/catalogue";

// Expiry is evaluated on each request; cached HTML must never advertise an already expired job.
export const dynamic = "force-dynamic";
type Props = {params:Promise<{id:string}>;searchParams:Promise<{page?:string|string[]}>};
const fetchJob = cache((slug: string) => backendOrNull<JobAndCompany>(`/jobs/${encodeURIComponent(slug)}`));

export async function generateMetadata({params,searchParams}:Props) {
  const slug = (await params).id;
  if (landingBySlug("jobs",slug)) return landingMetadata("jobs",slug,{searchParams});
  const job = await fetchJob(slug);
  if (!job) return {title:"Job Not Found",robots:{index:false,follow:true}};
  const live = isJobLive(job);
  const region = jobLocations(job.facts,job.region).join(", ");
  const title = `${job.title} at ${job.company.name} (Remote${region !== "Location not specified" ? `, ${region}` : ""})${live ? "" : " — Archived"} | Remote Worldwide`;
  const description = live
    ? `${job.company.name} is hiring a ${job.title}. ${region !== "Location not specified" ? `Location: ${region}. ` : ""}Read the job details and apply.`
    : `Archived ${job.title} listing at ${job.company.name}. Read the original role details and explore current remote opportunities.`;
  const image = absoluteUrl(`/api/og/job?${new URLSearchParams({title:job.title,type:region,company:job.company.name,...(job.company.logo ? {logo:job.company.logo} : {})})}`);
  return {
    title:{absolute:title},description,alternates:{canonical:absoluteUrl(`/jobs/${job.slug}`)},
    robots:{index:isJobIndexable(job),follow:true},
    openGraph:{images:image,title,description,url:absoluteUrl(`/jobs/${job.slug}`)},
    twitter:{card:"summary_large_image" as const,title,description,images:[image]},
  };
}

export default async function Page({params,searchParams}:Props) {
  const slug = (await params).id;
  if (landingBySlug("jobs",slug)) return <LandingPage kind="jobs" slug={slug} searchParams={searchParams} />;
  const job = await fetchJob(slug);
  if (!job) notFound();
  const live = isJobLive(job);
  const facts = live ? await jobFacts(job) : null;
  const breadcrumbs = breadcrumbJsonLd([{name:"Jobs",path:"/jobs"},{name:job.title,path:`/jobs/${job.slug}`}]);
  return <>
    {live && facts ? <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(jobPostingJsonLd(job,facts))}} /> : null}
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(breadcrumbs)}} />
    <OneJobClient Job={job} />
    <nav className="mx-auto flex max-w-[1200px] flex-wrap gap-4 px-4 py-8" aria-label="Browse more jobs">
      <Link href="/jobs" className="inline-flex items-center justify-center rounded-full border-2 border-black bg-secondary px-5 py-3 text-sm font-bold text-black shadow-[3px_3px_0_0_#000] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-y-0.5 motion-reduce:transition-none">Browse all open jobs</Link>
      <Link href={`/companies/${job.company.slug}`} className="inline-flex items-center justify-center rounded-full border-2 border-black bg-white px-5 py-3 text-sm font-bold text-black shadow-[3px_3px_0_0_#000] transition-transform hover:-translate-y-0.5 hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-y-0.5 motion-reduce:transition-none">More jobs at {job.company.name}</Link>
    </nav>
  </>;
}
