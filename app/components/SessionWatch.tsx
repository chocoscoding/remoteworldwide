"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "@/app/lib/authClient";
import { createSessionWatch, SESSION_REFUSED_EVENT } from "@/app/lib/auth/sessionEnded";
import { loginAfterSessionEnded } from "@/app/lib/next-url";

/**
 * Signs this tab out when the backend has ended its session (app/lib/auth/sessionEnded.ts says how
 * that is told apart from any other 401). Sign-out clears the cookie and the query cache, tells the
 * other open tabs, and lands on sign-in with a way back to this page. Renders nothing; mounted once
 * inside SessionProvider in the root layout.
 */
const SessionWatch = () => {
  const { status } = useSession();
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const onRefused = createSessionWatch({
      isSignedIn: () => statusRef.current === "authenticated",
      onEnded: () => {
        console.info("[auth] the backend ended this session, signing out");
        return signOut({ callbackUrl: loginAfterSessionEnded(`${window.location.pathname}${window.location.search}`) });
      },
    });
    const handle = () => void onRefused();
    window.addEventListener(SESSION_REFUSED_EVENT, handle);
    return () => window.removeEventListener(SESSION_REFUSED_EVENT, handle);
  }, []);

  return null;
};

export default SessionWatch;
