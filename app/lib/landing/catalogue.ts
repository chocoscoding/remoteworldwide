// The job and company landing pages (2026-10-28): each is one filtered list of the board with its
// own title, intro, canonical, JSON-LD and sitemap entry, linked from the footer's Jobs and
// Companies columns. The words live here; the pages are app/components/landing/*.
//
// A page goes live only when the backend can answer its filter from data it really stores.
// `missing` names what the backend lacks: until it lands that page answers 404, stays out of the
// footer and the sitemap, and never shows a list that only looks filtered. Today the board stores
// category, region, seniority, title and dates, and nothing about degrees, visas or LinkedIn.
//
// A live page with fewer than MIN_INDEXABLE listings is noindexed and left out of the sitemap, so
// an empty or near-empty list is never indexed as thin content.

export const MIN_INDEXABLE = 3;

/** How long a page's count and first page stay cached (and the sitemap's check of them). */
export const LANDING_REVALIDATE = 3600;

type Common = {
  /** The last path segment: /jobs/<slug> or /companies/<slug>. */
  slug: string;
  /** The footer's link text, and the breadcrumb's last step. */
  name: string;
  h1: string;
  /** Carries the site name already, so the page skips the root title template. */
  metaTitle: string;
  metaDescription: string;
  /** Short paragraphs under the heading: what is on the list and how it is picked. */
  intro: string[];
  /** What the backend would need before this page can go live; absent when it is live. */
  missing?: string;
};

/** `query`: the backend's GET /jobs parameters (remoteworldwidebackend src/services/jobBoardService.ts). */
export type JobLanding = Common & { kind: "jobs"; query: Record<string, string> };
/** `query`: the backend's GET /companies parameters (src/services/companyService.ts). */
export type CompanyLanding = Common & { kind: "companies"; query: Record<string, string> };
export type Landing = JobLanding | CompanyLanding;

// Every list asks for live listings only (active, posted in the last 45 days), the same rule as the
// job pages' noindex and the sitemap, so a landing page never sends a reader to a closed posting.
const LIVE = { live: "1" };

const NO_VISA_DATA =
  "Listings and companies store no visa sponsorship field. Add a sponsorship flag to companies, filled from the public sponsor lists, then a backend filter for it.";

export const JOB_LANDINGS: JobLanding[] = [
  {
    kind: "jobs",
    slug: "latest",
    name: "Latest Jobs",
    h1: "Latest remote jobs",
    metaTitle: "Latest remote jobs, newest first | Remote Worldwide",
    metaDescription:
      "The newest remote jobs on Remote Worldwide, newest first. Every listing is open and was posted in the last 45 days, across engineering, design, marketing, sales and more.",
    intro: [
      "Every remote job added to the board, newest first. Closed listings and anything posted more than 45 days ago are left out, so what you see is still open.",
      "Check back daily: new roles arrive every day, and the earliest applicants are often the ones who get a reply.",
    ],
    query: { ...LIVE },
  },
  {
    kind: "jobs",
    slug: "entry-level",
    name: "Entry level roles",
    h1: "Entry level remote jobs",
    metaTitle: "Entry level remote jobs | Remote Worldwide",
    metaDescription:
      "Open entry level remote jobs, newest first: roles for graduates, career changers and people early in their career, across engineering, support, marketing and more.",
    intro: [
      "Remote jobs marked entry level or entry to mid-level, newest first. Only open listings posted in the last 45 days are shown.",
      "Some entry to mid-level roles ask for a year or two of experience. The listing says what the team expects, so read it before you apply.",
    ],
    // The board's two entry seniorities ("Entry level", "Entry & mid-level"), joined the way GET /jobs reads a list.
    query: { ...LIVE, seniority: "Entry level_Entry & mid-level" },
  },
  {
    kind: "jobs",
    slug: "degree-required",
    name: "Degree Required",
    h1: "Remote jobs that ask for a degree",
    metaTitle: "Remote jobs that require a degree | Remote Worldwide",
    metaDescription: "Open remote jobs whose listing asks for a university degree, newest first.",
    intro: ["Open remote jobs whose listing asks for a university degree, newest first."],
    query: { ...LIVE },
    missing: "Listings store no education requirement. Add a degree field (required, preferred, not required) to each listing, read from its description at import.",
  },
  {
    kind: "jobs",
    slug: "no-degree-required",
    name: "No degree required",
    h1: "Remote jobs with no degree required",
    metaTitle: "Remote jobs with no degree required | Remote Worldwide",
    metaDescription: "Open remote jobs that do not ask for a university degree, newest first.",
    intro: ["Open remote jobs that do not ask for a university degree, newest first."],
    query: { ...LIVE },
    missing: "Listings store no education requirement. The same degree field as Degree Required, with its \"not required\" value.",
  },
  {
    kind: "jobs",
    slug: "not-on-linkedin",
    name: "Jobs not on LinkedIn",
    h1: "Remote jobs not posted on LinkedIn",
    metaTitle: "Remote jobs not posted on LinkedIn | Remote Worldwide",
    metaDescription: "Open remote jobs found on company career pages that are not posted on LinkedIn.",
    intro: ["Open remote jobs from company career pages that are not posted on LinkedIn."],
    query: { ...LIVE },
    missing: "Listings store neither where they came from nor whether the same role is on LinkedIn. Add a source field and a LinkedIn-checked field, filled by a lookup at import.",
  },
  {
    kind: "jobs",
    slug: "h1b-visa-sponsor",
    name: "H1B Visa Sponsor",
    h1: "Remote jobs at H1B visa sponsors",
    metaTitle: "Remote jobs at H1B visa sponsors | Remote Worldwide",
    metaDescription: "Open remote jobs at companies that have sponsored H1B visas.",
    intro: ["Open remote jobs at companies that have sponsored H1B visas."],
    query: { ...LIVE },
    missing: NO_VISA_DATA,
  },
  {
    kind: "jobs",
    slug: "skilled-worker-visa-sponsor",
    name: "Skilled Worker Visa Sponsor",
    h1: "Remote jobs at UK Skilled Worker visa sponsors",
    metaTitle: "Remote jobs at UK Skilled Worker visa sponsors | Remote Worldwide",
    metaDescription: "Open remote jobs at companies licensed to sponsor UK Skilled Worker visas.",
    intro: ["Open remote jobs at companies licensed to sponsor UK Skilled Worker visas."],
    query: { ...LIVE },
    missing: NO_VISA_DATA,
  },
  {
    kind: "jobs",
    slug: "frontend-developer",
    name: "Frontend developer jobs",
    h1: "Remote frontend developer jobs",
    metaTitle: "Remote frontend developer jobs | Remote Worldwide",
    metaDescription:
      "Open remote frontend developer and frontend engineer jobs, newest first. Build web interfaces in React, TypeScript and more, from anywhere the role allows.",
    intro: [
      "Remote engineering jobs with \"front\" in the title: frontend developer, front-end engineer and similar roles, newest first. Only open listings posted in the last 45 days are shown.",
      "Each listing says where you can work from. Open one to read the stack, the seniority and the regions it hires in.",
    ],
    // The board's search is a contains-match on the title, so "front" finds Frontend, Front-end and
    // Front End alike; the Engineering category keeps out a "Front Desk" role.
    query: { ...LIVE, roles: "Engineering", search: "front" },
  },
  {
    kind: "jobs",
    slug: "latin-america",
    name: "Latin America jobs",
    h1: "Remote jobs open to Latin America",
    metaTitle: "Remote jobs in Latin America (LATAM) | Remote Worldwide",
    metaDescription:
      "Open remote jobs that hire in Latin America (LATAM), newest first: engineering, design, marketing, sales, support and more.",
    intro: [
      "Remote jobs whose listing names Latin America (LATAM) as a region the company hires in, newest first. Only open listings posted in the last 45 days are shown.",
      "Roles open to anywhere in the world are listed on the main board as well. Check each listing for time zone overlap and the countries it covers.",
    ],
    query: { ...LIVE, regions: "LATAM" },
  },
];

