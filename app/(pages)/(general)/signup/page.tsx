import SignupForm from "@/app/components/auth/SignupForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { safeNext } from "@/app/lib/next-url";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const asked = (await searchParams).next;
  const authenticated = await auth();
  if (authenticated?.user) {
    // Already signed in: where they asked, else home, as before — setup is for new accounts.
    redirect(safeNext(asked));
  }
  // A new account goes back where it came from, else home (owner, 2026-10-01: for now, not setup
  // at ONBOARDING_PATH). The dashboard's banner still nudges setup, and its layout sends an
  // unconfirmed account to /verify-email on the way in.
  const next = safeNext(asked);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <SignupForm oauthCallbackUrl={next} />
      </div>
    </div>
  );
}
