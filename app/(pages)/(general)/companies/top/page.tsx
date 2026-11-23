import LandingPage, { landingMetadata, type LandingProps } from "@/app/components/landing/LandingPage";

// A landing page from app/lib/landing/catalogue.ts (its words, filter and whether it is live yet).
export const generateMetadata = async ({ searchParams }: LandingProps) =>
  landingMetadata("companies", "top", (await searchParams).page);
export default async function Page({ searchParams }: LandingProps) {
  return <LandingPage kind="companies" slug="top" page={(await searchParams).page} />;
}
