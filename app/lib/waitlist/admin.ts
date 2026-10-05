// The /heroshima/waitlist screen's logic, kept out of the component so it can be
// tested (tests/waitlist-admin.test.mjs): who can be picked, the Gmail-style
// "select all N" mode, the grant request that comes out of it, and the words the
// table, the confirm dialog and the result use.
//
// Only rows still WAITING can be picked: everyone else has been granted already.
// A pick is per page (the screen starts afresh on another page, tab or search);
// once the whole page is picked, the admin can widen it to every waiting signup
// matching the search, on every page, which the backend grants as `{ all: true, q }`.

import {
  WAITLIST_GRANT_CREDITS,
  WAITLIST_GRANT_MAX_IDS,
  WAITLIST_GRANT_PLAN,
  type WaitlistAdminFilter,
  type WaitlistAdminItem,
  type WaitlistAdminList,
  type WaitlistGrantRequest,
  type WaitlistGrantResult,
  type WaitlistPlan,
} from "./types";

type Row = Pick<WaitlistAdminItem, "id" | "status">;

export const isSelectable = (row: Pick<WaitlistAdminItem, "status">): boolean => row.status === "waiting";

export interface WaitlistSelection {
  /** Rows picked by hand on this page. */
  picked: ReadonlySet<string>;
  /** Every waiting signup matching the search is picked, on every page. */
  everyWaiting: boolean;
}

export const NO_SELECTION: WaitlistSelection = { picked: new Set(), everyWaiting: false };

export type SelectionAction =
  /** A row's checkbox. */
  | { type: "row"; id: string }
  /** The header checkbox: the whole page, or nothing. */
  | { type: "page" }
  /** The banner's "Select all M waiting signups". */
  | { type: "every" }
  | { type: "clear" };

export interface SelectionView {
  /** Waiting rows on this page, in page order. */
  selectableIds: string[];
  /** The picked ones, in page order. A pick that stopped being waiting (the refresh after a grant) drops out. */
  selectedIds: string[];
  /** Every waiting row on this page is picked, and there is at least one. */
  allOnPage: boolean;
  /** Some but not all: the header checkbox's indeterminate state. */
  someOnPage: boolean;
  everyWaiting: boolean;
  /** How many a grant would go to now. */
  count: number;
  /** The page is picked and more are waiting elsewhere: offer "Select all M waiting signups". */
  offerEvery: boolean;
}

export function selectionView(state: WaitlistSelection, rows: readonly Row[], waitingTotal: number): SelectionView {
  const selectableIds = rows.filter(isSelectable).map((r) => r.id);
  const everyWaiting = state.everyWaiting && waitingTotal > 0;
  const selectedIds = everyWaiting ? selectableIds : selectableIds.filter((id) => state.picked.has(id));
  const allOnPage = selectableIds.length > 0 && selectedIds.length === selectableIds.length;
  return {
    selectableIds,
    selectedIds,
    allOnPage,
    someOnPage: selectedIds.length > 0 && !allOnPage,
    everyWaiting,
    // Never fewer than the page shows ticked, should the counts lag the rows.
    count: everyWaiting ? Math.max(waitingTotal, selectableIds.length) : selectedIds.length,
    offerEvery: allOnPage && !everyWaiting && waitingTotal > selectedIds.length,
  };
}

/** The next selection, after one of the checkboxes or the banner. */
export function nextSelection(state: WaitlistSelection, action: SelectionAction, rows: readonly Row[], waitingTotal: number): WaitlistSelection {
  const view = selectionView(state, rows, waitingTotal);
  switch (action.type) {
    case "clear":
      return NO_SELECTION;
    case "page":
      return view.allOnPage ? NO_SELECTION : { picked: new Set(view.selectableIds), everyWaiting: false };
    case "every":
      return view.allOnPage ? { picked: new Set(view.selectableIds), everyWaiting: true } : state;
    case "row": {
      if (!view.selectableIds.includes(action.id)) return state;
      // Gmail: unticking one row while "all of them" is on drops back to this page, minus that row.
      const picked = new Set(view.selectedIds);
      if (picked.has(action.id)) picked.delete(action.id);
      else picked.add(action.id);
      return { picked, everyWaiting: false };
    }
    default:
      return state;
  }
}

/**
 * How many WAITING signups match the search: what "select all" grants. Under the Waiting tab
 * that is the list's own total; under any other tab it is the Waiting tab's count.
 */
export const waitingMatching = (filter: WaitlistAdminFilter, list: Pick<WaitlistAdminList, "total" | "counts">): number =>
  filter === "waiting" ? list.total : list.counts.waiting;