export const COMPANY_LANDINGS: CompanyLanding[] = [
  {
    kind: "companies",
    slug: "top",
    name: "Top Companies",
    h1: "Top companies hiring remotely",
    metaTitle: "Top companies hiring remotely right now | Remote Worldwide",
    metaDescription:
      "The companies with the most open remote jobs on Remote Worldwide right now, ranked by live listings posted in the last 45 days.",
    intro: [
      "Companies ranked by how many open remote jobs they have on the board right now. Only listings that are still open and were posted in the last 45 days count.",
      "Open a company to see every role it is hiring for and what it does.",
    ],
    query: { sort: "jobs" },
  },
  {
    kind: "companies",
    slug: "h1b-visa-sponsors",
    name: "H1B Visa Sponsor",
    h1: "Remote companies that sponsor H1B visas",
    metaTitle: "Remote companies that sponsor H1B visas | Remote Worldwide",
    metaDescription: "Companies hiring remotely that have sponsored H1B visas.",
    intro: ["Companies hiring remotely that have sponsored H1B visas."],
    query: { sort: "jobs" },
    missing: NO_VISA_DATA,
  },
  {
    kind: "companies",
    slug: "skilled-worker-visa-sponsors",
    name: "Skilled Worker Visa Sponsor",
    h1: "Remote companies that sponsor UK Skilled Worker visas",
    metaTitle: "Remote companies that sponsor UK Skilled Worker visas | Remote Worldwide",
    metaDescription: "Companies hiring remotely that are licensed to sponsor UK Skilled Worker visas.",
    intro: ["Companies hiring remotely that are licensed to sponsor UK Skilled Worker visas."],
    query: { sort: "jobs" },
    missing: NO_VISA_DATA,
  },
];

export const LANDINGS: Landing[] = [...JOB_LANDINGS, ...COMPANY_LANDINGS];

export const isLive = (landing: Landing): boolean => !landing.missing;

export const landingPath = (landing: Landing): string => `/${landing.kind}/${landing.slug}`;

export function landingBySlug<K extends Landing["kind"]>(kind: K, slug: string): Extract<Landing, { kind: K }> | undefined {
  return LANDINGS.find((landing) => landing.kind === kind && landing.slug === slug) as Extract<Landing, { kind: K }> | undefined;
}

/** A page's own URL: page 1 has no `?page`, so it stays the canonical of the list's first page. */
export const landingPagePath = (landing: Landing, page: number): string => (page > 1 ? `${landingPath(landing)}?page=${page}` : landingPath(landing));

/** The backend path for one page of a landing's list. */
export function landingApiPath(landing: Landing, page: number): string {
  const query = new URLSearchParams(landing.query);
  if (page > 1) query.set("page", String(page));
  return `/${landing.kind}?${query.toString()}`;
}

/** `?page=` as a whole number from 1, or null when it is not one (the page then answers 404). */
export function pageParam(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^\d{1,5}$/.test(value)) return null;
  const page = Number(value);
  return page >= 1 ? page : null;
}

/** The footer's two columns: live pages only, in the catalogue's order. */
export const FOOTER_LANDINGS = {
  Jobs: JOB_LANDINGS.filter(isLive).map((l) => ({ title: l.name, href: landingPath(l) })),
  Companies: COMPANY_LANDINGS.filter(isLive).map((l) => ({ title: l.name, href: landingPath(l) })),
};
