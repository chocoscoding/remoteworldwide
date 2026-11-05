export const MIN_INDEXABLE = 5;
export const LANDING_REVALIDATE = 300;

type Common = {
  slug: string;
  name: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  missing?: string;
  role?: string;
  region?: string;
};
export type JobLanding = Common & {
  kind: "jobs";
  query: Record<string, string>;
};
export type CompanyLanding = Common & {
  kind: "companies";
  query: Record<string, string>;
};
export type Landing = JobLanding | CompanyLanding;

export const REGIONS: {
  slug: string;
  name: string;
  query: Record<string, string>;
}[] = [
  { slug: "usa", name: "the US", query: { countries: "US" } },
  { slug: "uk", name: "the UK", query: { countries: "GB" } },
  { slug: "europe", name: "Europe", query: { regions: "Europe" } },
  { slug: "emea", name: "EMEA", query: { regions: "EMEA" } },
  { slug: "canada", name: "Canada", query: { countries: "CA" } },
  {
    slug: "worldwide",
    name: "anywhere in the world",
    query: { worldwide: "1" },
  },
  { slug: "latin-america", name: "Latin America", query: { regions: "LATAM" } },
  { slug: "apac", name: "Asia Pacific", query: { regions: "APAC" } },
  { slug: "africa", name: "Africa", query: { regions: "Africa" } },
];
export const ROLES = [
  ["software-engineer", "software engineering"],
  ["frontend", "frontend development"],
  ["backend", "backend development"],
  ["devops", "DevOps"],
  ["data", "data"],
  ["product", "product"],
  ["design", "design"],
  ["marketing", "marketing"],
  ["sales", "sales"],
  ["customer-support", "customer support"],
  ["customer-success", "customer success"],
  ["operations", "operations"],
  ["finance", "finance"],
  ["hr", "human resources"],
  ["legal", "legal"],
  ["writing", "writing"],
  ["qa", "quality assurance"],
  ["security", "security"],
  ["ai-ml", "AI and machine learning"],
  ["executive", "executive"],
] as const;
const LIVE = { live: "1" };
const job = (
  slug: string,
  name: string,
  query: Record<string, string>,
  extra: Partial<Common> = {},
): JobLanding => ({
  kind: "jobs",
  slug,
  name,
  h1: name,
  metaTitle: `${name} | Remote Worldwide`,
  metaDescription: `Browse open ${name.toLowerCase()} with employer details and application links. Check each role's location and requirements before applying.`,
  intro: [
    `Explore ${name.toLowerCase()} that are open on Remote Worldwide. Listings expire after at most eight weeks, or earlier when an employer's deadline or closure is known.`,
    "Location, compensation and sponsorship details appear only when supported by the listing. Read each role for its full requirements and any conditions.",
  ],
  query: { ...LIVE, ...query },
  ...extra,
});
const regionJobs = REGIONS.map((region) =>
  job(region.slug, `Remote jobs open to ${region.name}`, region.query, {
    region: region.slug,
  }),
);
const roleJobs = ROLES.map(([slug, name]) =>
  job(slug, `Remote ${name} jobs`, { roleCategory: slug }, { role: slug }),
);
const combinations = ROLES.flatMap(([role, name]) =>
  REGIONS.map((region) =>
    job(
      `${role}/${region.slug}`,
      `Remote ${name} jobs in ${region.name}`,
      { roleCategory: role, ...region.query },
      { role, region: region.slug },
    ),
  ),
);
const seniorities = ["entry", "senior", "lead"] as const;
const seniorityJobs = seniorities.flatMap((seniority) =>
  ROLES.map(([role, name]) =>
    job(
      `${seniority}/${role}`,
      `${seniority === "entry" ? "Entry-level" : seniority[0].toUpperCase() + seniority.slice(1)} remote ${name} jobs`,
      { roleCategory: role, seniority },
      { role },
    ),
  ),
);
const h1b = job(
  "h1b",
  "Remote H1B sponsorship jobs",
  { visaSponsorship: "yes", visaType: "H1B" },
  {
    intro: [
      "Open remote listings that explicitly offer H1B sponsorship for this role. A company's past sponsorship activity alone does not qualify a listing.",
      "Remote does not mean work from any country. Check the posting's US work-location, authorization and sponsorship conditions before applying.",
    ],
  },
);
export const JOB_LANDINGS: JobLanding[] = [
  job("latest", "Latest remote jobs", {}),
  job("entry-level", "Entry-level remote jobs", { seniority: "entry" }),
  ...regionJobs,
  ...roleJobs,
  ...combinations,
  ...seniorityJobs,
  job("visa-sponsorship", "Remote jobs with visa sponsorship", {
    visaSponsorship: "yes",
  }),
  h1b,
  ...ROLES.map(([role, name]) =>
    job(
      `h1b/${role}`,
      `Remote H1B ${name} jobs`,
      { roleCategory: role, visaSponsorship: "yes", visaType: "H1B" },
      { role, intro: h1b.intro },
    ),
  ),
  job("uk-visa-sponsorship", "Remote UK visa sponsorship jobs", {
    visaSponsorship: "yes",
    visaType: "UK Skilled Worker",
    countries: "GB",
  }),
  job("eu-blue-card", "Remote EU Blue Card sponsorship jobs", {
    visaSponsorship: "yes",
    visaType: "EU Blue Card",
  }),
  job("part-time", "Part-time remote jobs", { employmentType: "part-time" }),
  job("contract", "Remote contract jobs", { employmentType: "contract" }),
  job(
    "salary-100k-usd",
    "Remote jobs paying at least $100,000 USD a year",
    { salaryMin: "100000", salaryCurrency: "USD", salaryPeriod: "year" },
    {
      intro: [
        "Open roles with a supported annual base-pay range starting at $100,000 USD or more. Bonuses, equity, on-target earnings and other currencies are not counted toward this threshold.",
        "Pay can vary by location and experience. Read the employer's full salary conditions before applying.",
      ],
    },
  ),
  ...["degree-required", "no-degree-required", "not-on-linkedin"].map((slug) =>
    job(
      slug,
      slug.replaceAll("-", " "),
      {},
      {
        missing:
          "This page requires verified education or distribution data and a corresponding supported search filter.",
      },
    ),
  ),
];
const company = (
  slug: string,
  name: string,
  query: Record<string, string>,
  extra: Partial<Common> = {},
): CompanyLanding => ({
  kind: "companies",
  slug,
  name,
  h1: name,
  metaTitle: `${name} | Remote Worldwide`,
  metaDescription: `Explore ${name.toLowerCase()}, their open roles and supported hiring information.`,
  intro: [
    `Explore ${name.toLowerCase()}, ordered by current openings. Counts include only jobs still open under the eight-week listing policy.`,
  ],
  query: { sort: "jobs", ...query },
  ...extra,
});
export const COMPANY_LANDINGS: CompanyLanding[] = [
  company("top", "Top companies hiring remotely", {}),
  ...REGIONS.map((region) =>
    company(
      `hiring-in-${region.slug}`,
      `Companies hiring remotely in ${region.name}`,
      region.query,
      { region: region.slug },
    ),
  ),
  company(
    "h1b-visa-sponsors",
    "Companies with H1B sponsorship history",
    { visaType: "H1B" },
    {
      intro: [
        "Companies matched to reviewed historical H1B labor-condition application records. Historical filings do not establish that a company is currently hiring or will sponsor a particular role.",
        "Open a company to see its current listings and the source period for its sponsorship history. For jobs explicitly offering sponsorship, browse the H1B jobs page.",
      ],
    },
  ),
  company(
    "skilled-worker-visa-sponsors",
    "Companies hiring with UK Skilled Worker sponsorship",
    { visaType: "UK Skilled Worker" },
  ),
];
export const LANDINGS: Landing[] = [...JOB_LANDINGS, ...COMPANY_LANDINGS];
export const isLive = (landing: Landing) => !landing.missing;
export const landingPath = (landing: Landing) =>
  `/${landing.kind}/${landing.slug}`;
