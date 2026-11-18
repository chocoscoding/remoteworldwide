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
import { effectiveExpiry } from "./jobLifetime";
import type { JobFacts } from "./jobFacts";

/**
 * When this markup last changed in a way Google should read again (2026-11-18: every live job names
 * its countries, and validThrough follows the 90-day lifetime). The jobs sitemap never gives a live
 * listing an older lastmod, so Google re-crawls pages it last saw before the change. Move it forward
 * whenever the markup changes for every listing at once.
 */
export const JOB_POSTING_MARKUP_REVISED_AT = "2026-11-18T00:00:00.000Z";

/**
 * The countries applicants may work from, in the order the page shows places (publicJobFacts.ts
 * jobLocations): worldwide, then the facts' regions and countries, then the admin's Region. Never
 * empty: Google drops a TELECOMMUTE posting without one (Search Console, 2026-11-17: 7 jobs whose
 * facts named no place and that had no Region), so a job nothing places is open worldwide, as its
 * page says.
 */
function jobCountries(job: JobAndCompany): string[] {
  if (job.facts?.worldwideEligible === true) return applicantCountries([]);
  const fromFacts = [...(job.facts?.regions ?? []), ...(job.facts?.countries ?? [])].filter((place) => place.trim());
  return applicantCountries(fromFacts.length ? fromFacts : (job.region ?? []));
}

export function jobPostingJsonLd(job: JobAndCompany, facts: JobFacts) {
  const { company } = job;
  const countries = jobCountries(job);
  const remote = !["hybrid", "onsite"].includes(job.facts?.remotePolicy ?? "");
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    // Stored as Quill HTML, which is the format Google asks for.
    description: job.description,
    datePosted: new Date(job.lifecycle?.postedAt ?? job.createdAt).toISOString(),
    validThrough: effectiveExpiry(job).toISOString(),
    ...(facts.employmentType ? {employmentType: facts.employmentType} : {}),
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
    ...(remote ? {jobLocationType: "TELECOMMUTE"} : {}),
    ...(countries.length ? {applicantLocationRequirements: countries.map((name) => ({ "@type": "Country", name }))} : {}),
    // Applying happens on the employer's own site.
    directApply: false,
  };
}
