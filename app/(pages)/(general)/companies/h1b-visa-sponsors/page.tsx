import LandingPage, { landingMetadata, type LandingProps } from "@/app/components/landing/LandingPage";

// A landing page from app/lib/landing/catalogue.ts (its words, filter and whether it is live yet).
export const generateMetadata = (props: LandingProps) => landingMetadata("companies", "h1b-visa-sponsors", props);
export default function Page(props: LandingProps) {
  return <LandingPage kind="companies" slug="h1b-visa-sponsors" {...props} />;
}
