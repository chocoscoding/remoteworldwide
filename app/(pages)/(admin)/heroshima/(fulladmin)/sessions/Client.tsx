"use client";

// All active sessions, across every user.
//
// Deliberately NOT in the admin sidebar — reachable only by typing the URL.
// Access is enforced by app/(pages)/(admin)/heroshima/(fulladmin)/layout.tsx,
// which calls notFound() for anyone who isn't ADMIN, so being unlisted is
// discoverability, not the security boundary.
//
// Personal session management lives in the dashboard at
// /dashboard/settings/sessions; this page is the fleet-wide view.

import { FC, useCallback, useEffect, useState } from "react";
import { LoaderCircle, Monitor, ShieldAlert } from "lucide-react";
import { toast } from "react-toastify";

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

const AdminSessionsClient: FC = () => {
  const [sessions, setSessions] = useState<SessionDto[] | null>(null);

  const load = useCallback(async () => {
    const all = await fetch("/api/sessions").then((response) => (response.ok ? response.json() : null));
    setSessions(all?.data ?? []);
  }, []);

  useEffect(() => {
    // Deferred into the promise chain: react-hooks rejects setState reachable
    // synchronously from an effect body.
    let cancelled = false;
    void (async () => {
      const all = await fetch("/api/sessions").then((response) => (response.ok ? response.json() : null));
      if (!cancelled) setSessions(all?.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const revoke = async (session: SessionDto) => {
    const response = await fetch(`/api/sessions/${session.sessionId}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Could not revoke that session");
      return;
    }
    toast.success("Session revoked");
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

  return (
    <div className="w-full h-screen overflow-y-scroll p-4">
      <h1 className="text-2xl font-bold mb-4">All Active Sessions</h1>

      <section className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm max-w-screen-lg">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-primary">Everyone currently logged in</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          &quot;Online&quot; means activity in the last 15 minutes. Revoking signs that device out within moments.
        </p>

        {sessions === null ? (
          <div className="flex items-center justify-center py-12">
            <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-8 text-sm text-gray-500">No active sessions.</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Monitor className="mt-1 h-5 w-5 flex-none text-gray-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {describeDevice(session.userAgent)}
                      {session.provider && <span className="text-gray-500"> · via {session.provider}</span>}
                    </p>
                    {session.user && (
                      <p className="truncate text-sm text-gray-600">
                        {session.user.name ?? "Unnamed"} · {session.user.email} · {session.user.role}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {session.ip ? `${session.ip} · ` : ""}last seen {formatWhen(session.lastSeenAt)} · signed in{" "}
                      {formatWhen(session.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-none flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                      session.online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${session.online ? "bg-green-500" : "bg-gray-400"}`} />
                    {session.online ? "Online" : "Idle"}
                  </span>
                  <button
                    type="button"
                    onClick={() => revoke(session)}
                    className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-500 hover:bg-gray-50">
                    Revoke
                  </button>
                  {session.user && (
                    <button
                      type="button"
                      onClick={() => revokeAllForUser(session.user!.id)}
                      className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700">
                      Sign out everywhere
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminSessionsClient;
