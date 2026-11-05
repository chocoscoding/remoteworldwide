import { notFound } from "next/navigation";
import { landingBySlug } from "@/app/lib/landing/catalogue";
import { Listing, listingMetadata } from "./listing";

// A listing's page (./listing.tsx), built on its first visit and served from the cache: rebuilt
// once a day, when an admin writes that listing (libs/query.ts expires its own tag), or when it
// expires. Crawlers walk all ~2,000 listings, so rendering per request (force-dynamic) would cost a
// render and a backend read per crawl.
//
// Only listings arrive here. The landing pages share /jobs/<slug> but read the query string and
// the request, which a cached route may not do (Next answers DYNAMIC_SERVER_USAGE, a 500), so
// next.config.mjs rewrites every single-segment slug without the listings' long number to
// ../landing/[slug], which renders per request.
export const revalidate = 86400; // JOB_PAGE_REVALIDATE_S (app/lib/backend.ts); must be a literal.
// An empty list is what lets listings not built at deploy be cached on their first visit.
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const slug = (await params).id;
  // A landing slug with a 10-digit run would skip the rewrite. None has one; this keeps it a 404.
  if (landingBySlug("jobs", slug)) return { title: "Job Not Found", robots: { index: false, follow: true } };
  return listingMetadata(slug);
}

export default async function Page({ params }: Props) {
  const slug = (await params).id;
  if (landingBySlug("jobs", slug)) notFound();
  return <Listing slug={slug} />;
}
