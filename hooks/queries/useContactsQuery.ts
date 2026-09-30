"use client";

// The user's own network and the referral asks they have sent, read through
// React Query from the backend.
//
// Not persisted to disk: `contacts` is outside PERSISTED_DOMAINS in
// app/lib/query/keys.ts. It is personal data about people who never signed up
// here — names, employers, emails — and has no business outliving the tab on
// a shared machine.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getContact, listContacts, listReferralRequests, lookupContacts } from "@/app/lib/contacts/api";
import type { ContactListParams, ContactLookupPerson } from "@/app/lib/contacts/types";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

interface Options {
  /** Off when the caller has nothing to look up yet. */
  enabled?: boolean;
}

/**
 * One page of contacts for a search and filter set. The previous page stays on
 * screen while the next loads, so paging and typing never flash an empty list.
 */
export function useContacts(params: ContactListParams, { enabled = true }: Options = {}) {
  return useQuery({
    queryKey: qk.contacts.list(params),
    queryFn: ({ signal }) => listContacts(params, signal),
    staleTime: STALE_TIME.contacts,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** One contact — for a deep link (?contact=<id>) to someone not on the page in view. */
export function useContact(id: string | null) {
  return useQuery({
    queryKey: qk.contacts.detail(id ?? ""),
    queryFn: ({ signal }) => getContact(id ?? "", signal),
    staleTime: STALE_TIME.contacts,
    enabled: id !== null,
  });
}

/**
 * Which of these people (a referral search's results) are already kept, index
 * for index. Keyed by who was asked about, so a new search asks again and a
 * re-render does not.
 */
export function useContactLookup(people: ContactLookupPerson[], { enabled = true }: Options = {}) {
  const key = people.map((p) => `${p.linkedinUrl ?? ""}|${p.email ?? ""}|${p.name}|${p.company ?? ""}`).join("\n");
  return useQuery({
    queryKey: qk.contacts.lookup(key),
    queryFn: () => lookupContacts(people),
    staleTime: STALE_TIME.contacts,
    enabled: enabled && people.length > 0,
  });
}

/** Every referral ask the user has marked as sent, newest first: what "Asked" is read from. */
export function useReferralRequests() {
  return useQuery({
    queryKey: qk.contacts.requests(),
    queryFn: ({ signal }) => listReferralRequests(signal),
    staleTime: STALE_TIME.contacts,
  });
}
