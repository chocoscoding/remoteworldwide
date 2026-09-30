import { redirect } from "next/navigation";
import ResetPasswordClient from "./[token]/Client";

export const metadata = { title: "Set a new password" };

/**
 * Where the emailed link lands: `/reset-password?token=…`.
 *
 * The token stays in the query rather than the path so it never reaches the server as part of a
 * route segment — and a link with no token at all sends people somewhere useful instead of showing
 * a form that cannot work.
 */
export default async function ResetPasswordEntry({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token;
  if (!token) redirect("/forgot-password");

  return <ResetPasswordClient token={token} />;
}
