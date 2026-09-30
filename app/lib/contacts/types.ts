// Contacts and referral requests — mirrors the backend's src/types/contacts.ts
// field for field. The backend owns these shapes; change them there first.
//
// A contact is someone in the user's own network: a LinkedIn connection from
// the Connections.csv import, someone referral search found and the user kept,
// or someone typed in by hand. An email that was only guessed from a company's
// address format says so in `emailStatus`, and the screen must too.

export const CONTACT_SOURCES = ["linkedin-csv", "web", "manual"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

/** `known`: LinkedIn gave it or the user typed it. `found`: published on a public page. `likely`: built from the company's email format — unverified. */
export type ContactEmailStatus = "known" | "found" | "likely";

export interface ContactItem {
  id: string;
  source: ContactSource;
  name: string;
  firstName: string;
  lastName: string;
  company: string;
  /** Their title. */
  position: string;
  email: string | null;
  emailStatus: ContactEmailStatus | null;
  /** Canonical https://www.linkedin.com/in/<slug>, or null. */
  linkedinUrl: string | null;
  /** The non-LinkedIn page a web-found person was found on. */
  profileUrl: string | null;
  location: string | null;
  /** YYYY-MM-DD from LinkedIn's "Connected On" column. */
  connectedOn: string | null;
  notes: string;
  /** Their company has a live job on Remote Worldwide right now. */
  hiring: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Whole-list counts for the filter chips — never narrowed by the search. */
export interface ContactCounts {
  all: number;
  "linkedin-csv": number;
  web: number;
  manual: number;
  hiring: number;
}

export interface ContactListResult {
  items: ContactItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: ContactCounts;
}

export interface ContactListParams {
  q?: string;
  source?: ContactSource;
  hiring?: boolean;
  /** Contacts at any of these companies, matched however each name was typed. */
  company?: string[];
  page?: number;
  pageSize?: number;
}

export interface SaveContactInput {
  source: "web" | "manual";
  name: string;
  company?: string | null;
  position?: string | null;
  email?: string | null;
  /** Only for `web`: how referral search came by the email. */
  emailStatus?: "found" | "likely" | null;
  linkedinUrl?: string | null;
  profileUrl?: string | null;
  location?: string | null;
  notes?: string | null;
}

export interface ContactLookupPerson {
  name: string;
  company?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
}

export interface ContactImportResult {
  rows: number;
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  limitReached: boolean;
}

export type ReferralChannel = "email" | "linkedin" | "other";

export interface ReferralRequestItem {
  id: string;
  contactId: string | null;
  /** The id the screen knew the person by: a contact's id or a found person's. */
  personKey: string;
  contact: { name: string; company: string; title: string; linkedinUrl: string | null; email: string | null };
  job: { savedJobId: string | null; company: string; role: string } | null;
  message: string;
  channel: ReferralChannel;
  /** ISO timestamp, set by the server when the ask was recorded. */
  sentAt: string;
  createdAt: Date;
}

export interface CreateReferralRequestInput {
  personKey: string;
  contactId?: string | null;
  contact: { name: string; company?: string; title?: string; linkedinUrl?: string | null; email?: string | null };
  job?: { savedJobId?: string | null; company?: string; role?: string } | null;
  message?: string;
  channel?: ReferralChannel;
}
