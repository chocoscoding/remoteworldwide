import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobTile from "@/app/components/main/JobTileV2";
import CompanyTile from "@/app/components/main/CompanyTile";
import { BlogPagination } from "@/app/components/blog/PostGrid";
import { absoluteUrl, breadcrumbJsonLd, jsonLd, SITE_URL } from "@/app/lib/seo";
import {
  isLive,
  landingBySlug,
  landingPagePath,
  landingPath,
  FEATURED_LANDINGS,
  relatedLandings,
  pageParam,
  type Landing,
} from "@/app/lib/landing/catalogue";
import {
  indexable,
  landingCompanies,
  landingJobs,
  PER_PAGE,
  totalPages,
} from "@/app/lib/landing/data";

// A job or company landing page (app/lib/landing/catalogue.ts): heading, intro, the list rendered
// on the server with crawlable page links, links to the other landings, and its structured data.
// The job landings are cached pages (ISR): app/(pages)/(general)/jobs/landing/[slug] and
// jobs/[id]/[segment], each with a [page] child that next.config.mjs rewrites ?page=N to, because a
// cached page may not read the query string. Nothing here may read the request. The company
// landings still render per request (companies/[slug] is force-dynamic) and pass their ?page= in.

/** A company landing route's props: it reads ?page= itself. */
export type LandingProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Which page of the list: the ?page= value, or the [page] segment it was rewritten to. Missing is page 1. */
export type LandingPageParam = string | string[] | undefined;

/** The landing for a route, or a 404: unknown, not live yet (its data is missing), or a bad page number. */
async function resolve(
  kind: Landing["kind"],
  slug: string,
  pageValue: LandingPageParam,
) {
  const landing = landingBySlug(kind, slug);
  const page = pageParam(pageValue);
  if (!landing || !isLive(landing) || page === null) notFound();
  const result =
    landing.kind === "jobs"
      ? await landingJobs(landing, page)
      : await landingCompanies(landing, page);
  // Past the last page is a real 404, not an empty copy of the list.
  if (page > totalPages(result.count)) notFound();
  return { landing, page, result };
}

const countNoun = (kind: Landing["kind"], count: number) =>
  kind === "jobs"
    ? count === 1
      ? "open job"
      : "open jobs"
    : count === 1
      ? "company"
      : "companies";

const BREADCRUMB_ROOT = {
  jobs: { name: "Jobs", path: "/jobs" },
  companies: { name: "Companies", path: "/companies" },
} as const;

export async function landingMetadata(
  kind: Landing["kind"],
  slug: string,
  pageValue: LandingPageParam,
): Promise<Metadata> {
  const { landing, page, result } = await resolve(kind, slug, pageValue);
  const path = landingPagePath(landing, page);
  const countTitle = landing.metaTitle.replace(
    " | ",
    `: ${result.count.toLocaleString("en-US")} ${kind === "jobs" ? "Open Roles" : "Companies"} | `,
  );
  const title =
    page > 1 ? countTitle.replace(" | ", `, page ${page} | `) : countTitle;
  return {
    // Already carries the site name, so it skips the root template rather than doubling it.
    title: { absolute: title },
    description: landing.metaDescription,
    // Each page of the list is its own page (as /jobs?page=N is), so Google follows every listing on it.
    alternates: { canonical: path },
    // Empty or thin: kept out of the index, its links still followed. Any other query string
    // (?utm_source=...) is the same cached page, and the canonical above names the clean address.
    ...(indexable(result) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: "website",
      url: absoluteUrl(path),
      title,
      description: landing.metaDescription,
      images: [absoluteUrl(`/api/og/${kind === "jobs" ? "job" : "company"}`)],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: landing.metaDescription,
    },
  };
}

function structuredData(landing: Landing, page: number, urls: string[]) {
  const url = absoluteUrl(landingPagePath(landing, page));
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: landing.h1,
      description: landing.metaDescription,
      url,
      isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: urls.length,
        itemListElement: urls.map((item, i) => ({
          "@type": "ListItem",
          position: (page - 1) * PER_PAGE + i + 1,
          url: item,
        })),
      },
    },
    breadcrumbJsonLd([
      BREADCRUMB_ROOT[landing.kind],
      { name: landing.name, path: landingPath(landing) },
    ]),
  ];
}

export default async function LandingPage({
  kind,
  slug,
  page: pageValue,
}: { kind: Landing["kind"]; slug: string; page: LandingPageParam }) {
  const { landing, page, result } = await resolve(kind, slug, pageValue);
  const items = result.data;
  const pages = totalPages(result.count);
  const urls = (result.data as { slug: string }[]).map((item) =>
    absoluteUrl(`/${landing.kind}/${item.slug}`),
  );
  const related = relatedLandings(landing);
  const others = related.length
    ? related
    : FEATURED_LANDINGS.filter((l) => l !== landing);
  const root = BREADCRUMB_ROOT[landing.kind];

  return (
    <main className="m-auto min-h-screen w-full max-w-[1300px] p-3 md:p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(structuredData(landing, page, urls)),
        }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
        <Link href={root.path} className="hover:text-primary hover:underline">
          {root.name}
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <span className="text-primary">{landing.name}</span>
      </nav>

      <header className="mt-4 max-w-[760px]">
        <h1 className="text-2xl font-bold text-primary md:text-4xl">
          {landing.h1}
        </h1>
        {landing.intro.slice(0, 1).map((paragraph) => (
          <p key={paragraph} className="mt-3 leading-relaxed text-gray-600">
            {paragraph}
          </p>
        ))}
        <p className="mt-4 text-sm font-semibold text-primary">
          {result.count === 0
            ? "No matching listings right now."
            : `${result.count.toLocaleString("en-US")} ${countNoun(landing.kind, result.count)}${pages > 1 ? `, page ${page} of ${pages}` : ""}`}
        </p>
      </header>

      <section className="mt-8" aria-label={landing.h1}>
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-lg font-bold text-primary">
              No matching listings right now
            </p>
            <p className="mt-2 text-gray-600">
              New roles arrive daily.{" "}
              <Link
                href="/jobs"
                className="font-semibold text-primary underline"
              >
                Browse every remote job
              </Link>
            </p>
          </div>
        ) : landing.kind === "jobs" ? (
          <div>
            {(result.data as Parameters<typeof JobTile>[0][]).map((job) => (
              <JobTile key={job.id} {...job} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              result.data as Parameters<typeof CompanyTile>[0]["companyData"][]
            ).map((company) => (
              <CompanyTile key={company.slug} companyData={company} />
            ))}
          </div>
        )}
        {pages > 1 ? (
          <BlogPagination
            page={page}
            totalPages={pages}
            hrefFor={(n) => landingPagePath(landing, n)}
          />
        ) : null}
      </section>

      <nav
        aria-label="More lists"
        className="mt-14 border-t border-gray-200 pt-8"
      >
        <h2 className="text-lg font-bold text-primary">
          More remote job lists
        </h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          {others.map((other) => (
            <li key={landingPath(other)}>
              <Link
                href={landingPath(other)}
                className="inline-flex max-w-full items-center rounded-full border-2 border-black bg-secondary px-4 py-2 text-sm font-semibold text-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow,background-color] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white hover:shadow-[5px_5px_0_0_#000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none"
              >
                {other.kind === "companies" && other.slug !== "top"
                  ? `Companies: ${other.name}`
                  : other.name}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/jobs"
              className="inline-flex max-w-full items-center rounded-full border-2 border-black bg-secondary px-4 py-2 text-sm font-semibold text-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow,background-color] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white hover:shadow-[5px_5px_0_0_#000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none"
            >
              All remote jobs
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
