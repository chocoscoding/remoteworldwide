import LandingPage, { landingMetadata, type LandingProps } from "@/app/components/landing/LandingPage";

// A landing page from app/lib/landing/catalogue.ts (its words, filter and whether it is live yet).
export const generateMetadata = (props: LandingProps) => landingMetadata("jobs", "h1b-visa-sponsor", props);
export default function Page(props: LandingProps) {
  return <LandingPage kind="jobs" slug="h1b-visa-sponsor" {...props} />;
}
