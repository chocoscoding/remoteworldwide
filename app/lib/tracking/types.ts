// What people do on the site, as the admin's users and activity screens read it. Mirrors the
// backend's contract (remoteworldwidebackend src/types/tracking.ts, services/admin/analyticsService.ts).

import type { PlanTier } from "@/app/lib/settings/types";

export const TRACK_KINDS = ["page_view", "click", "submit", "api", "session_start", "custom"] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];

export const TRACK_KIND_LABELS: Record<TrackKind, string> = {
  page_view: "Page",
  click: "Press",
  submit: "Form",
  api: "Change",
  session_start: "Visit",
  custom: "Event",
};

export interface DeviceInfo {
  browser: string;
  os: string;
  mobile: boolean;
}

export interface TrackEventView {
  id: string;
  userId: string | null;
  kind: TrackKind;
  name: string;
  path: string | null;
  feature: string;
  source: "web" | "api";
  sessionId: string | null;
  props: Record<string, string | number | boolean>;
  device: DeviceInfo | null;
  at: string;
}

export interface UserBrief {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface ActivityOverview {
  days: number;
  totals: { users: number; newUsers: number; activeToday: number; active7: number; active30: number; events: number; visitors: number; paying: number };
  plans: Record<PlanTier, number>;
  daily: { day: string; events: number; users: number; pageViews: number; signups: number }[];
  features: { feature: string; count: number; users: number }[];
  pages: { path: string; count: number; users: number }[];
  clicks: { name: string; count: number; users: number }[];
  api: { name: string; count: number; users: number }[];
  devices: { os: string; mobile: boolean; count: number }[];
  recent: (TrackEventView & { user: UserBrief | null })[];
}

export const USER_SORTS = ["last_seen", "newest", "most_active"] as const;
export type UserSort = (typeof USER_SORTS)[number];
export const USER_SORT_LABELS: Record<UserSort, string> = { last_seen: "Last active", newest: "Newest", most_active: "Most active" };

export interface AdminUserRow extends UserBrief {
  role: string;
  verified: boolean;
  createdAt: string | null;
  tier: PlanTier;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastFeature: string | null;
  lastPath: string | null;
  device: DeviceInfo | null;
  eventCount: number;
  events30d: number;
}

export interface AdminUserList {
  items: AdminUserRow[];
  total: number;
  page: number;
  pages: number;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  plan: {
    tier: PlanTier;
    planKey: string | null;
    status: string;
    interval: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    creditBalance: number;
    provider: string | null;
  };
  counts: { applications: number; savedJobs: number; documents: number; signIns: number; sessions30d: number; events90d: number };
  features: { feature: string; count: number; lastAt: string }[];
  kinds: Record<TrackKind, number>;
  daily: { day: string; events: number }[];
  pages: { path: string; count: number }[];
  devices: (DeviceInfo & { count: number; lastAt: string })[];
  spends: { at: string; delta: number; reason: string; feature: string | null; balanceAfter: number }[];
  streakActions: { at: string; kind: string; day: string }[];
}

export interface EventPage {
  items: TrackEventView[];
  next: string | null;
}

/** "3 min ago", "2 h ago", "5 d ago", or the date past a month. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const ms = now - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 31) return `${d} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const dateTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
