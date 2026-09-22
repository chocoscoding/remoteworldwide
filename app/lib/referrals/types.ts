// Referral search — mirrors the AI service's src/types/referrals.ts field for
// field. The AI service owns these shapes; its
// tests/contracts/referrals-types.test.ts reads both files and fails when they
// drift, so change them there first and here second.
//
// Everything listed comes from a public page the user can open: each person
// carries the profile they were found on, each email the page it was read from
// or — for a likely email — the format pages it was built from.

/** The part a person plays in hiring for the role, read off their current title. */
export const REFERRAL_GROUPS = ["hiring", "recruiting", "team"] as const;
export type ReferralGroup = (typeof REFERRAL_GROUPS)[number];

/** `found`: the address appears verbatim on a public page. `likely`: built from the company's published email format — unverified. */
export const REFERRAL_EMAIL_STATUSES = ["found", "likely"] as const;
export type ReferralEmailStatus = (typeof REFERRAL_EMAIL_STATUSES)[number];

export interface ReferralEmail {
  address: string;
  status: ReferralEmailStatus;
  /** The page it appeared on (found), or the format page it was built from (likely). */
  source: string;
}

/** The company's main number. People carry none: a personal number is not on public pages. */
export interface ReferralPhone {
  number: string;
  source: string;
}

export interface ReferralPerson {
  /** Stable across searches for the same profile, so "asked" survives a re-search. */
  id: string;
  name: string;
  /** Their current title at the company. */
  title: string;
  group: ReferralGroup;
  /** Their title shares the words that say what the job does. */
  matchesRole: boolean;
  location: string | null;
  /** The profile they were found on — LinkedIn whenever there is one. */
  profileUrl: string;
  linkedin: boolean;
  email: ReferralEmail | null;
}

export interface ReferralOpenRole {
  url: string;
  title: string;
  /** The title names what the job being referred for does. */
  sameRole: boolean;
  /** On the company's own site or job board rather than an aggregator. */
  official: boolean;
  publishedDate: string | null;
}

export interface ReferralInbox {
  email: string;
  source: string;
}

export interface ReferralEmailFormat {
  domain: string;
  /** How addresses are built, e.g. "flast" or "first.last". */
  pattern: string;
  /** The pattern applied to Jane Doe: "jdoe@wikimedia.org". */
  example: string;
  /** The largest share any source put on it (88 for "used 88% of the time"), or null. */
  share: number | null;
  sources: string[];
}

export interface ReferralSearchItem {
  savedJobId: string;
  company: string;
  role: string;
  people: ReferralPerson[];
  openRoles: ReferralOpenRole[];
  inboxes: ReferralInbox[];
  companyPhone: ReferralPhone | null;
  emailFormat: ReferralEmailFormat | null;
  /** ISO timestamp of the search these results came from. */
  searchedAt: string;
}

export interface ReferralSearchResult {
  search: ReferralSearchItem;
  /** False when a stored search was returned and nothing was spent. */
  charged: boolean;
  credits: number | null;
}
