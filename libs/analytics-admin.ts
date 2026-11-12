"use server";

// The users and activity screens (/heroshima/users, /heroshima/activity) read the backend through
// these server actions, the waitlist-admin pattern (libs/waitlist-admin.ts): the admin's own
// session cookie is forwarded and the backend's isAdmin on /api/admin/analytics is the boundary;
// requireAdminAction refuses a non-admin here first. Server to backend, so no rewrite exists.

import { requireAdminAction } from "@/app/lib/auth/action-guards";
import { BackendError, backend, idSegment, isObjectId, type BackendInit } from "@/app/lib/backend";
import { isExportField, type ExportField, type UserExport, type UserSelection } from "@/app/lib/tracking/export";
import { isMailLevel, type MailLevel, type MailTimelinePage, type UserMailDetail } from "@/app/lib/mail/userMail";
import {
  ACTIVITY_CARDS,
  TRACK_KINDS,
  USER_SORTS,
  type ActivityCard,
  type ActivityOverview,
  type AdminUserDetail,
  type AdminUserList,
  type CardEventPage,
  type EventPage,
  type UserSort,
} from "@/app/lib/tracking/types";

const analytics = <T>(path: string, init: Omit<BackendInit, "session"> = {}) => backend<T>(`/admin/analytics${path}`, { ...init, session: true });
/** The mail system's analytics (MAIL-BUILD-SPEC.md section 7), behind the same isAdmin. */
const mailAnalytics = <T>(path: string) => backend<T>(`/admin/mail/analytics${path}`, { session: true });

const int = (value: unknown, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(value)) || fallback));

export const getActivityOverview = async (days = 30) => {
  await requireAdminAction();
  return analytics<ActivityOverview>(`/overview?days=${int(days, 30, 1, 90)}`);
};

/** One row of an overview card, opened: its events newest first, a page at a time, in the overview's range. */
export const getCardEvents = async ({ card, key, days = 30, page = 1 }: { card: ActivityCard; key: string; days?: number; page?: number }) => {
  await requireAdminAction();
  if (!(ACTIVITY_CARDS as readonly string[]).includes(card)) throw new BackendError(400, "Unknown card");
  const params = new URLSearchParams({ key: typeof key === "string" ? key.slice(0, 500) : "", days: String(int(days, 30, 1, 90)), page: String(int(page, 1, 1, 100_000)) });
  return analytics<CardEventPage>(`/cards/${card}/events?${params.toString()}`);
};

/** `mail` keeps only the people at that mail engagement level. */
export const listUsers = async ({ q = "", page = 1, sort = "last_seen", mail }: { q?: string; page?: number; sort?: UserSort; mail?: MailLevel } = {}) => {
  await requireAdminAction();
  const params = new URLSearchParams({ page: String(int(page, 1, 1, 100_000)), sort: (USER_SORTS as readonly string[]).includes(sort) ? sort : "last_seen" });
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  if (search) params.set("q", search);
  if (isMailLevel(mail)) params.set("mail", mail);
  return analytics<AdminUserList>(`/users?${params.toString()}`);
};

/**
 * The chosen fields for the chosen people, for the users screen's Export. The browser builds the
 * file from these rows (app/lib/tracking/export.ts). Ids and fields are checked here as well as on
 * the backend, because an action's arguments are whatever its caller sends. A backend refusal comes
 * back as `error` rather than thrown, since a production build hides a thrown action's message.
 */
export const exportUsers = async ({
  selection,
  fields,
  sort = "last_seen",
}: {
  selection: UserSelection;
  fields: ExportField[];
  sort?: UserSort;
}): Promise<{ data: UserExport; error?: never } | { error: string; data?: never }> => {
  await requireAdminAction();
  const ids = (list: unknown) => (Array.isArray(list) ? list.filter(isObjectId).slice(0, 10_000) : []);
  const body: Record<string, unknown> = {
    fields: Array.isArray(fields) ? fields.filter(isExportField) : [],
    sort: (USER_SORTS as readonly string[]).includes(sort) ? sort : "last_seen",
  };
  if (selection?.mode === "all") {
    body.all = true;
    body.q = typeof selection.q === "string" ? selection.q.trim().slice(0, 100) : "";
    if (isMailLevel(selection.mail)) body.mail = selection.mail;
    body.exclude = ids(selection.except);
  } else {
    body.ids = ids(selection?.ids);
  }
  try {
    return { data: await analytics<UserExport>("/users/export", { method: "POST", body }) };
  } catch (error) {
    if (error instanceof BackendError) return { error: error.message || `The backend answered ${error.status}.` };
    throw error;
  }
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

/** One person's mail for the Mail panel on their page: level, numbers, sends, playbooks, offers, feedback, switches. */
export const getUserMail = async (id: string) => {
  await requireAdminAction();
  return mailAnalytics<UserMailDetail>(`/users/${idSegment(id)}`);
};

/** One page of a person's mail rows for their timeline, newest first; `page` is the previous page's `next`. */
export const getUserMailEvents = async (id: string, { page }: { page?: number | string | null } = {}) => {
  await requireAdminAction();
  const params = new URLSearchParams();
  // A page number, or an opaque cursor if the backend pages that way; nothing else goes into the address.
  if (typeof page === "number" && Number.isInteger(page) && page > 1) params.set("page", String(Math.min(page, 100_000)));
  else if (typeof page === "string" && /^[\w:.+-]{1,64}$/.test(page)) params.set("page", page);
  const search = params.toString();
  return mailAnalytics<MailTimelinePage>(`/users/${idSegment(id)}/events${search ? `?${search}` : ""}`);
};
