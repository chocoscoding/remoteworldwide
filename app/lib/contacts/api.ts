// Browser-side calls for the user's contacts and referral asks.
//
// Both live on the Express backend behind next.config.mjs's /api/contacts and
// /api/referral-requests rewrites, so the session cookie rides along and the
// backend scopes every read and write to the signed-in user.

import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/lib/api/client";
import type {
  ContactImportResult,
  ContactItem,
  ContactListParams,
  ContactListResult,
  ContactLookupPerson,
  CreateReferralRequestInput,
  ReferralRequestItem,
  SaveContactInput,
} from "./types";

export const CONTACTS_PATH = "/api/contacts";
export const REFERRAL_REQUESTS_PATH = "/api/referral-requests";

/** Matches the backend's multer ceiling; a full 30,000-connection export is around 4MB. */
export const MAX_CONTACTS_CSV_BYTES = 10 * 1024 * 1024;

const listQuery = ({ q, source, hiring, company, page, pageSize }: ContactListParams): string => {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (source) params.set("source", source);
  if (hiring) params.set("hiring", "true");
  // Repeated rather than comma-joined: company names can hold commas ("Linear, Inc.").
  for (const name of company ?? []) if (name.trim()) params.append("company", name.trim());
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const listContacts = (params: ContactListParams, signal?: AbortSignal) =>
  apiGet<ContactListResult>(`${CONTACTS_PATH}${listQuery(params)}`, signal);

export const getContact = (id: string, signal?: AbortSignal) => apiGet<ContactItem>(`${CONTACTS_PATH}/${encodeURIComponent(id)}`, signal);

/** Idempotent: saving someone already kept returns their row (with any gaps filled). */
export const saveContact = (input: SaveContactInput) => apiPost<ContactItem>(CONTACTS_PATH, input);

export const deleteContact = (id: string) => apiDelete<{ deleted: true }>(`${CONTACTS_PATH}/${encodeURIComponent(id)}`);

/** Everyone, or everyone from one source ("remove my LinkedIn import"). */
export const deleteContacts = (source?: ContactItem["source"]) =>
  apiDelete<{ deleted: number }>(`${CONTACTS_PATH}${source ? `?source=${encodeURIComponent(source)}` : ""}`);

/** Which of these people are already kept, index for index (null = not kept). */
export const lookupContacts = (people: ContactLookupPerson[]) => apiPost<(ContactItem | null)[]>(`${CONTACTS_PATH}/lookup`, { people });

export function importLinkedInConnections(file: File) {
  // Checked here as well as on the server so the common mistake never spends
  // megabytes of someone's upload to be told no.
  if (file.size > MAX_CONTACTS_CSV_BYTES) throw new Error("That file is larger than 10MB — upload Connections.csv on its own, not the whole archive");
  const body = new FormData();
  body.append("file", file);
  return apiPost<ContactImportResult>(`${CONTACTS_PATH}/import`, body);
}

export const listReferralRequests = (signal?: AbortSignal) => apiGet<ReferralRequestItem[]>(REFERRAL_REQUESTS_PATH, signal);

export const createReferralRequest = (input: CreateReferralRequestInput) => apiPost<ReferralRequestItem>(REFERRAL_REQUESTS_PATH, input);

export const updateContact = (id: string, patch: Partial<Omit<SaveContactInput, "source" | "emailStatus">>) =>
  apiPatch<ContactItem>(`${CONTACTS_PATH}/${encodeURIComponent(id)}`, patch);
