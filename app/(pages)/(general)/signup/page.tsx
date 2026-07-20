import SignupForm from "@/app/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <SignupForm />
      </div>
    </div>
  );
}
