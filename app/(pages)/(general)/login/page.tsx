import LoginForm from "@/app/components/auth/LoginForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { safeNext } from "@/app/lib/next-url";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const authenticated = await auth();
  if (authenticated?.user) {
    redirect(next);
  }
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <LoginForm embedded oauthCallbackUrl={next} />
      </div>
    </div>
  );
}
