"use client";

// My documents, read through React Query.
//
// Deliberately NOT persisted to disk — see PERSISTED_DOMAINS in
// app/lib/query/keys.ts. A cached list of someone's CV, passport and
// work-permit filenames is exactly the kind of thing that should not survive
// on a shared machine.

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/app/lib/api/client";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import type { VaultDoc } from "@/app/lib/dashboard/types";

export const DOCUMENTS_PATH = "/api/documents";

export function useDocumentsQuery() {
  return useQuery({
    queryKey: qk.documents.list(),
    queryFn: ({ signal }) => apiGet<VaultDoc[]>(DOCUMENTS_PATH, signal),
    staleTime: STALE_TIME.documents,
  });
}
