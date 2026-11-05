import LandingPage, { landingMetadata, type LandingProps } from "@/app/components/landing/LandingPage";
import { landingBySlug } from "@/app/lib/landing/catalogue";
import { Listing, listingMetadata } from "../../[id]/listing";

// Never linked: next.config.mjs rewrites /jobs/<slug> here when the slug is one segment without
// the long number the board puts on listings (and redirects anyone who types /jobs/landing/... back).
// A landing page from app/lib/landing/catalogue.ts reads the query string (?page=) and the request,
// so it renders per request, which /jobs/[id] cannot since it is cached. Anything else is a
// listing whose slug an admin wrote by hand: the same page as /jobs/[id], rendered per request.
type Props = LandingProps & { params: Promise<{ slug: string }> };

export async function generateMetadata({ params, searchParams }: Props) {
  const slug = (await params).slug;
  if (landingBySlug("jobs", slug)) return landingMetadata("jobs", slug, { searchParams });
  return listingMetadata(slug);
}

export default async function Page({ params, searchParams }: Props) {
  const slug = (await params).slug;
  if (landingBySlug("jobs", slug)) return <LandingPage kind="jobs" slug={slug} searchParams={searchParams} />;
  return <Listing slug={slug} />;
}
