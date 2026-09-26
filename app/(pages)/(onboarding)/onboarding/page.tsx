import { askedNext, onboardingSession } from "../guard";
import { ONBOARDING_PATH } from "@/app/lib/next-url";
import OnboardingClient from "./Client";

export const metadata = { title: "Set up your account" };

/**
 * The profile the extension and chat work from (name, email, About, education, headline,
 * location, three skills), optionally started from a resume. Guidance, never a lock: where signup
 * and email confirmation land, where the extension's "Finish your profile" links and chat's "this
 * is missing" buttons open (`#<itemId>` lands on that field), and where the dashboard's banner
 * points — never forced on anyone.
 *
 * `?next=` (a safe same-site path only) is where "Skip for now" and, once done, "Continue" go.
 */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = askedNext((await searchParams).next);
  const user = await onboardingSession(ONBOARDING_PATH, next);
  return <OnboardingClient next={next || null} email={user.email ?? null} />;
}
