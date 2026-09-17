import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ForgotPasswordClient from "./Client";

export const metadata = { title: "Forgot your password?" };

export default async function ForgotPasswordPage() {
  // Someone already signed in does not need this route; they change their password in settings.
  const session = await auth();
  if (session?.user) redirect("/dashboard/settings/account");

  return <ForgotPasswordClient />;
}
