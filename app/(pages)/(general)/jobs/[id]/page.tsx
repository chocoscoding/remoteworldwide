import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { checkBookmarkForUser } from "@/libs/query";
import { cache } from "react";
import { JobAndCompany } from "@/types/main";
import type { Job } from "@/types/main";
import OneJobClient from "./Client";
import { absoluteUrl, breadcrumbJsonLd, jsonLd } from "@/app/lib/seo";
import { jobPostingJsonLd } from "@/app/lib/jobs/jobPostingJsonLd";
import { isJobLive } from "@/app/lib/jobs/jobLifetime";
import { jobFacts } from "@/app/lib/jobs/jobFacts";
import { BOARD_TAGS, backendCachedOrNull } from "@/app/lib/backend";

export const revalidate = 43200; // 3600 * 12

// One listing and its whole company, from the backend (GET /api/jobs/:slug, description
// sanitized). Held in the data cache under the board's jobs tag, so an admin's edit shows at
// once; cache() lets generateMetadata and the page share one read per request.
const fetchJob = cache(async (slug: string): Promise<JobAndCompany | null> => {
  try {
    return await backendCachedOrNull<JobAndCompany>(`/jobs/${encodeURIComponent(slug)}`, { revalidate: 43200, tags: [BOARD_TAGS.jobs] });
  } catch (error) {
    throw new Error("Something went wrong");
  }
});

const fetchJobMetaData = fetchJob;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const jobSlug = decodeURIComponent((await params).id);
  const JOB = await fetchJobMetaData(jobSlug);

  // The page answers 404 (./not-found.tsx); this only names the tab.
  if (!JOB) return { title: "Job Not Found", robots: { index: false, follow: true } };

  // fetch data
  const regionLabel = JOB.region?.length ? JOB.region.join(", ") : "Anywhere in the world";
  const imageUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/og/job?title=${encodeURIComponent(JOB.title)}&type=${encodeURIComponent(
    regionLabel,
  )}&company=${encodeURIComponent(JOB.company.name)}${JOB.company.logo ? `&logo=${encodeURIComponent(JOB.company.logo)}` : ""}`;

  const keywordText = JOB.slug.split("-").slice(0, -1);
  const title = `${JOB.title} at ${JOB.company.name} (Remote) | Remote Worldwide`;
  const description = `${JOB.company.name} is hiring a remote ${JOB.title}.${JOB.seniority ? ` Seniority: ${JOB.seniority}.` : ""} Location: ${regionLabel}. Read the full job description and apply on Remote Worldwide.`;
  return {
    // Already carries the site name, so it skips the root template rather than doubling it.
    title: { absolute: title },
    description,
    alternates: {
      canonical: absoluteUrl(`/jobs/${JOB.slug}`),
    },
    // An unpublished or expired posting stays up for people who follow an old link, but
    // leaves the index (and Google's job results) the same day its markup goes.
    ...(isJobLive(JOB) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      images: imageUrl,
      title,
      description: `Find out more about the ${JOB.title} position at ${JOB.company.name}.`,
      url: absoluteUrl(`/jobs/${JOB.slug}`),
    },
    // Without a twitter block here, the root layout's is inherited whole, image included,
    // so X, Slack and Discord (they read twitter:image) showed the bare /api/og/job logo card.
    twitter: {
      card: "summary_large_image",
      title,
      description: `Find out more about the ${JOB.title} position at ${JOB.company.name}.`,
      images: [imageUrl],
    },
    keywords: ["Remoteworldwide", ...keywordText],
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const jobSlug = decodeURIComponent((await params).id);
  const JOB = await fetchJob(jobSlug);

  if (!JOB) notFound();
  const userSession = await auth();

  const { company: companyDetails, ..._jobDetails } = JOB!;
  const jobDetails = _jobDetails as unknown as Job;

  let hasUserBookmarked = undefined;
  // The same tests requireUserAction makes, so a signed-in visitor never meets its 401, and
  // an account locked for deletion (refused there with 423) still sees the public page.
  if (userSession?.user?.id && !userSession.user.deletionDueAt) {
    const _hasUserBookmarked = await checkBookmarkForUser(jobDetails.id);
    if (_hasUserBookmarked.data?.id) {
      hasUserBookmarked = true;
    }
  }

  // Employment type and salary for the markup, read from the posting's ATS (jobFacts.ts).
  const live = isJobLive(JOB);
  const facts = live ? await jobFacts(JOB) : null;

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Jobs", path: "/jobs" },
    { name: JOB.title, path: `/jobs/${JOB.slug}` },
  ]);

  return (
    <>
      {live && facts ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jobPostingJsonLd(JOB, facts)) }} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <OneJobClient Job={JOB} hasUserBookmarked={hasUserBookmarked} />
    </>
  );
}
