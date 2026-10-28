"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useConsent } from "@/app/lib/consent/consent";
import { flush, startVisit, onClick, onSubmit, setIdentity, track } from "@/app/lib/tracking/tracker";

/** The admin's own screens are not what this is for. */
const UNTRACKED = /^\/(heroshima|print|probes)(\/|$)/;

/**
 * Starts the activity tracker (app/lib/tracking/tracker.ts) for every page of the site. Signed in,
 * everything the account does is recorded for the admin's users screen; signed out, only once the
 * visitor accepted analytics cookies, under a random id. Nothing renders.
 */
export default function ActivityTracker() {
  const pathname = usePathname();
  const { status } = useSession();
  const consent = useConsent();
  const mode: "user" | "anon" | "none" = status === "authenticated" ? "user" : status === "unauthenticated" && consent?.analytics ? "anon" : "none";
  const on = mode !== "none" && !UNTRACKED.test(pathname ?? "");

  useEffect(() => {
    setIdentity(on ? mode : "none");
    if (!on) return;
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onLeave = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      flush(true);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [on, mode]);

  useEffect(() => {
    if (!on || !pathname) return;
    if (startVisit()) track("session_start", "Visit started", document.referrer ? { referrer: refOf(document.referrer) } : undefined);
    track("page_view", pathname, document.referrer && isExternal(document.referrer) ? { referrer: refOf(document.referrer) } : undefined);
  }, [on, pathname]);

  return null;
}

const isExternal = (url: string) => {
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return false;
  }
};

/** Where a visit came from, origin and path only. */
const refOf = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.slice(0, 200);
  } catch {
    return "";
  }
};
