import CompanySection from "@/app/components/main/job/CompanySection";
import JobTile from "@/app/components/main/JobTileV2";
import { notFound } from "next/navigation";
import type { CompanyWithJobsCount, JobTileType } from "@/types/main";
import Link from "next/link";
import Image from "next/image";
import { cache } from "react";
import type { Metadata } from "next";
import { backendOrNull, backendWithCount } from "@/app/lib/backend";
import { absoluteUrl, breadcrumbJsonLd, jsonLd } from "@/app/lib/seo";
import LandingPage, { landingMetadata } from "@/app/components/landing/LandingPage";
import { landingBySlug, pageParam } from "@/app/lib/landing/catalogue";

export const dynamic = "force-dynamic";
type Props = {params:Promise<{slug:string}>;searchParams:Promise<{page?:string|string[]}>};
const fetchCompany = cache((slug:string) => backendOrNull<CompanyWithJobsCount>(`/companies/${encodeURIComponent(slug)}`));
const companyPath = (slug:string,page:number) => `/companies/${encodeURIComponent(slug)}${page > 1 ? `?page=${page}` : ""}`;

export async function generateMetadata({params,searchParams}:Props):Promise<Metadata> {
  const slug=(await params).slug;
  if (landingBySlug("companies",slug)) return landingMetadata("companies",slug,{searchParams});
  const company=await fetchCompany(slug);
  if(!company) return {title:"Company Not Found",robots:{index:false,follow:true}};
  const page=pageParam((await searchParams).page);
  if(page===null) notFound();
  const count=company.openJobsCount ?? company._count?.jobs ?? 0;
  const regions=company.hiringRegions?.length ? ` Hiring across ${company.hiringRegions.slice(0,4).join(", ")}.` : "";
  const title=`${company.name} Careers: ${count} Remote ${count===1 ? "Job" : "Jobs"}${page>1 ? `, Page ${page}` : ""} | Remote Worldwide`;
  const description=count>0 ? `${company.name} has ${count} open remote ${count===1 ? "role" : "roles"}.${regions} Explore current opportunities and apply.` : `There are no open roles at ${company.name} on Remote Worldwide right now. Explore the company and find similar companies hiring.`;
  const url=absoluteUrl(companyPath(company.slug,page));
  const image=absoluteUrl(`/api/og/company?${new URLSearchParams({name:company.name,jobs:String(count),...(company.logo ? {logo:company.logo} : {})})}`);
  return {title:{absolute:title},description,alternates:{canonical:url},robots:{index:count>0,follow:true},openGraph:{type:"website",title,description,url,images:[image]},twitter:{card:"summary_large_image",title,description,images:[image]}};
}

