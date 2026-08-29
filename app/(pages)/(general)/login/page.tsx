import LoginForm from "@/app/components/auth/LoginForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const authenticated = await auth();
  if (authenticated?.user) {
    redirect("/");
  }
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <LoginForm embedded />
      </div>
    </div>
  );
}
