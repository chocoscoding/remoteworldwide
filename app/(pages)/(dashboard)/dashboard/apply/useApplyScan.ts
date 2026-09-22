"use client";

// The apply wizard's ATS scan: one ingested resume against this job's posting.
//
// `useScanResume` is the ATS screen's version, and it starts from a VAULT
// DOCUMENT (a file in My documents) that it may have to import first. The
// wizard's resume step lists INGESTED resumes directly — the rows a scan names —
// so there is nothing to bridge, and this runs `streamScan` on the id it is
// given. Same phases, same rules: only the newest run writes, the score shows
// the moment it lands, and a charged scan leaves the credit meter behind.
//
// Local state, not React Query, for the same reason as the ATS screen's hook: a
// report is only shown on the screen that ran it. The AI service caches the scan
// itself against the resume's version and the posting, so scanning the same pair
// again is served from there and not charged twice.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { describeScanFailure, streamScan, type ScanFailure } from "@/app/lib/ats/api";
import type { ScanReport } from "@/app/lib/ats/types";
import { qk } from "@/app/lib/query/keys";

export type ApplyScanStatus = "idle" | "scoring" | "explaining" | "done" | "failed";

export interface ApplyScanState {
  status: ApplyScanStatus;
  /** The resume the report (or failure) belongs to — a report for another resume is not this one's score. */
  resumeId: string | null;
  report: ScanReport | null;
  failure: ScanFailure | null;
}

export interface ApplyScanRequest {
  resumeId: string;
  jdText: string | null;
  /** The saved job's id: the service's key for the posting's extracted requirements. */
  jobId: string | null;
}

const IDLE: ApplyScanState = { status: "idle", resumeId: null, report: null, failure: null };

export function useApplyScan() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ApplyScanState>(IDLE);
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const reset = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState(IDLE);
  }, []);

  /** Resolves with the finished report, or null when it failed or was superseded. */
  const run = useCallback(
    async ({ resumeId, jdText, jobId }: ApplyScanRequest): Promise<ScanReport | null> => {
      runIdRef.current += 1;
      const runId = runIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const current = () => runId === runIdRef.current;

      setState({ status: "scoring", resumeId, report: null, failure: null });
      try {
        const report = await streamScan(
          { resumeId, jdText, jobId },
          {
            signal: controller.signal,
            onScored: (scored) => {
              if (current()) setState({ status: "explaining", resumeId, report: scored, failure: null });
            },
          },
        );
        if (!current()) return null;
        setState({ status: "done", resumeId, report, failure: null });
        // A scan spends a credit, so the balance in the header is now behind.
        void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
        return report;
      } catch (error) {
        if (!current() || (error instanceof Error && error.name === "AbortError")) return null;
        // A score that landed before the write-up failed is still the score.
        setState((prev) => (prev.report ? { ...prev, status: "done" } : { status: "failed", resumeId, report: null, failure: describeScanFailure(error) }));
        return null;
      }
    },
    [queryClient],
  );

  return { ...state, run, reset, scanning: state.status === "scoring" || state.status === "explaining" };
}
