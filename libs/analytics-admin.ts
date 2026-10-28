"use server";

// The users and activity screens (/heroshima/users, /heroshima/activity) read the backend through
// these server actions, the waitlist-admin pattern (libs/waitlist-admin.ts): the admin's own
// session cookie is forwarded and the backend's isAdmin on /api/admin/analytics is the boundary;
// requireAdminAction refuses a non-admin here first. Server to backend, so no rewrite exists.

import { requireAdminAction } from "@/app/lib/auth/action-guards";
import { backend, idSegment } from "@/app/lib/backend";
import {
  TRACK_KINDS,
  USER_SORTS,
  type ActivityOverview,
  type AdminUserDetail,
  type AdminUserList,
  type EventPage,
  type UserSort,
} from "@/app/lib/tracking/types";

const analytics = <T>(path: string) => backend<T>(`/admin/analytics${path}`, { session: true });

const int = (value: unknown, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(value)) || fallback));

export const getActivityOverview = async (days = 30) => {
  await requireAdminAction();
  return analytics<ActivityOverview>(`/overview?days=${int(days, 30, 1, 90)}`);
};

export const listUsers = async ({ q = "", page = 1, sort = "last_seen" }: { q?: string; page?: number; sort?: UserSort } = {}) => {
  await requireAdminAction();
  const params = new URLSearchParams({ page: String(int(page, 1, 1, 100_000)), sort: (USER_SORTS as readonly string[]).includes(sort) ? sort : "last_seen" });
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  if (search) params.set("q", search);
  return analytics<AdminUserList>(`/users?${params.toString()}`);
};

export const getUserDetail = async (id: string) => {
  await requireAdminAction();
  return analytics<AdminUserDetail>(`/users/${idSegment(id)}`);
};

/** One page of a user's timeline, newest first; `before` is the previous page's `next`. */
export const getUserEvents = async (id: string, { before, kind, feature }: { before?: string | null; kind?: string; feature?: string } = {}) => {
  await requireAdminAction();
  const params = new URLSearchParams({ limit: "100" });
  if (typeof before === "string" && !Number.isNaN(Date.parse(before))) params.set("before", before);
  if (typeof kind === "string" && (TRACK_KINDS as readonly string[]).includes(kind)) params.set("kind", kind);
  if (typeof feature === "string" && feature.trim()) params.set("feature", feature.trim().slice(0, 60));
  return analytics<EventPage>(`/users/${idSegment(id)}/events?${params.toString()}`);
};
