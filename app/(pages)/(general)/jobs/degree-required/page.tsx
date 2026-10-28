import LandingPage, { landingMetadata, type LandingProps } from "@/app/components/landing/LandingPage";

// A landing page from app/lib/landing/catalogue.ts (its words, filter and whether it is live yet).
export const generateMetadata = (props: LandingProps) => landingMetadata("jobs", "degree-required", props);
export default function Page(props: LandingProps) {
  return <LandingPage kind="jobs" slug="degree-required" {...props} />;
}
