import { redirect } from "next/navigation";
import { auth } from "@/auth";
import VerifyEmailClient from "./Client";

export const metadata = { title: "Confirm your email" };

/**
 * Outside the dashboard group on purpose: this is where its layout sends an unverified account, and
 * a page inside that group would redirect to itself forever.
 *
 * Reachable without a session too, because a verification link can be opened in a browser that has
 * never signed in — on a phone, say, when the account was made on a laptop.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token;
  const session = await auth();

  // Nothing to do here, the same way /login bounces someone already signed in.
  if (!token && session?.user?.verified) redirect("/dashboard");
  if (!token && !session?.user) redirect("/login");

  return <VerifyEmailClient email={session?.user?.email ?? null} token={token} />;
}
