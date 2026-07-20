"use client";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

/**
 * Logs every client-side session status transition
 * (loading -> authenticated/unauthenticated) to the browser console.
 * Renders nothing; mounted once inside SessionProvider in the root layout.
 */
const AuthSessionLogger = () => {
  const { status, data } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      console.info(`[auth] session status: authenticated`, {
        email: data?.user?.email,
        role: data?.user?.role,
      });
    } else {
      console.info(`[auth] session status: ${status}`);
    }
  }, [status, data?.user?.email, data?.user?.role]);

  return null;
};

export default AuthSessionLogger;
