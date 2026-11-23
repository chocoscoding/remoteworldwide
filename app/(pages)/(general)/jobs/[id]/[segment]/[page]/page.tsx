import LandingPage, { landingMetadata } from "@/app/components/landing/LandingPage";

// /jobs/<role>/<region>?page=N (and the other two-segment landings), which next.config.mjs rewrites
// here so the page number is part of the path. Cached like ../page.tsx; a bad or too high number is
// a 404 (LandingPage). Typed directly, /jobs/a/b/2 redirects to /jobs/a/b?page=2.
export const revalidate = 3600; // LANDING_REVALIDATE (app/lib/landing/catalogue.ts); must be a literal.
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string; segment: string; page: string }> };

export async function generateMetadata({ params }: Props) {
  const { id, segment, page } = await params;
  return landingMetadata("jobs", `${id}/${segment}`, page);
}

export default async function Page({ params }: Props) {
  const { id, segment, page } = await params;
  return <LandingPage kind="jobs" slug={`${id}/${segment}`} page={page} />;
}
