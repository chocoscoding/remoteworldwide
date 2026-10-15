// The site's three groups, shared by the navbar's dropdowns and the footer's columns (owner,
// 2026-10-15: three words in the bar, every page under them). The words match each page's title on
// purpose: Google names the sitelinks under the site's result from link text and titles, so keep
// them the same everywhere. The feature pages mirror TOOLS in app/lib/tools/catalogue.ts (names and
// slugs); they are spelled out here so the navbar does not pull the whole catalogue into every page.

export type SiteNavLink = { title: string; href: string };
/** `href`: the page the group's word opens. Without one (Company), the word just opens the list. */
export type SiteNavGroup = { label: string; href?: string; links: SiteNavLink[] };

export const SITE_NAV: SiteNavGroup[] = [
  {
    label: "Jobs",
    href: "/jobs",
    links: [
      { title: "Remote jobs", href: "/jobs" },
      { title: "Companies", href: "/companies" },
    ],
  },
  {
    label: "Features",
    href: "/tools",
    links: [
      { title: "All features", href: "/tools" },
      { title: "AI resume builder", href: "/tools/ai-resume-builder" },
      { title: "ATS resume checker", href: "/tools/ats-resume-checker" },
      { title: "AI cover letter generator", href: "/tools/ai-cover-letter-generator" },
      { title: "Job application autofill", href: "/tools/job-application-autofill" },
      { title: "Chrome extension", href: "/tools/chrome-extension" },
      { title: "AI mock interview", href: "/tools/ai-mock-interview" },
      { title: "Job application tracker", href: "/tools/job-application-tracker" },
    ],
  },
  {
    label: "Company",
    links: [
      { title: "Pricing", href: "/pricing" },
      { title: "Blog", href: "/blogs" },
      { title: "Join the waitlist", href: "/waitlist" },
    ],
  },
];
