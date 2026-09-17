"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { signOut } from "@/app/lib/authClient";
import { Button } from "@/components/ui/button";
import AuthNotice from "@/app/components/auth/AuthNotice";
import { brutalistLink } from "@/app/components/auth/authStyles";

type Phase = "confirming" | "waiting" | "failed";

/**
 * The one screen an unverified account can reach.
 *
 * It does two jobs, because they are two halves of the same moment: it redeems a link when one is in
 * the URL, and otherwise explains what is being waited for and offers to send another.
 */
export default function VerifyEmailClient({ token, email }: { token?: string; email: string | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(token ? "confirming" : "waiting");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // React 18 mounts twice in development, and redeeming a single-use link twice would spend it and
  // then report it as already used.
  const redeemed = useRef(false);

  useEffect(() => {
    if (!token || redeemed.current) return;
    redeemed.current = true;

    void (async () => {
      const response = await fetch("/api/users/verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        setPhase("failed");
        return;
      }

      toast.success("Email confirmed");
      // The session still says unverified until its token refreshes, and the backend re-reads that
      // flag while it is false — so a full navigation is what makes the dashboard open.
      window.location.href = "/dashboard";
    })();
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/users/verification/resend", { method: "POST" });
      const payload = await response.json().catch(() => null);

      if (response.status === 429) {
        toast.info(payload?.message ?? "We just sent one. Give it a moment.");
        setCooldown(60);
        return;
      }
      if (!response.ok) {
        toast.error(payload?.message ?? "Could not send that link");
        return;
      }
      if (payload?.data?.sent === false) {
        // Already verified, on a tab left open since before it was.
        window.location.href = "/dashboard";
        return;
      }

      toast.success("Sent. Check your inbox.");
      setCooldown(60);
    } finally {
      setSending(false);
    }
  };

  if (phase === "confirming") {
    return <AuthNotice title="Confirming your email…" subtitle="One moment." />;
  }

  if (phase === "failed") {
    return (
      <AuthNotice
        title="That link has expired"
        subtitle="Verification links work once, and only for a while. Send yourself a fresh one."
        footer={
          <p className="text-pretty text-center text-gray-600 text-sm">
            <button className={brutalistLink} disabled={sending} onClick={resend} type="button">
              {sending ? "Sending…" : "Send a new link"}
            </button>
          </p>
        }
      />
    );
  }

  return (
    <AuthNotice
      title="Confirm your email"
      subtitle={
        <>
          We sent a link to <span className="font-bold">{email ?? "your address"}</span>. Open it and
          your account is ready.
        </>
      }
      footer={
        <p className="text-pretty text-center text-gray-600 text-sm">
          Wrong address, or not your account?{" "}
          <button className={brutalistLink} onClick={() => signOut({ callbackUrl: "/" })} type="button">
            Sign out
          </button>
        </p>
      }>
      <Button
        className="w-full rounded-md font-bold"
        disabled={sending || cooldown > 0}
        onClick={resend}
        type="button"
        variant="brutalist-accent">
        {sending ? "Sending…" : cooldown > 0 ? `Send again in ${cooldown}s` : "Send it again"}
      </Button>
      <p className="text-center text-gray-600 text-sm">
        Already confirmed it?{" "}
        <button className={brutalistLink} onClick={() => router.refresh()} type="button">
          Refresh
        </button>
      </p>
    </AuthNotice>
  );
}
