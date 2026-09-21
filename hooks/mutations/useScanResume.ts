"use client";

// One ATS scan: make sure the picked document is something the scorer can
// read, score it, then follow the written breakdown in behind the number.
//
// A plain hook with local state rather than the module-level store a coach
// turn uses. The difference is lifetime: a coach turn keeps writing into its
// session while the user reads another one, so it has to outlive the screen. A
// scan report is only ever shown on the screen that started it — leaving the
// ATS screen abandons the report — so its state belongs to that screen, and a
// store would be machinery with nothing to hold.
//
// The four phases the UI distinguishes:
//
//   preparing   first scan of this document: it is being parsed and embedded
//   scoring     the deterministic half — this is what the spinner is for
//   explaining  the score is ON SCREEN; the write-up is still coming
//   done
//
// `explaining` is the reason the whole thing streams. The score arrives inside
// a sub-two-second deadline and the explanation is one Groq call behind it, so
// the user reads their number while the paragraph is still being written.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { describeScanFailure, findIngested, resolveResumeId, streamScan, type ScanFailure } from "@/app/lib/ats/api";
import type { IngestedResume, ScanReport } from "@/app/lib/ats/types";
import type { VaultDoc } from "@/app/lib/dashboard/types";
import { qk } from "@/app/lib/query/keys";

export type ScanStatus = "idle" | "preparing" | "scoring" | "explaining" | "done" | "failed";

export interface ScanState {
  status: ScanStatus;
  /** Present from the moment the score lands, before the write-up arrives. */
  report: ScanReport | null;
  /** Why there is no written breakdown, when the score came without one. */
  unexplained: string | null;
  failure: ScanFailure | null;
  /** When this report was produced — drives the "scanned X ago" stamp. */
  scannedAt: Date | null;
}

export interface ScanRequest {
  doc: Pick<VaultDoc, "id" | "name" | "ext">;
  /** The posting to score against, or null for a general score. */
  job: { id?: string; description: string } | null;
  ingested: readonly IngestedResume[];
}

const IDLE: ScanState = { status: "idle", report: null, unexplained: null, failure: null, scannedAt: null };

export const isScanning = (status: ScanStatus) => status === "preparing" || status === "scoring" || status === "explaining";

export function useScanResume() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ScanState>(IDLE);

  // Only the newest scan may write to state. Switching resume or job starts a
  // new one, and a slow first request must not land on top of it.
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

  /**
   * Runs one scan. Resolves with the finished report, or null when it failed
   * or was superseded — so a caller can act on the score (remember it, show
   * it elsewhere) without reading state back during a render.
   */
  const run = useCallback(
    async ({ doc, job, ingested }: ScanRequest): Promise<ScanReport | null> => {
      runIdRef.current += 1;
      const runId = runIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      /** False once a newer scan has started, which is the signal to write nothing. */
      const current = () => runId === runIdRef.current;

      // A document with no ingested resume behind it has to be parsed and
      // embedded first, which is slow enough that the UI names it separately.
      const known = findIngested(doc, ingested) !== null;
      setState({ ...IDLE, status: known ? "scoring" : "preparing" });

      try {
        const resumeId = await resolveResumeId(doc, ingested);
        if (!current()) return null;

        // An import happened, so the list the picker matches against is stale.
        if (!known) void queryClient.invalidateQueries({ queryKey: qk.ats.ingested() });

        setState((prev) => ({ ...prev, status: "scoring" }));

        const report = await streamScan(
          { resumeId, jdText: job?.description ?? null, jobId: job?.id ?? null },
          {
            signal: controller.signal,
            // The score is on screen from here; what follows is the write-up.
            onScored: (scored) => {
              if (!current()) return;
              setState({ status: "explaining", report: scored, unexplained: null, failure: null, scannedAt: new Date() });
            },
            onUnexplained: (message) => {
              if (!current()) return;
              setState((prev) => ({ ...prev, unexplained: message || null }));
            },
          },
        );

        if (!current()) return null;
        setState((prev) => ({ ...prev, status: "done", report }));

        // A scan spends a credit, so the balance in the header is now behind.
        void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
        return report;
      } catch (error) {
        // An abort is this hook superseding itself; the newer run owns the state.
        if (!current() || (error instanceof Error && error.name === "AbortError")) return null;
        setState((prev) => ({ ...prev, status: "failed", failure: describeScanFailure(error) }));
        return null;
      }
    },
    [queryClient],
  );

  return { ...state, run, reset, scanning: isScanning(state.status) };
}
