import type { Metadata } from "next";
import { ONBOARDING_PATH } from "@/app/lib/next-url";
import { askedNext, onboardingSession } from "./guard";
import OnboardingClient from "./Client";

export const metadata: Metadata = { title: "Set up your account", robots: { index: false, follow: false } };

/**
 * The profile the extension and chat work from (name, email, About, education, headline,
 * location, three skills; work experience too, optionally), started from a resume if there is one.
 * Guidance, never a lock: where signup and email confirmation land, where the extension's "Finish
 * your profile" links and chat's "this is missing" buttons open (`#<itemId>` lands on that field),
 * and where the dashboard's banner points — never forced on anyone.
 *
 * Inside the dashboard (owner, 2026-09-27): the sidebar stays, with no item of its own for this,
 * and nothing sits above the page — no banner, no header bar. `/onboarding` redirects here.
 *
 * `?next=` (a safe same-site path only) is where "Skip for now" and, once done, "Continue" go.
 */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = askedNext((await searchParams).next);
  await onboardingSession(ONBOARDING_PATH, next);
  return <OnboardingClient next={next || null} />;
}
