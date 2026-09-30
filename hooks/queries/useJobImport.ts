"use client";

// Watches one job import until it settles.
//
// Imports are asynchronous because a rendered crawl plus an extraction can
// outlive Next's 30-second rewrite proxy: POST answers 202 with an id, and this
// polls GET until the status is terminal. Polling rather than a push channel
// because the product has none, and it is bounded by construction: the backend
// reports anything still in flight past its stale window as `failed` with
// `timeout`, so even an import whose process died settles within ~90 s.
//
// Not persisted and barely cached (`gcTime: 0`): a progress snapshot means
// nothing to anyone but the dialog watching it.

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
// The poll cadence (`importPollDelay`) lives in app/lib/jobs/api.ts, shared with parse-jd.
import { getJobImport, importPollDelay, isTerminalImportStatus } from "@/app/lib/jobs/api";
import type { JobImportItem, JobImportStatus } from "@/app/lib/jobs/types";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

export interface UseJobImportOptions {
  /** Called once per watch, when the import reaches `done`, `failed` or `abandoned`. */
  onSettled?: (item: JobImportItem) => void;
  /**
   * Called once per watch if polling itself fails for good: a 404 (the import
   * expired, or is not this user's), or a network or 5xx failure that outlasted
   * the query client's retries. Polling stops; the import may still be running.
   */
  onError?: (error: unknown, importId: string) => void;
}

export interface JobImportWatch {
  /** The latest snapshot, or null before the first answer. */
  item: JobImportItem | null;
  /** Its status: the live stage a waiting dialog shows. */
  status: JobImportStatus | null;
  /** True until the import settles, polling fails, or `stop` is called. */
  polling: boolean;
  error: unknown;
  /** Stop polling this id. Does not abandon the import — see `forgetJobImport` for that. */
  stop: () => void;
}

/** Poll `importId` until it settles. Pass null to watch nothing. */
export function useJobImport(importId: string | null, { onSettled, onError }: UseJobImportOptions = {}): JobImportWatch {
  const queryClient = useQueryClient();

  // Stopping belongs to one watch, not to an id forever. The backend can hand
  // the same id back (a resubmit while that posting is still in flight, e.g.
  // after an abandon request failed), and a stop that outlived the watch would
  // leave that second watch never polling. So a change of id clears it,
  // adjusted during render — React's documented way to reset state when an
  // input changes — so no render ever polls an id its caller already stopped.
  const [watchedId, setWatchedId] = useState(importId);
  const [stoppedId, setStoppedId] = useState<string | null>(null);
  if (watchedId !== importId) {
    setWatchedId(importId);
    setStoppedId(null);
  }
  const active = importId !== null && importId !== stoppedId;

  const query = useQuery({
    queryKey: qk.jobImports.detail(importId ?? ""),
    queryFn: importId !== null && importId !== stoppedId ? ({ signal }) => getJobImport(importId, signal) : skipToken,
    staleTime: STALE_TIME.jobImports,
    gcTime: 0,
    refetchInterval: (current) => {
      if (current.state.status === "error" || isTerminalImportStatus(current.state.data?.status)) return false;
      return importPollDelay(current.state.dataUpdateCount);
    },
    // Keep asking while the tab is hidden. It is bounded (see the header), and
    // someone who tabs away to copy the posting comes back to filled fields
    // instead of a spinner that only then resumes.
    refetchIntervalInBackground: true,
  });

  const item = query.data ?? null;
  const settled = isTerminalImportStatus(item?.status);

  // Each callback fires once per watch. The marks reset whenever the id
  // changes (declared first, so the reset lands before the checks below in the
  // same commit), which is what lets a re-watch of the same id report again.
  const settledFor = useRef<string | null>(null);
  const failedFor = useRef<string | null>(null);
  useEffect(() => {
    settledFor.current = null;
    failedFor.current = null;
  }, [importId]);

  const reportSettled = useEffectEvent((next: JobImportItem) => onSettled?.(next));
  const reportError = useEffectEvent((error: unknown, id: string) => onError?.(error, id));

  useEffect(() => {
    if (!active || !item || !settled || item.id !== importId || settledFor.current === item.id) return;
    settledFor.current = item.id;
    reportSettled(item);
  }, [active, item, settled, importId]);

  const failure = query.isError ? query.error : null;
  useEffect(() => {
    if (!active || importId === null || failure === null || failedFor.current === importId) return;
    failedFor.current = importId;
    reportError(failure, importId);
  }, [active, failure, importId]);

  const stop = useCallback(() => {
    if (importId === null) return;
    setStoppedId(importId);
    void queryClient.cancelQueries({ queryKey: qk.jobImports.detail(importId) });
  }, [importId, queryClient]);

  return {
    item,
    status: item?.status ?? null,
    polling: active && !settled && !query.isError,
    error: failure,
    stop,
  };
}
