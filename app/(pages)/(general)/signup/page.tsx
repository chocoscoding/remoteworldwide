import SignupForm from "@/app/components/auth/SignupForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ONBOARDING_PATH, safeNext } from "@/app/lib/next-url";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const asked = (await searchParams).next;
  const authenticated = await auth();
  if (authenticated?.user) {
    // Already signed in: where they asked, else home, as before — setup is for new accounts.
    redirect(safeNext(asked));
  }
  // A new account goes to setup (a resume and a profile) unless a safe `next` says otherwise;
  // an unconfirmed one is sent on to /verify-email from there, and comes back after the link.
  const next = safeNext(asked, ONBOARDING_PATH);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <SignupForm oauthCallbackUrl={next} />
      </div>
    </div>
  );
}