/** What the grant button sends, or null when nothing is picked. */
export function grantRequestFor(view: SelectionView, q: string): WaitlistGrantRequest | null {
  if (view.everyWaiting) {
    const search = q.trim();
    return search ? { all: true, q: search } : { all: true };
  }
  return view.selectedIds.length ? { ids: [...view.selectedIds] } : null;
}

/**
 * The grant body as it goes to the backend, rebuilt from whatever the server action was handed:
 * its argument is anyone's to send, so only the two known shapes pass, and nothing else rides
 * along. A string is the refusal, worded for the admin.
 */
export function grantBody(input: unknown): WaitlistGrantRequest | string {
  const nobody = "Pick who to give it to first.";
  if (!input || typeof input !== "object") return nobody;
  const request = input as { all?: unknown; q?: unknown; ids?: unknown };
  if (request.all === true) {
    const q = typeof request.q === "string" ? request.q.trim() : "";
    return q ? { all: true, q } : { all: true };
  }
  if (!Array.isArray(request.ids) || !request.ids.every((id) => typeof id === "string")) return nobody;
  const ids = [...new Set((request.ids as string[]).map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return nobody;
  if (ids.length > WAITLIST_GRANT_MAX_IDS) return `That's more than ${WAITLIST_GRANT_MAX_IDS} at once. Use "Select all" instead.`;
  return { ids };
}

// ---------------------------------------------------------------------------------------------
// Words

const people = (n: number) => (n === 1 ? "person" : "people");

const count = (n: number) => n.toLocaleString("en-GB");

/** The sticky bar's button. */
export const grantButtonLabel = (n: number) => `Give ${WAITLIST_GRANT_PLAN} for 1 month + ${WAITLIST_GRANT_CREDITS} credits (${count(n)})`;

/** The confirm dialog's one paragraph: exactly what happens. */
export const grantConfirmCopy = (n: number) =>
  `${count(n)} ${n === 1 ? "person gets" : "people get"} ${WAITLIST_GRANT_PLAN} for a month with ${WAITLIST_GRANT_CREDITS} credits. ` +
  "Those with an account start now; the rest start when they sign up. Each gets an email.";

/** The result's first line. */
export const grantHeadline = (r: WaitlistGrantResult) =>
  r.granted > 0 ? `${count(r.granted)} ${people(r.granted)} granted ${WAITLIST_GRANT_PLAN} for a month.` : "Nobody new was granted.";

/** The result, line by line, in the order the admin reads it. */
export const grantSummary = (r: WaitlistGrantResult): { label: string; value: number }[] => [
  { label: "Granted", value: r.granted },
  { label: "Started now", value: r.applied },
  { label: "Waits for sign-up", value: r.pending },
  { label: "Skipped, already on a paid plan", value: r.skipped },
  { label: "Already granted before", value: r.alreadyGranted },
];

// By hand and in UTC, so the server's render and the browser's agree whatever either one's time
// zone or ICU (en-GB's short September is "Sep" in some and "Sept" in others).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const formatDay = (value: string | Date | null | undefined): string => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

const PLAN_NAMES: Record<WaitlistPlan, string> = { free: "Free", basic: "Basic", pro: "Pro", ultra: "Ultra" };

/** The plan they eyed on /pricing: "Pro", "Pro · yearly", or a dash. */
export const planLabel = (row: Pick<WaitlistAdminItem, "plan" | "billing">): string =>
  row.plan ? `${PLAN_NAMES[row.plan] ?? row.plan}${row.billing === "year" ? " · yearly" : ""}` : "-";

/** The Pro month's dates, as far as they go, one short line each. Empty while waiting. */
export function grantTimeline(row: Pick<WaitlistAdminItem, "status" | "grantedAt" | "appliedAt" | "endsAt" | "hasAccount" | "note">): string[] {
  const on = (label: string, value: string | null) => (value ? [`${label} ${formatDay(value)}`] : []);
  switch (row.status) {
    case "waiting":
      return row.note ? [row.note] : [];
    case "granted":
      return [...on("Granted", row.grantedAt), row.note ?? (row.hasAccount ? "Starts when they verify their email" : "Starts when they sign up")];
    case "active":
      return [...on("Started", row.appliedAt), ...on("Ends", row.endsAt), ...(row.note ? [row.note] : [])];
    case "ended":
      return [...on("Started", row.appliedAt), ...on("Ended", row.endsAt), ...(row.note ? [row.note] : [])];
    case "skipped":
      return [...on("Granted", row.grantedAt), row.note ?? "Not applied: already on a paid plan"];
    default:
      // A status this screen doesn't know yet: say what the backend said, nothing more.
      return row.note ? [row.note] : [];
  }
}