export default async function Page({params,searchParams}:Props) {
  const slug=(await params).slug;
  if(landingBySlug("companies",slug)) return <LandingPage kind="companies" slug={slug} searchParams={searchParams} />;
  const page=pageParam((await searchParams).page);
  if(page===null) notFound();
  const company=await fetchCompany(slug);
  if(!company) notFound();
  // All displayed jobs and pagination links are in the server HTML, including without JavaScript.
  const result=await backendWithCount<JobTileType[]>(`/jobs/company/${company.id}?page=${page}`);
  const totalPages=Math.max(1,Math.ceil(result.count/50));
  if(page>totalPages) notFound();
  const profile=company.hiringProfile;
  const history=company.sponsorshipHistory?.matchStatus === "reviewed" ? company.sponsorshipHistory : null;
  const historySources=(history?.sourceUrls ?? (history?.sourceUrl ? [history.sourceUrl] : [])).filter(url=>{try{const parsed=new URL(url);return parsed.protocol==="https:" && (parsed.hostname==="dol.gov" || parsed.hostname.endsWith(".dol.gov"));}catch{return false;}});
  const data=[breadcrumbJsonLd([{name:"Companies",path:"/companies"},{name:company.name,path:companyPath(company.slug,page)}]),
    {"@context":"https://schema.org","@type":"Organization",name:company.name,url:company.website || absoluteUrl(companyPath(company.slug,1)),...(company.logo?{logo:company.logo}:{}),sameAs:[company.linkedin,company.twitter,company.facebook].filter(Boolean)},
    {"@context":"https://schema.org","@type":"ItemList",itemListElement:result.data.map((job,index)=>({"@type":"ListItem",position:(page-1)*50+index+1,name:job.title,url:absoluteUrl(`/jobs/${job.slug}`)}))}];
  return <main className="mx-auto min-h-screen max-w-[1350px] px-4 py-8">
    {data.map((node,index)=><script key={index} type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(node)}} />)}
    <Link href="/companies" className="mb-5 inline-block underline">All companies</Link>
    <h1 className="mb-2 text-3xl font-bold">{company.name} careers and remote jobs{page>1 ? ` — page ${page}` : ""}</h1>
    <p className="mb-6 text-gray-600">{result.count} open {result.count===1 ? "role" : "roles"} on Remote Worldwide</p>
    <div className="grid gap-8 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside><CompanySection companyDetails={{...company,_count:{jobs:result.count}}} showFullDetails />
        {profile && <dl className="mt-5 space-y-3 text-sm">{[["Industry",profile.industry],["Company size",profile.size],["Headquarters",profile.hqCountry],["Remote policy",profile.remotePolicy]].map(([label,value])=>value?<div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>:null)}</dl>}
        {profile?.careersUrl && <a href={profile.careersUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block font-semibold underline">Company careers website</a>}
      </aside>
      <section aria-label="Open jobs">
        {profile?.hiringAbout && <p className="mb-6 whitespace-pre-line">{profile.hiringAbout}</p>}
        {history && <section aria-labelledby="sponsorship-history" className="mb-6 rounded-xl border p-5 text-sm">
          <h2 id="sponsorship-history" className="mb-2 text-lg font-bold">Historical H-1B employer records</h2>
          <p>{history.certifiedCases.toLocaleString()} certified Labor Condition Application cases with decisions from {history.periodStart} to before {history.periodEnd}.</p>
          {history.medianWage !== null && <p className="mt-2">Median reported annual starting wage: USD {history.medianWage.toLocaleString("en-US")}{history.wageSampleCount ? ` (${history.wageSampleCount} annual wage records)` : ""}.</p>}
          {history.topTitles.length>0 && <p className="mt-2">Common titles: {history.topTitles.join(", ")}.</p>}
          <p className="mt-3 text-gray-600">Historical LCA records are not visa approvals or a promise of sponsorship for a current opening. Check each job’s stated requirements.</p>
          {historySources.map((url,index)=><a key={url} href={url} target="_blank" rel="noopener noreferrer" className="mr-4 mt-2 inline-block underline">DOL disclosure source {index+1}</a>)}
        </section>}
        {result.data.length ? result.data.map(job=><JobTile key={job.id} {...job} />) : <div className="rounded-xl border p-6"><h2 className="text-xl font-bold">No open roles right now</h2><p className="mt-2">Check back for new openings, or explore companies hiring below.</p></div>}
        {totalPages>1 && <nav aria-label="Job pagination" className="mt-6 flex items-center justify-between gap-4">
          {page>1 ? <Link rel="prev" href={companyPath(company.slug,page-1)} className="underline">Previous page</Link> : <span />}
          <span>Page {page} of {totalPages}</span>
          {page<totalPages ? <Link rel="next" href={companyPath(company.slug,page+1)} className="underline">Next page</Link> : <span />}
        </nav>}
      </section>
    </div>
    <section className="mt-10" aria-labelledby="similar-companies"><h2 id="similar-companies" className="mb-4 text-2xl font-bold">Similar companies hiring</h2>
      {company.similarCompanies?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {company.similarCompanies.map(item => (
            <li key={item.slug}>
              <Link href={`/companies/${item.slug}`} className="flex items-center gap-3 rounded-lg border p-4 hover:underline">
                {item.logo ? (
                  <Image src={item.logo} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full border bg-white object-contain p-1" />
                ) : (
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-gray-50 font-semibold">{item.name.trim().charAt(0).toUpperCase()}</span>
                )}
                <span className="min-w-0 break-words">
                  <strong>{item.name}</strong>
                  <span className="block text-sm text-gray-600">{item._count.jobs} open roles</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <Link href="/companies/top" className="underline">Explore companies with open roles</Link>}
    </section>
  </main>;
}
