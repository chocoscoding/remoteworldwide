"use client";

import { LoaderCircle, Monitor, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { signOut } from "@/app/lib/authClient";
import { useAuthModal } from "@/app/components/auth/AuthModalProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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

const OnlineBadge = ({ online }: { online: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
      online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
    }`}>
    <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-green-500" : "bg-gray-400"}`} />
    {online ? "Online" : "Idle"}
  </span>
);

export default function SessionsPage() {
  const { openAuthModal } = useAuthModal();
  const { status, data } = useSession();
  const isAdmin = data?.user?.role === "ADMIN";

  const [mySessions, setMySessions] = useState<SessionDto[] | null>(null);
  const [allSessions, setAllSessions] = useState<SessionDto[] | null>(null);

  const load = useCallback(async () => {
    const mine = await fetch("/api/sessions/mine").then((response) => (response.ok ? response.json() : null));
    setMySessions(mine?.data ?? []);
    if (isAdmin) {
      const all = await fetch("/api/sessions").then((response) => (response.ok ? response.json() : null));
      setAllSessions(all?.data ?? []);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (status === "unauthenticated") openAuthModal("login");
    if (status === "authenticated") void load();
  }, [status, openAuthModal, load]);

  const revoke = async (session: SessionDto, adminScope: boolean) => {
    const path = adminScope ? `/api/sessions/${session.sessionId}` : `/api/sessions/mine/${session.sessionId}`;
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

  const revokeAllForUser = async (userId: string) => {
    const response = await fetch(`/api/sessions/user/${userId}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Could not revoke that user's sessions");
      return;
    }
    toast.success("User signed out everywhere");
    void load();
  };

  if (status === "loading" || (status === "authenticated" && mySessions === null)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle className="animate-spin text-primary" />
      </div>
    );
  }
  if (status !== "authenticated") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">Sign in to view your sessions.</p>
        <Button onClick={() => openAuthModal("login")}>Sign In</Button>
      </div>
    );
  }

  const renderRow = (session: SessionDto, adminScope: boolean) => (
    <div
      className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
      key={session.sessionId}>
      <div className="flex items-start gap-3">
        <Monitor className="mt-1 h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">
            {describeDevice(session.userAgent)}
            {session.provider ? <span className="text-muted-foreground"> · via {session.provider}</span> : null}
            {session.current ? <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">This device</span> : null}
          </p>
          {adminScope && session.user ? (
            <p className="text-muted-foreground text-sm">
              {session.user.name ?? "Unnamed"} · {session.user.email} · {session.user.role}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {session.ip ? `${session.ip} · ` : ""}last seen {formatWhen(session.lastSeenAt)} · signed in {formatWhen(session.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <OnlineBadge online={session.online} />
        <Button onClick={() => revoke(session, adminScope)} size="sm" variant="outline">
          {session.current ? "Sign out" : "Revoke"}
        </Button>
        {adminScope && session.user ? (
          <Button onClick={() => revokeAllForUser(session.user!.id)} size="sm" variant="destructive">
            Sign out everywhere
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-lg">Your active sessions</h2>
          <p className="text-muted-foreground text-sm">
            Every device currently signed in to your account. Revoking one signs that device out within moments.
          </p>
        </CardHeader>
        <CardContent>
          {mySessions && mySessions.length > 0 ? (
            mySessions.map((session) => renderRow(session, false))
          ) : (
            <p className="text-muted-foreground text-sm">
              No registered sessions yet — sessions created before this feature appear after your next sign-in.
            </p>
          )}
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">All active sessions (admin)</h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Everyone currently logged in. &quot;Online&quot; means activity in the last 15 minutes.
            </p>
          </CardHeader>
          <CardContent>
            {allSessions && allSessions.length > 0 ? (
              allSessions.map((session) => renderRow(session, true))
            ) : (
              <p className="text-muted-foreground text-sm">No active sessions.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
