// Google's JobPosting markup for a job page: what makes a listing eligible for
// Google's job search results. https://developers.google.com/search/docs/appearance/structured-data/job-posting
//
// Every job on the site is fully remote, so it is TELECOMMUTE with the countries
// its regions cover (Google needs at least one). Only live jobs get markup (see
// jobLifetime.ts): for an expired one Google asks for the markup to go, and the
// page itself stays up, noindexed, saying the job has expired.
//
// validThrough is the same date the page's "expired" banner uses. employmentType
// and baseSalary come from jobFacts.ts (the posting's ATS, then its own words);
// baseSalary is left out when neither states one, never guessed.

import type { JobAndCompany } from "@/types/main";
import { absoluteUrl, SITE_NAME } from "@/app/lib/seo";
import { applicantCountries } from "./regionCountries";
import { jobExpiresAt } from "./jobLifetime";
import type { JobFacts } from "./jobFacts";

export function jobPostingJsonLd(job: JobAndCompany, facts: JobFacts) {
  const { company } = job;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    // Stored as Quill HTML, which is the format Google asks for.
    description: job.description,
    datePosted: new Date(job.createdAt).toISOString(),
    validThrough: jobExpiresAt(job.createdAt).toISOString(),
    employmentType: facts.employmentType,
    identifier: { "@type": "PropertyValue", name: SITE_NAME, value: job.id },
    url: absoluteUrl(`/jobs/${job.slug}`),
    hiringOrganization: {
      "@type": "Organization",
      name: company.name,
      ...(company.website ? { sameAs: company.website } : {}),
      ...(company.logo ? { logo: company.logo } : {}),
    },
    ...(facts.salary
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: facts.salary.currency,
            value: {
              "@type": "QuantitativeValue",
              ...(facts.salary.min !== null && facts.salary.max !== null && facts.salary.min !== facts.salary.max
                ? { minValue: facts.salary.min, maxValue: facts.salary.max }
                : { value: facts.salary.max ?? facts.salary.min }),
              unitText: facts.salary.period,
            },
          },
        }
      : {}),
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: applicantCountries(job.region).map((name) => ({ "@type": "Country", name })),
    // Applying happens on the employer's own site.
    directApply: false,
  };
}
