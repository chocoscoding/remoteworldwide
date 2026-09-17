import ResetPasswordClient from "./Client";

export const metadata = { title: "Set a new password" };

/**
 * The link people are actually sent is `/reset-password?token=…`, which the route below redirects
 * here. This path exists because it reads better if anyone types or shares it.
 */
export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  return <ResetPasswordClient token={(await params).token} />;
}
