"use client";

// The ATS scorer's reads.
//
// Deliberately NOT persisted to disk — see PERSISTED_DOMAINS in
// app/lib/query/keys.ts. This is a list of someone's CV filenames, which is
// the same reason `documents` stays out.

import { useQuery } from "@tanstack/react-query";
import { listIngestedResumes } from "@/app/lib/ats/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

/**
 * Every CV this user has had parsed and embedded — the set a scan can name.
 *
 * The ATS screen reads this alongside My documents and matches the two by
 * filename, so a resume that has been scored before is scored again without a
 * second upload. A document with no match here is imported on demand at scan
 * time; see `resolveResumeId`.
 */
export function useIngestedResumesQuery() {
  return useQuery({
    queryKey: qk.ats.ingested(),
    queryFn: ({ signal }) => listIngestedResumes(signal),
    staleTime: STALE_TIME.ats,
  });
}
