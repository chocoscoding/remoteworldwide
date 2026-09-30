// Google's JobPosting markup for a job page: what makes a listing eligible for
// Google's job search results. https://developers.google.com/search/docs/appearance/structured-data/job-posting
//
// Every job on the site is fully remote, so it is TELECOMMUTE with the countries
// its regions cover (Google needs at least one). Only active jobs get markup: for
// an expired one Google asks for the markup to go, and the page itself stays up
// saying the job has expired.
//
// Left out on purpose, because the site doesn't know them: employmentType (the
// job tile's "Full-time" is a display default, not data), validThrough and salary.

import type { JobAndCompany } from "@/types/main";
import { absoluteUrl } from "@/app/lib/seo";
import { applicantCountries } from "./regionCountries";

export function jobPostingJsonLd(job: JobAndCompany) {
  const { company } = job;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    // Stored as Quill HTML, which is the format Google asks for.
    description: job.description,
    datePosted: new Date(job.createdAt).toISOString(),
    url: absoluteUrl(`/jobs/${job.slug}`),
    hiringOrganization: {
      "@type": "Organization",
      name: company.name,
      ...(company.website ? { sameAs: company.website } : {}),
      ...(company.logo ? { logo: company.logo } : {}),
    },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: applicantCountries(job.region).map((name) => ({ "@type": "Country", name })),
    // Applying happens on the employer's own site.
    directApply: false,
  };
}
