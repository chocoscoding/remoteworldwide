"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "@/app/lib/authClient";
import { sessionEnded } from "@/app/lib/auth/sessionEnded";

/**
 * The sign-in page after the backend ended a session (`?ended=1`).
 *
 * A server action that found the session refused lands here by a client-side navigation, so this
 * tab still holds the old session and its cookie. It checks once with the backend that the session
 * really is gone, then signs out where it stands: the cookie is cleared (so no action from here on
 * carries it, which is also what stops any redirect loop), the navbar and the query cache let go of
 * the old account, and the other open tabs hear of it. A tab that already signed out on the way
 * here (SessionWatch) has nothing left to do, and only shows the line.
 */
export default function SessionEndedNotice() {
  const { status } = useSession();
  const started = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || started.current) return;
    started.current = true;
    void (async () => {
      if (await sessionEnded()) await signOut({ redirect: false });
    })();
  }, [status]);

  return (
    <p role="status" className="mb-4 rounded-md border-2 border-black bg-white px-3 py-2 font-semibold text-sm">
      You were signed out. Sign in again to continue.
    </p>
  );
}
