import LandingPage, { landingMetadata } from "@/app/components/landing/LandingPage";
import { landingBySlug } from "@/app/lib/landing/catalogue";
import { Listing, listingMetadata } from "../../../[id]/listing";

// /jobs/<slug>?page=N, which next.config.mjs rewrites here so the page number is part of the path:
// a cached page may not read the query string. Cached like ../page.tsx (page 1); a bad or too high
// number is a 404 (LandingPage). A hand-written listing slug with a ?page= shows its listing, as
// it did before the rewrite.
export const revalidate = 3600; // LANDING_REVALIDATE (app/lib/landing/catalogue.ts); must be a literal.
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string; page: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug, page } = await params;
  if (landingBySlug("jobs", slug)) return landingMetadata("jobs", slug, page);
  return listingMetadata(slug);
}

export default async function Page({ params }: Props) {
  const { slug, page } = await params;
  if (landingBySlug("jobs", slug)) return <LandingPage kind="jobs" slug={slug} page={page} />;
  return <Listing slug={slug} />;
}
