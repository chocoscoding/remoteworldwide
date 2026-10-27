// The site's three groups, shared by the navbar's dropdowns and the footer's columns (owner,
// 2026-10-15: three words in the bar, every page under them). The words match each page's title on
// purpose: Google names the sitelinks under the site's result from link text and titles, so keep
// them the same everywhere. The feature pages mirror TOOLS in app/lib/tools/catalogue.ts (names and
// slugs); they are spelled out here so the navbar does not pull the whole catalogue into every page.

/** `blurb`: the one line under the title in the navbar's dropdowns (the footer leaves it out). */
export type SiteNavLink = { title: string; href: string; blurb?: string };
/** `href`: the page the group's word opens. Without one (Company), the word just opens the list. */
export type SiteNavGroup = { label: string; href?: string; links: SiteNavLink[] };

export const SITE_NAV: SiteNavGroup[] = [
  {
    label: "Jobs",
    href: "/jobs",
    links: [
      { title: "Remote jobs", href: "/jobs", blurb: "Fresh remote roles, worldwide" },
      { title: "Companies", href: "/companies", blurb: "Who is hiring remotely" },
    ],
  },
  {
    label: "Features",
    href: "/tools",
    links: [
      { title: "All features", href: "/tools" },
      { title: "AI resume builder", href: "/tools/ai-resume-builder", blurb: "A resume that gets read" },
      { title: "ATS resume checker", href: "/tools/ats-resume-checker", blurb: "See how your resume scores" },
      { title: "AI cover letter generator", href: "/tools/ai-cover-letter-generator", blurb: "A letter for every job" },
      { title: "Job application autofill", href: "/tools/job-application-autofill", blurb: "Fill any form in one click" },
      { title: "Chrome extension", href: "/tools/chrome-extension", blurb: "Apply from any job page" },
      { title: "AI mock interview", href: "/tools/ai-mock-interview", blurb: "Practise out loud, get a report" },
      { title: "Job application tracker", href: "/tools/job-application-tracker", blurb: "Every application on one board" },
    ],
  },
  {
    label: "Company",
    links: [
      { title: "Pricing", href: "/pricing", blurb: "Free to start, upgrade any time" },
      { title: "Blog", href: "/blogs", blurb: "Guides for the remote job hunt" },
      { title: "Join the waitlist", href: "/waitlist", blurb: "Get in early" },
    ],
  },
];
