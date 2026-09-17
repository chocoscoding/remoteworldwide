"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import AuthNotice from "@/app/components/auth/AuthNotice";
import PasswordStrength from "@/app/components/auth/PasswordStrength";
import { brutalistInput, brutalistLink } from "@/app/components/auth/authStyles";
import { evaluatePassword } from "@/app/lib/auth/password-strength";

/**
 * Setting a new password from an emailed link.
 *
 * Every session is revoked when this succeeds, including any the person is currently holding, so it
 * finishes at the login screen rather than pretending they are still signed in.
 */
export default function ResetPasswordClient({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [spent, setSpent] = useState(false);

  const strength = evaluatePassword(password);
  const matches = confirm.length > 0 && confirm === password;
  const canSubmit = strength.meetsRequirements && matches && !submitting;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/users/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        // A spent or expired link is the common failure here, and it needs its own way out rather
        // than a toast that leaves someone staring at a form that will never work.
        if (response.status === 400) setSpent(true);
        else toast.error(payload?.message ?? "Could not set your password");
        return;
      }

      toast.success("Password set. Sign in with it.");
      router.push("/login");
    } finally {
      setSubmitting(false);
    }
  };

  if (spent) {
    return (
      <AuthNotice
        title="That link has expired"
        subtitle="Reset links work once, and only for a short while. Ask for a fresh one and it will be with you in a moment."
        footer={
          <p className="text-pretty text-center text-gray-600 text-sm">
            <Link className={brutalistLink} href="/forgot-password">
              Send me a new link
            </Link>
          </p>
        }
      />
    );
  }

  return (
    <AuthNotice title="Set a new password" subtitle="Choose something you have not used here before.">
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label className="font-bold" htmlFor="reset-password">
            New password
          </Label>
          <Input
            autoComplete="new-password"
            className={cn(brutalistInput)}
            id="reset-password"
            onBlur={() => setTouched(true)}
            onChange={(event) => {
              setPassword(event.target.value);
              setTouched(true);
            }}
            required
            type="password"
            value={password}
          />
          <PasswordStrength id="reset-password" open={touched} password={password} />
        </div>

        <div className="space-y-2">
          <Label className="font-bold" htmlFor="reset-confirm">
            Confirm password
          </Label>
          <Input
            autoComplete="new-password"
            className={cn(brutalistInput)}
            id="reset-confirm"
            onChange={(event) => setConfirm(event.target.value)}
            required
            type="password"
            value={confirm}
          />
          {confirm.length > 0 && !matches ? <p className="text-red-600 text-sm">Those do not match.</p> : null}
        </div>

        <Button className="w-full rounded-md font-bold" disabled={!canSubmit} type="submit" variant="brutalist-accent">
          {submitting ? "Setting…" : "Set my password"}
        </Button>

        <p className="text-center text-gray-600 text-xs">
          Every device signed into this account will be signed out.
        </p>
      </form>
    </AuthNotice>
  );
}
