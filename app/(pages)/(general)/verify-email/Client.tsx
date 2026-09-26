"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import { signOut } from "@/app/lib/authClient";
import { Button } from "@/components/ui/button";
import AuthNotice from "@/app/components/auth/AuthNotice";
import { brutalistLink } from "@/app/components/auth/authStyles";
import { ONBOARDING_PATH } from "@/app/lib/next-url";

type Phase = "confirming" | "waiting" | "failed";

/** When the resend cooldown ends, as epoch ms — kept so a reload carries on counting down. */
const RESEND_UNTIL_KEY = "rww.verify-email.resend-until";

// Read through useSyncExternalStore, as LeadMagnetCard does: the server renders 0, hydration agrees,
// and the stored value takes over straight after — no mismatch and no setState in an effect.
const noopSubscribe = () => () => {};
const readStoredUntil = () => {
  try {
    return Number(window.localStorage.getItem(RESEND_UNTIL_KEY)) || 0;
  } catch {
    // Storage blocked (private window, cleared site data): the resend still refuses inside the window.
    return 0;
  }
};
const serverUntil = () => 0;

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
  const storedUntil = useSyncExternalStore(noopSubscribe, readStoredUntil, serverUntil);
  // Kept alongside the stored copy so the countdown still works when storage refuses the write.
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const cooldown = Math.max(0, Math.ceil((Math.max(storedUntil, until) - now) / 1000));
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
      // flag while it is false — so a full navigation is what lets the next page open. That page is
      // setup (a resume and a profile), where a confirmed new account goes first; anyone already
      // done there is told so and offered Continue.
      window.location.href = ONBOARDING_PATH;
    })();
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [cooldown, now]);

  const startCooldown = (seconds: number) => {
    const end = Date.now() + seconds * 1000;
    setUntil(end);
    setNow(Date.now());
    try {
      window.localStorage.setItem(RESEND_UNTIL_KEY, String(end));
    } catch {
      // As above: the countdown just won't survive a reload.
    }
  };

  const resend = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/users/verification/resend", { method: "POST" });
      const payload = await response.json().catch(() => null);

      if (response.status === 429) {
        toast.info(payload?.message ?? "We just sent one. Give it a moment.");
        startCooldown(payload?.data?.retryInSeconds ?? 60);
        return;
      }
      if (!response.ok) {
        toast.error(payload?.message ?? "Could not send that link");
        return;
      }
      if (payload?.data?.sent === false) {
        // Already verified, on a tab left open since before it was: on to setup, as a fresh confirmation goes.
        window.location.href = ONBOARDING_PATH;
        return;
      }

      toast.success("Sent. Check your inbox.");
      startCooldown(payload?.data?.retryInSeconds ?? 60);
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
