import LandingPage, { landingMetadata } from "@/app/components/landing/LandingPage";

// Page 1 of a two-segment landing page (/jobs/software-engineer/europe, /jobs/senior/product,
// /jobs/h1b/design: app/lib/landing/catalogue.ts). ?page=N is rewritten to ./[page] by
// next.config.mjs, because a cached page may not read the query string. Cached like the one-segment
// landings (../../landing/[slug]): rebuilt at most once an hour, or after an admin's listing write.
export const revalidate = 3600; // LANDING_REVALIDATE (app/lib/landing/catalogue.ts); must be a literal.
// An empty list is what lets a landing not built at deploy be cached on its first visit.
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string; segment: string }> };

export async function generateMetadata({ params }: Props) {
  const { id, segment } = await params;
  return landingMetadata("jobs", `${id}/${segment}`, undefined);
}

export default async function Page({ params }: Props) {
  const { id, segment } = await params;
  return <LandingPage kind="jobs" slug={`${id}/${segment}`} page={undefined} />;
}
