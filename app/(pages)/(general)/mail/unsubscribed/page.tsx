import type { Metadata } from "next";
import Link from "next/link";
import Eyebrow from "@/app/components/marketing/Eyebrow";
import UnsubscribeReason from "./UnsubscribeReason";

// Where a one-click unsubscribe link lands in a browser, once it has worked (MAIL-PLAN.md 5.4). The
// backend's GET /api/settings/unsubscribe switches the mail off first, then redirects here with the
// same `user`, `pref` and `token`, so the optional reason can be posted under that signed link. The
// unsubscribe never depends on this page.

export const metadata: Metadata = {
  title: "You're unsubscribed",
  robots: { index: false, follow: false },
};

/** What was switched off, as a sentence reads it. */
const PREF_PHRASES: Record<string, string> = {
  emailOffers: "offers and early access emails",
  emailProductNews: "product news emails",
  emailWeeklyDigest: "the weekly digest",
  emailReplyAlerts: "reply and status emails",
  emailPodActivity: "pod activity emails",
  pushStreakReminder: "streak reminders",
  pushInterviewReminder: "interview reminders",
};

const USER_ID = /^[a-f\d]{24}$/i;
const PREF = /^[A-Za-z]{2,40}$/;
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

export default async function MailUnsubscribedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, pref, token } = await searchParams;
  const signed = typeof user === "string" && USER_ID.test(user) && typeof pref === "string" && PREF.test(pref) && typeof token === "string" && TOKEN.test(token);
  const phrase = typeof pref === "string" ? PREF_PHRASES[pref] : undefined;

  return (
    <div className="bg-[#f9f8f1] text-primary">
      <section className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col justify-center px-4 py-16 md:py-24">
        <Eyebrow>Email settings</Eyebrow>
        <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">You&apos;re unsubscribed.</h1>
        <p className="mt-4 text-base leading-relaxed text-primary/70">
          You won&apos;t get {phrase ?? "these emails"} from us any more. Switch them back on any time in{" "}
          <Link href="/dashboard/settings/notifications" className="font-semibold text-primary underline decoration-1 underline-offset-2 hover:bg-secondary">
            your notification settings
          </Link>
          .
        </p>

        {signed ? <UnsubscribeReason user={user} pref={pref} token={token} /> : null}
      </section>
    </div>
  );
}
