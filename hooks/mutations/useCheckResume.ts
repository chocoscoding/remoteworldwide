"use client";

// One ATS check of the document open in the resume editor.
//
// The editor's sibling of `useScanResume`, and deliberately shaped like it —
// the same phases, the same "only the newest run writes back" guard, the same
// streaming contract through `streamScan`. What differs is the one step that
// has to: the ATS screen scores a FILE from My documents, resolved through
// `/api/ats/resume-for-doc`, while the editor scores a document it is holding
// as content. There is no file to fetch, so the content is rendered to text and
// ingested (`importResumeContent`) and the resume id that comes back is scored.
//
//   preparing   the text is being parsed and embedded — skipped in effect
//               when the document is unedited, because the service dedupes it
//   scoring     the deterministic half; this is what the spinner is for
//   explaining  the score is ON THE CARD; the write-up is still coming
//   done
//
// A check spends a credit. Re-checking an unedited document against the same
// posting does not: the ingest dedupes to the same resume row and the service
// serves the scan from its cache without charging again.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { describeScanFailure, streamScan, type ScanFailure } from "@/app/lib/ats/api";
import type { ScanReport } from "@/app/lib/ats/types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { importResumeContent, resumeContentToText } from "@/app/lib/resume/api";
import { qk } from "@/app/lib/query/keys";
import type { CheckPosting, ResumeCheck } from "@/app/components/dashboard/resume/resume-document";

export type CheckStatus = "idle" | "preparing" | "scoring" | "explaining" | "done" | "failed";

export interface CheckRequest {
  content: ResumeContent;
  /** The document's name — what the ingested row is labelled with. */
  label: string;
  /** The posting to score against, or null for a general check. */
  job: CheckPosting | null;
}

export const isChecking = (status: CheckStatus) => status === "preparing" || status === "scoring" || status === "explaining";

export function useCheckResume() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CheckStatus>("idle");
  const [failure, setFailure] = useState<ScanFailure | null>(null);

  // Only the newest check may write back. Running another before the first
  // lands must not let the slow one overwrite the fast one's score.
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const clearFailure = useCallback(() => {
    setFailure(null);
    setStatus((prev) => (prev === "failed" ? "idle" : prev));
  }, []);

  /**
   * Runs one check. `onScored` fires the moment the score exists — before the
   * write-up is asked for — with the check to put on the document, so the card
   * shows a number without waiting on the slow half. Resolves with the same
   * check once the stream settles, or null when it failed or was superseded.
   */
  const run = useCallback(
    async ({ content, label, job }: CheckRequest, onScored: (check: ResumeCheck) => void): Promise<ResumeCheck | null> => {
      runIdRef.current += 1;
      const runId = runIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const current = () => runId === runIdRef.current;

      // Captured BEFORE the await: this is the text being scored, and the one
      // the check must be compared against later. Reading it after the import
      // would stamp the check with whatever the user typed while it ran.
      const text = resumeContentToText(content);
      const jobLabel = job ? `${job.company} — ${job.role}` : null;

      setFailure(null);
      setStatus("preparing");

      try {
        const imported = await importResumeContent(content, label);
        if (!current()) return null;

        // A new ingested row, unless this exact text was already on file. Either
        // way the lists that name ingested resumes (the ATS picker's matches,
        // the cover letter's "written from") are now behind.
        if (!imported.duplicate) void queryClient.invalidateQueries({ queryKey: qk.ats.ingested() });

        setStatus("scoring");

        // Held in an object rather than a `let`: it is written from inside the
        // stream's callback, and the stamp the card shows is when the SCORE
        // landed, not when the write-up behind it finished.
        const scored: { at: Date | null } = { at: null };
        const report: ScanReport = await streamScan(
          { resumeId: imported.resumeId, jdText: job?.description ?? null, jobId: job?.id ?? null },
          {
            signal: controller.signal,
            onScored: (first) => {
              if (!current()) return;
              scored.at = new Date();
              onScored({ report: first, at: scored.at, job: jobLabel, posting: job, text });
              setStatus("explaining");
            },
          },
        );

        if (!current()) return null;
        setStatus("done");
        // A scan spends a credit, so the balance in the header is now behind.
        void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
        return { report, at: scored.at ?? new Date(), job: jobLabel, posting: job, text };
      } catch (error) {
        // An abort is this hook superseding itself; the newer run owns the state.
        if (!current() || (error instanceof Error && error.name === "AbortError")) return null;
        setFailure(describeScanFailure(error));
        setStatus("failed");
        return null;
      }
    },
    [queryClient],
  );

  return { status, failure, run, clearFailure, checking: isChecking(status) };
}
