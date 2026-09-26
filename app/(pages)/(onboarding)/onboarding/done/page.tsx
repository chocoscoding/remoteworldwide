import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, FileCheck, Mail, MessagesSquare, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSettings } from "@/libs/settings";
import { ONBOARDING_PATH } from "@/app/lib/next-url";
import { ONBOARDING_DONE_PATH } from "@/app/lib/onboarding/api";
import OnboardingHeader from "@/app/components/onboarding/OnboardingHeader";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, STEP_CARD } from "@/app/components/onboarding/ui";
import { askedNext, onboardingSession, withNext } from "../../guard";

export const metadata = { title: "You're set" };

/** What a complete profile feeds in the extension. Nothing there was locked; these now have everything. */
const POWERED = [
  { icon: MousePointerClick, label: "Autofill" },
  { icon: FileCheck, label: "Resumes" },
  { icon: Mail, label: "Cover letters" },
  { icon: MessagesSquare, label: "Chat" },
] as const;

/**
 * Where onboarding lands when the checklist (seven profile items) completes. Arriving here is the
 * point: the page's client-side push to this route is the site navigation the extension hears
 * (`rww/visit`), and it asks the account again and drops its "Finish your profile" prompts.
 *
 * Checked, not trusted: someone who types this address with the list still open is sent back to
 * it. A backend that doesn't compute onboarding yet (or can't be read right now) shows the page —
 * the same fail-open rule as the extension's.
 */
export default async function OnboardingDonePage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = askedNext((await searchParams).next);
  const user = await onboardingSession(ONBOARDING_DONE_PATH, next);
  const settings = await getSettings().catch(() => null);
  if (settings?.onboarding && !settings.onboarding.ready) redirect(withNext(ONBOARDING_PATH, next));

  return (
    <>
      <OnboardingHeader email={user.email ?? null} />
      <main className="mx-auto flex w-full max-w-[1120px] justify-center px-4 pb-20 pt-10 md:px-8 md:pt-16">
        <section className={cn(STEP_CARD, "w-full max-w-xl p-6 text-center md:p-10")} aria-labelledby="onb-done-title">
          <span className="mx-auto grid h-14 w-14 place-content-center rounded-full border-[1.5px] border-primary bg-secondary" aria-hidden>
            <Check className="h-7 w-7 text-primary" strokeWidth={3} />
          </span>
          <h1 id="onb-done-title" className="mt-5 text-balance text-2xl font-bold tracking-tight text-primary md:text-3xl">
            You&apos;re set — go back to the extension
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-primary/65">
            Your profile is complete, so it can fill applications, build a resume for a job and answer questions about you. If its panel is open, it
            updates by itself.
          </p>

          <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="What your profile powers in the extension">
            {POWERED.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary2 px-3 py-1.5 text-xs font-semibold text-primary">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            {next ? (
              <>
                <Link href="/dashboard" className={BUTTON_SECONDARY}>
                  Go to your dashboard
                </Link>
                <Link href={next} className={BUTTON_PRIMARY}>
                  Continue where you were
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </>
            ) : (
              <Link href="/dashboard" className={BUTTON_PRIMARY}>
                Go to your dashboard
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
          <p className="mt-5 text-xs text-primary/50">
            Change any of it later in{" "}
            <Link href="/dashboard/settings/profile" className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
              Settings → Profile
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
