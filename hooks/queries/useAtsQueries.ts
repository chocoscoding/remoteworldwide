"use client";

// The ATS scorer's reads.
//
// Deliberately NOT persisted to disk — see PERSISTED_DOMAINS in
// app/lib/query/keys.ts. This is a list of someone's CV filenames, which is
// the same reason `documents` stays out.

import { useQuery } from "@tanstack/react-query";
import { getIngestedResume, listIngestedResumes, lookupStoredScan, storedScanKey } from "@/app/lib/ats/api";
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

/**
 * One ingested resume with its parsed content, for the tools that rewrite it.
 * A row never changes once parsed — an edit is a new row — so the cached copy
 * stays true for as long as it is kept. Pass null to read nothing.
 */
export function useIngestedResumeQuery(resumeId: string | null) {
  return useQuery({
    queryKey: qk.ats.resume(resumeId ?? ""),
    queryFn: ({ signal }) => getIngestedResume(resumeId ?? "", signal),
    staleTime: STALE_TIME.ats,
    enabled: resumeId !== null,
  });
}

/**
 * The latest scan this user already ran against one posting, or null when it
 * was never scanned — the log-an-application payoff's score. Free: it reads a
 * stored score back and never runs a scan. Pass an empty description to read
 * nothing (a posting logged without its text has nothing to match against).
 *
 * Keyed by a hash of the text rather than the text, and short-lived: a scan
 * run in another tab should show up the next time the payoff asks.
 */
export function useStoredScanQuery(jdText: string | null | undefined) {
  const jd = (jdText ?? "").trim();
  return useQuery({
    queryKey: qk.ats.storedScan(storedScanKey(jd)),
    queryFn: () => lookupStoredScan(jd),
    staleTime: 30_000,
    enabled: jd.length > 0,
  });
}
