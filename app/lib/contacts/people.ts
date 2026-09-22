// The people the referral screens draft for, whichever list they came from.
//
// Two lists feed one intro panel: your own contacts (the backend's contacts
// collection) and people a referral search found online. Both become a
// `ReferralContact`, and the tie is read off where the person came from and
// nothing else — a LinkedIn connection is 1st degree, someone found online is
// a stranger, someone you typed in is someone you know. There is no "strong
// tie" or "alumni" here because no source can honestly say so.
//
// "Asked" is matched on identity rather than one id, because the same person
// can be reached from both lists: asked from a search result, then saved to
// contacts (a new id), they must still show as asked. So each referral request
// contributes its person key, its contact id and its LinkedIn slug.

import type { ReferralContact } from "@/app/lib/dashboard/types";
import type { ReferralPerson } from "@/app/lib/referrals/types";
import type { ContactItem, ReferralRequestItem } from "./types";

const LINKEDIN_HOST = /(^|\.)linkedin\.com$/i;

/**
 * The member slug of a LinkedIn profile link ("in/jane-doe"), or null. Must
 * agree with the backend's `linkedinSlug` in src/helpers/contactKeys.ts:
 * country subdomains, query strings, trailing slashes, case and
 * percent-encoding all reduce to the same slug.
 */
export function linkedinSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol) || !LINKEDIN_HOST.test(parsed.hostname)) return null;
  const match = parsed.pathname.match(/^\/(in|pub)\/([^/]+(?:\/[^/]+)*)\/?$/i);
  if (!match) return null;
  let slug = match[2];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // A malformed escape is still a stable string to key on.
  }
  const kind = match[1].toLowerCase();
  if (kind === "in") slug = slug.split("/")[0];
  slug = slug.trim().toLowerCase();
  return slug ? `${kind}/${slug}` : null;
}

// Legal-form suffixes typed inconsistently ("Stripe" / "Stripe, Inc."), dropped from the end only.
const LEGAL_SUFFIX = /\s+(inc|incorporated|llc|l l c|ltd|limited|gmbh|corp|corporation|co|company|plc|sa|s a|bv|b v|ag|srl|pty|pte|oy|ab|as|nv|lp|llp)$/;

/**
 * A company name as a comparable key — "Stripe, Inc." and "stripe" are the same
 * company. Mirrors the backend's `companyKeyOf` (src/helpers/contactKeys.ts),
 * which is what its company filter matched on, so a contact the server returned
 * for a company is recognised as at that company here too.
 */
export function companyKeyOf(company: string | null | undefined): string {
  let key = (company ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 2; i += 1) {
    const stripped = key.replace(LEGAL_SUFFIX, "");
    if (!stripped || stripped === key) break;
    key = stripped;
  }
  return key;
}

const slugKey = (url: string | null | undefined): string | null => {
  const slug = linkedinSlug(url);
  return slug ? `li:${slug}` : null;
};

/** Every key an ask is known by. */
export function askedKeysOf(requests: readonly ReferralRequestItem[]): Set<string> {
  const keys = new Set<string>();
  for (const request of requests) {
    keys.add(request.personKey);
    if (request.contactId) keys.add(request.contactId);
    const slug = slugKey(request.contact.linkedinUrl);
    if (slug) keys.add(slug);
  }
  return keys;
}

/** Whether this person has been asked, by id or by their LinkedIn profile. */
export function hasAsked(keys: ReadonlySet<string>, person: { id: string; contactId?: string; linkedinUrl?: string | null; profileUrl?: string | null }): boolean {
  if (keys.has(person.id)) return true;
  if (person.contactId && keys.has(person.contactId)) return true;
  const slug = slugKey(person.linkedinUrl) ?? slugKey(person.profileUrl);
  return slug !== null && keys.has(slug);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mar 2024" from LinkedIn's YYYY-MM-DD, or null. */
function connectedLabel(connectedOn: string | null): string | null {
  const match = connectedOn?.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : null;
}

/** The line under a contact's name: how you know them, as the source says. */
function statusOf(contact: ContactItem): string {
  if (contact.source === "linkedin-csv") {
    const since = connectedLabel(contact.connectedOn);
    return since ? `Connected on LinkedIn since ${since}` : "Connected on LinkedIn";
  }
  if (contact.source === "web") return "Found online, saved by you";
  return "Added by you";
}

/** One of your contacts, in the shape the row and the intro panel draw. */
export function contactToReferral(contact: ContactItem): ReferralContact {
  return {
    id: contact.id,
    contactId: contact.id,
    name: contact.name,
    firstName: contact.firstName || undefined,
    tie: contact.source === "linkedin-csv" ? "connection" : contact.source === "web" ? "cold" : "added",
    role: contact.position,
    company: contact.company,
    status: statusOf(contact),
    location: contact.location ?? undefined,
    email: contact.email ?? "",
    emailStatus: contact.emailStatus ?? undefined,
    linkedinUrl: contact.linkedinUrl ?? "",
    profileUrl: contact.profileUrl ?? undefined,
    hiring: contact.hiring,
  };
}

/** A person a referral search found, in the same shape. `company` is the job's: that is where the search looked. */
export function foundContact(person: ReferralPerson, job: { company: string }): ReferralContact {
  return {
    id: person.id,
    name: person.name,
    tie: "cold",
    role: person.title,
    company: job.company,
    status: "Found online",
    location: person.location ?? undefined,
    email: person.email?.address ?? "",
    emailStatus: person.email?.status,
    // Keyed on the link itself, not the `linkedin` flag: only a real profile link counts as one.
    linkedinUrl: linkedinSlug(person.profileUrl) ? person.profileUrl : "",
    profileUrl: linkedinSlug(person.profileUrl) ? undefined : person.profileUrl,
  };
}

/** What "Save to contacts" sends for a found person — the same fields a lookup keys on. */
export function foundPersonContact(person: ReferralPerson, company: string) {
  return {
    source: "web" as const,
    name: person.name,
    company,
    position: person.title,
    email: person.email?.address ?? null,
    emailStatus: person.email?.status ?? null,
    linkedinUrl: linkedinSlug(person.profileUrl) ? person.profileUrl : null,
    profileUrl: linkedinSlug(person.profileUrl) ? null : person.profileUrl,
    location: person.location,
  };
}
