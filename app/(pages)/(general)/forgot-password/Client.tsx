"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import AuthNotice from "@/app/components/auth/AuthNotice";
import { brutalistInput, brutalistLink } from "@/app/components/auth/authStyles";

/**
 * Asking for a reset link.
 *
 * The screen deliberately says the same thing whatever happens, matching the API: whether an address
 * has an account is not a question we answer, and a form that said "no such user" would answer it.
 */
export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/users/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Shown whether or not that address exists, and whether or not the request even succeeded:
      // a failure that looked different would leak the same thing a success would.
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthNotice
        title="Check your inbox"
        subtitle={
          <>
            If <span className="font-bold">{email}</span> has an account, a link to set a new password
            is on its way. It works once, and for a short while.
          </>
        }>
        <p className="text-center text-gray-600 text-sm">
          Nothing arrived? Look in spam, then{" "}
          <button className={brutalistLink} onClick={() => setSent(false)} type="button">
            try a different address
          </button>
          .
        </p>
      </AuthNotice>
    );
  }

  return (
    <AuthNotice
      title="Forgot your password?"
      subtitle="Give us the address on your account and we will send a link to set a new one."
      footer={
        <p className="text-pretty text-center text-gray-600 text-sm">
          Remembered it?{" "}
          <Link className={brutalistLink} href="/login">
            Sign in
          </Link>
        </p>
      }>
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label className="font-bold" htmlFor="forgot-email">
            Email
          </Label>
          <Input
            autoComplete="email"
            className={cn(brutalistInput)}
            id="forgot-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </div>
        <Button className="w-full rounded-md font-bold" disabled={submitting} type="submit" variant="brutalist-accent">
          {submitting ? "Sending…" : "Send the link"}
        </Button>
      </form>
    </AuthNotice>
  );
}
