import LandingPage, { landingMetadata } from "@/app/components/landing/LandingPage";
import { landingBySlug } from "@/app/lib/landing/catalogue";
import { Listing, listingMetadata } from "../../[id]/listing";

// Never linked: next.config.mjs rewrites /jobs/<slug> here when the slug is one segment without a
// listing's mark (a long number, or "-<8 hex>" at the end), and ./[page] when it has ?page=N
// (redirecting anyone who types /jobs/landing/... back). This is page 1 of a landing page from
// app/lib/landing/catalogue.ts (/jobs/europe, /jobs/latest, ...), or a listing whose slug an admin
// wrote by hand: the same page as /jobs/[id].
//
// Cached like the listings: built on the first visit, then served from the cache and rebuilt at
// most once an hour (LANDING_REVALIDATE), or after an admin's listing write expires BOARD_TAGS.jobs.
// Until 2026-11-23 it read ?page= and the request, so it rendered on every visit, crawlers and the
// navbar's prefetches included: ~24K function runs in 12 hours (Vercel). Nothing it renders may read
// the request (searchParams, cookies, headers, backend()), or it is per request again.
export const revalidate = 3600; // LANDING_REVALIDATE (app/lib/landing/catalogue.ts); must be a literal.
// An empty list is what lets a slug not built at deploy be cached on its first visit.
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const slug = (await params).slug;
  if (landingBySlug("jobs", slug)) return landingMetadata("jobs", slug, undefined);
  return listingMetadata(slug);
}

export default async function Page({ params }: Props) {
  const slug = (await params).slug;
  if (landingBySlug("jobs", slug)) return <LandingPage kind="jobs" slug={slug} page={undefined} />;
  return <Listing slug={slug} />;
}
