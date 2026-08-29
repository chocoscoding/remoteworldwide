"use client";

// Active sessions — moved here from the standalone /sessions page.
//
// The data and the endpoints are unchanged (/api/sessions/mine, /api/sessions
// and the DELETE routes); only the surroundings are. Two things fall away by
// living inside the dashboard: the sign-in prompt (the dashboard layout
// already gates auth) and react-toastify (the dashboard uses sonner).

import { FC, useCallback, useEffect, useState } from "react";
import { LoaderCircle, Monitor } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/lib/authClient";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { SettingsSection } from "@/app/components/dashboard/settings/settings-ui";

interface SessionDto {
  sessionId: string;
  userId: string;
  provider: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  online: boolean;
  current: boolean;
  user?: { id: string; name: string | null; email: string | null; image: string | null; role: string } | null;
}

const describeDevice = (userAgent: string | null): string => {
  if (!userAgent) return "Unknown device";
  if (/mobile|android|iphone/i.test(userAgent)) return "Mobile browser";
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/chrome\//i.test(userAgent)) return "Chrome";
  if (/firefox\//i.test(userAgent)) return "Firefox";
  if (/safari\//i.test(userAgent)) return "Safari";
  if (/curl|postman/i.test(userAgent)) return "API client";
  return userAgent.slice(0, 40);
};

const formatWhen = (iso: string): string => new Date(iso).toLocaleString();

const SessionsClient: FC = () => {
  const { status } = useSession();

  const [mySessions, setMySessions] = useState<SessionDto[] | null>(null);

  const load = useCallback(async () => {
    const mine = await fetch("/api/sessions/mine").then((response) => (response.ok ? response.json() : null));
    setMySessions(mine?.data ?? []);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Deferred into the promise chain rather than called straight from the
    // effect body — react-hooks rejects setState reachable synchronously from
    // an effect, since it can cascade renders.
    let cancelled = false;
    void (async () => {
      const mine = await fetch("/api/sessions/mine").then((response) => (response.ok ? response.json() : null));
      if (!cancelled) setMySessions(mine?.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const revoke = async (session: SessionDto) => {
    const path = `/api/sessions/mine/${session.sessionId}`;
    const response = await fetch(path, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Could not revoke that session");
      return;
    }
    toast.success("Session revoked");
    // Revoking the login this browser is using: finish the job locally too.
    if (session.current) {
      await signOut({ callbackUrl: "/" });
      return;
    }
    void load();
  };

  const renderRow = (session: SessionDto) => (
    <div
      key={session.sessionId}
      className="flex flex-col gap-3 border-b border-black/8 px-6 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
          <Monitor className="h-4 w-4 text-black/55" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-primary">
            {describeDevice(session.userAgent)}
            {session.provider && <span className="font-normal text-black/55">via {session.provider}</span>}
            {session.current && (
              <span className="rounded-full bg-[#e1f073] px-2 py-0.5 text-[11px] font-bold text-primary">This device</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-black/55">
            {session.ip ? `${session.ip} · ` : ""}last seen {formatWhen(session.lastSeenAt)} · signed in{" "}
            {formatWhen(session.createdAt)}
          </p>
        </div>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
            session.online ? "bg-[#e1f073] text-primary" : "bg-[#f0f0ea] text-black/60"
          )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", session.online ? "bg-[#6c7a1e]" : "bg-black/35")} />
          {session.online ? "Online" : "Idle"}
        </span>
        <StickerButton variant="outline" size="sm" onClick={() => revoke(session)}>
          {session.current ? "Sign out" : "Revoke"}
        </StickerButton>
      </div>
    </div>
  );

  if (status === "loading" || (status === "authenticated" && mySessions === null)) {
    return (
      <SettingsSection title="Active sessions" description="Every device currently signed in to your account.">
        <div className="flex items-center justify-center px-6 py-12">
          <LoaderCircle className="h-5 w-5 animate-spin text-black/40" />
        </div>
      </SettingsSection>
    );
  }

  return (
    <>
      <SettingsSection
        title="Active sessions"
        description="Every device currently signed in to your account. Revoking one signs that device out within moments.">
        {mySessions && mySessions.length > 0 ? (
          mySessions.map((session) => renderRow(session))
        ) : (
          <p className="px-6 py-8 text-sm leading-relaxed text-black/55">
            No registered sessions yet — sessions created before this feature appear after your next sign-in.
          </p>
        )}
      </SettingsSection>

    </>
  );
};

export default SessionsClient;
