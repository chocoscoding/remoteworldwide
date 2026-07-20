import LoginForm from "@/app/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
