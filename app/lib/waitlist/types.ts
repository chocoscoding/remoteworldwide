// The early-access waitlist, admin half: GET /api/waitlist/admin and
// POST /api/waitlist/admin/grant on the backend (the owner, 2026-10-01: "admin
// can see all the waitlist, select or select all, then give them their credits
// and subs"). Mirrors the backend's contract; change it there first.
//
// The grant is Pro for one month with a 100-credit allowance for that month.
// The backend does the granting and emails each person: someone who already has
// a verified account starts now, anyone else when they sign up and verify, and
// anyone already paying for a plan is skipped.

export const WAITLIST_STATUSES = ["waiting", "granted", "active", "ended", "skipped"] as const;
/**
 * waiting: not granted yet (the only rows an admin can select).
 * granted: granted, waiting for them to sign up or verify their email; the month starts then.
 * active:  the Pro month is running.
 * ended:   the month is over.
 * skipped: granted but not applied, because they already pay for a plan.
 */
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const WAITLIST_ADMIN_FILTERS = ["all", ...WAITLIST_STATUSES] as const;
export type WaitlistAdminFilter = (typeof WAITLIST_ADMIN_FILTERS)[number];

export const WAITLIST_ADMIN_FILTER_LABELS: Record<WaitlistAdminFilter, string> = {
  all: "All",
  waiting: "Waiting",
  granted: "Granted",
  active: "Active",
  ended: "Ended",
  skipped: "Skipped",
};

/** What one grant gives, for copy only: the backend decides. */
export const WAITLIST_GRANT_PLAN = "Pro";
export const WAITLIST_GRANT_CREDITS = 100;

/** The most ids one grant may name; past that, "select all" (`{ all: true }`) is the way. */
export const WAITLIST_GRANT_MAX_IDS = 500;

/** Rows per page: the backend's default, and its ceiling is 100. */
export const WAITLIST_ADMIN_PAGE_SIZE = 50;
export const WAITLIST_ADMIN_PAGE_MAX = 100;

export type WaitlistPlan = "free" | "basic" | "pro" | "ultra";
export type WaitlistBilling = "month" | "year";

export interface WaitlistAdminItem {
  id: string;
  email: string;
  /** Place in line, 1 = first. */
  position: number | null;
  /** The plan they were eyeing on /pricing when they joined. */
  plan: WaitlistPlan | null;
  billing: WaitlistBilling | null;
  /** ISO on the wire; `joinedAt` is in app/lib/api/core.ts's DATE_KEYS, so `backend()` hands back a Date. */
  joinedAt: string | Date;
  status: WaitlistStatus;
  /** ISO. When an admin granted it. */
  grantedAt: string | null;
  /** ISO. When the Pro month actually started on their account. */
  appliedAt: string | null;
  /** ISO. When that Pro month ends. */
  endsAt: string | null;
  /** An account with this email exists. */
  hasAccount: boolean;
  /** e.g. why it was skipped ("Already on a paid plan"). */
  note: string | null;
}

export type WaitlistAdminCounts = Record<WaitlistAdminFilter, number>;

/** `GET /api/waitlist/admin`, sorted by place in line (first joined first). */
export interface WaitlistAdminList {
  items: WaitlistAdminItem[];
  /** Rows matching the search and the status filter. */
  total: number;
  page: number;
  pages: number;
  limit: number;
  /** Per status, for the filter tabs. Read as matching the search, whatever the status filter. */
  counts: WaitlistAdminCounts;
}

/**
 * `POST /api/waitlist/admin/grant`: the rows picked by hand, or every WAITING entry
 * matching the search (Gmail's "select all N"), however many pages that spans.
 */
export type WaitlistGrantRequest = { ids: string[] } | { all: true; q?: string };

export interface WaitlistGrantResult {
  /** Newly granted now. */
  granted: number;
  /** Of those, started immediately: the account exists and is verified. */
  applied: number;
  /** Of those, starting when they sign up or verify. */
  pending: number;
  /** Not applied: already on a paid plan. */
  skipped: number;
  /** Ignored: granted before. */
  alreadyGranted: number;
}
