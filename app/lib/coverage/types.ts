// The coverage-request wire contract (the admin half), mirroring
// remoteworldwidebackend/src/types/coverageRequests.ts. Change it there first.
//
// The extension met a page it could not read — a posting ("job") or an
// application form ("form") — and the person sent it for review, or added the
// site to the extension by hand ("Add this page"), which reports it too. Only
// the page's origin and path are ever stored; the backend cuts the query string
// and fragment off before anything is written.

export const COVERAGE_REQUEST_KINDS = ["job", "form"] as const;
export type CoverageRequestKind = (typeof COVERAGE_REQUEST_KINDS)[number];

export const COVERAGE_REQUEST_STATUSES = ["open", "reviewed", "dismissed"] as const;
export type CoverageRequestStatus = (typeof COVERAGE_REQUEST_STATUSES)[number];

export const ADMIN_COVERAGE_FILTERS = [...COVERAGE_REQUEST_STATUSES, "all"] as const;
export type AdminCoverageFilter = (typeof ADMIN_COVERAGE_FILTERS)[number];

export interface CoverageRequester {
  id: string;
  name: string | null;
  email: string | null;
}

export interface AdminCoverageRequestItem {
  id: string;
  /** Scheme, host and port, e.g. `https://boards.greenhouse.io`. */
  origin: string;
  /** Always starts with `/`. Never a query string or fragment. */
  path: string;
  kind: CoverageRequestKind;
  note: string | null;
  status: CoverageRequestStatus;
  /**
   * The person added this page to the extension by hand ("Add this page"), on
   * the report that opened the request or a later one while it was open. A page
   * someone had to add is one the extension should cover on its own.
   */
  addedByUser: boolean;
  /** ISO strings on the wire; both keys are in app/lib/api/core.ts's DATE_KEYS, so `backend()` hands back Dates. */
  createdAt: string | Date;
  updatedAt: string | Date;
  /** Null only if the account is gone and the row somehow outlived it. */
  requester: CoverageRequester | null;
}

export interface AdminCoverageRequestList {
  data: AdminCoverageRequestItem[];
  count: number;
}
