import LoginForm from "@/app/components/auth/LoginForm";
import SessionEndedNotice from "@/app/components/auth/SessionEndedNotice";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { safeNext, SESSION_ENDED_PARAM } from "@/app/lib/next-url";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; [SESSION_ENDED_PARAM]?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const authenticated = await auth();
  if (authenticated?.user) {
    redirect(next);
  }
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Sent here because the backend ended the session (app/lib/auth/sessionEndedAction.ts). */}
        {params[SESSION_ENDED_PARAM] === "1" && <SessionEndedNotice />}
        <LoginForm embedded oauthCallbackUrl={next} />
      </div>
    </div>
  );
}
