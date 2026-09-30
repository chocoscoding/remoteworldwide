"use client";

// One run of one tool on the resume screen's AI rail.
//
// A plain hook with local state rather than a React Query mutation, for the
// same reason `useScanResume` is one: there is nothing to cache. A tool's
// result is applied to the document on screen and is then the document — it is
// not a server resource anyone re-reads, and re-running the same tool is
// expected to produce something new rather than a cache hit.
//
// What the hook owns is the three things every caller would otherwise repeat:
// only one tool runs at a time, a failure says something a person can act on,
// and a charged run leaves the credit meter behind until the billing overview
// is refetched.
//
// No abort. A tool that has reached the model has already committed its tokens,
// so cancelling saves nothing and only risks dropping the answer between the
// completion and the charge — the same call the scan controller makes about
// phase two.

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { costsCredit, type SuggestionTool } from "@/app/lib/resume/ai";
import { qk } from "@/app/lib/query/keys";

export interface SuggestionFailure {
  message: string;
  /** Too few credits. Nothing was generated or charged, and topping up fixes it. */
  needsCredits: boolean;
}

const describe = (error: unknown): SuggestionFailure => {
  if (error instanceof BackendError && error.status === 402) return { message: error.message, needsCredits: true };
  return { message: apiMessage(error), needsCredits: false };
};

export function useResumeSuggestion() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState<SuggestionTool | null>(null);
  const [failure, setFailure] = useState<SuggestionFailure | null>(null);

  // Only the newest run may write back. A second tool started while the first
  // is out would otherwise land its result on top of a document the user has
  // since changed under a different tool.
  const runIdRef = useRef(0);

  /**
   * Runs one tool and resolves with its result, or null when it failed or was
   * superseded — so the caller applies an edit without reading state back
   * during a render.
   *
   * `call` is the typed function from `app/lib/resume/ai.ts`; the tool name is
   * passed alongside it only so the hook can say which button is busy and
   * whether a credit was spent.
   */
  const run = useCallback(
    async <T,>(tool: SuggestionTool, call: () => Promise<T>): Promise<T | null> => {
      runIdRef.current += 1;
      const runId = runIdRef.current;
      const current = () => runId === runIdRef.current;

      setRunning(tool);
      setFailure(null);

      try {
        const result = await call();
        if (!current()) return null;
        setRunning(null);

        // The sidebar's credit meter is now behind. The free two spend nothing,
        // so refetching for them would be a request that can only confirm a
        // number that did not move.
        if (costsCredit(tool)) void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
        return result;
      } catch (error) {
        if (!current()) return null;
        setRunning(null);
        const described = describe(error);
        setFailure(described);
        // A toast as well as the inline caption: the rail can be scrolled past
        // the tool that failed, and a run that silently does nothing reads as a
        // broken button.
        toast.error(described.message);
        return null;
      }
    },
    [queryClient],
  );

  const clearFailure = useCallback(() => setFailure(null), []);

  return { running, failure, run, clearFailure };
}