export function landingBySlug<K extends Landing["kind"]>(
  kind: K,
  slug: string,
): Extract<Landing, { kind: K }> | undefined {
  return LANDINGS.find((l) => l.kind === kind && l.slug === slug) as
    | Extract<Landing, { kind: K }>
    | undefined;
}
export const landingPagePath = (landing: Landing, page: number) =>
  page > 1 ? `${landingPath(landing)}?page=${page}` : landingPath(landing);
export function landingApiPath(landing: Landing, page: number) {
  const query = new URLSearchParams(landing.query);
  if (page > 1) query.set("page", String(page));
  return `/${landing.kind}?${query}`;
}
export function pageParam(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^\d{1,5}$/.test(value)) return null;
  const page = Number(value);
  return page >= 1 ? page : null;
}
export const FEATURED_LANDINGS = [
  "usa",
  "uk",
  "europe",
  "emea",
  "canada",
  "worldwide",
  "latin-america",
  "software-engineer",
  "customer-support",
  "design",
  "marketing",
  "h1b",
].map((slug) => landingBySlug("jobs", slug)!);
export const FOOTER_LANDINGS = {
  Jobs: FEATURED_LANDINGS.map((l) => ({ title: l.name, href: landingPath(l) })),
  Companies: COMPANY_LANDINGS.filter(isLive)
    .slice(0, 4)
    .map((l) => ({ title: l.name, href: landingPath(l) })),
};
export function relatedLandings(landing: Landing): Landing[] {
  return LANDINGS.filter(
    (l) =>
      isLive(l) &&
      l !== landing &&
      ((landing.role && l.role === landing.role) ||
        (landing.region && l.region === landing.region)),
  ).slice(0, 12);
}
