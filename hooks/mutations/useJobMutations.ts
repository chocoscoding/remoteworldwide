"use client";

// Every saved-job and job-import write.
//
// Errors toast by default, the house style, with one exception that matters:
// the job picker passes `{ toastErrors: false }` and shows each failure inline,
// next to the thing that failed. A toast is actively harmful there. When the
// picker is open over the win log, clicking a toast counts as a click outside
// the win log, which closes it and throws its draft away.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiMessage } from "@/app/lib/api/core";
import {
  abandonJobImport,
  deleteSavedJob,
  saveJob,
  startJobImport,
  updateSavedJob,
  type StartedJobImport,
} from "@/app/lib/jobs/api";
import type { SaveJobInput, SavedJobItem, StartJobImportInput, UpdateSavedJobInput } from "@/app/lib/jobs/types";
import { qk } from "@/app/lib/query/keys";

export interface JobWriteOptions {
  /** Report a failure with a toast. Turn it off wherever the error is shown inline (see the note above). */
  toastErrors?: boolean;
}

/**
 * The row we were handed is written straight into its detail entry; lists are
 * refetched instead, because the server owns their order (`lastUsedAt`) and a
 * save can move a row from the bottom of "Your jobs" to the top.
 */
function storeSavedJob(queryClient: QueryClient, job: SavedJobItem) {
  queryClient.setQueryData(qk.savedJobs.detail(job.id), job);
  void queryClient.invalidateQueries({ queryKey: qk.savedJobs.lists() });
}

const reportWith = (toastErrors: boolean) => (error: unknown) => {
  if (toastErrors) toast.error(apiMessage(error));
};

/** Save a listing (`{ platformJobId }`) or a checked draft. A duplicate resolves with the existing row. */
export function useSaveJob({ toastErrors = true }: JobWriteOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation<SavedJobItem, unknown, SaveJobInput>({
    mutationFn: saveJob,
    onSuccess: (job) => storeSavedJob(queryClient, job),
    onError: reportWith(toastErrors),
  });
}

export function useUpdateSavedJob({ toastErrors = true }: JobWriteOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation<SavedJobItem, unknown, { id: string; input: UpdateSavedJobInput }>({
    mutationFn: ({ id, input }) => updateSavedJob(id, input),
    onSuccess: (job) => storeSavedJob(queryClient, job),
    onError: reportWith(toastErrors),
  });
}

export function useDeleteSavedJob({ toastErrors = true }: JobWriteOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, string>({
    mutationFn: deleteSavedJob,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: qk.savedJobs.detail(id) });
      void queryClient.invalidateQueries({ queryKey: qk.savedJobs.lists() });
      toast.success("Removed from your jobs");
    },
    onError: reportWith(toastErrors),
  });
}

/**
 * Start an import. Any cached snapshot under the returned id is dropped first:
 * the backend hands back the existing id when the same posting is already in
 * flight for this user, and a poll must never begin from a snapshot left over
 * from an earlier watch of that id.
 */
export function useStartJobImport({ toastErrors = true }: JobWriteOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation<StartedJobImport, unknown, StartJobImportInput>({
    mutationFn: startJobImport,
    onSuccess: ({ importId }) => queryClient.removeQueries({ queryKey: qk.jobImports.detail(importId) }),
    onError: reportWith(toastErrors),
  });
}

/**
 * Stop watching an import and tell the backend to abandon it. Fire and forget,
 * with nowhere to report a failure and no need to: the picker calls this on
 * Cancel and when it closes with an import still running, and an import nobody
 * watches is reported as timed out by the backend's stale window and expires
 * within a day anyway.
 */
export function forgetJobImport(queryClient: QueryClient, id: string): void {
  void queryClient.cancelQueries({ queryKey: qk.jobImports.detail(id) });
  abandonJobImport(id).catch(() => undefined);
}

/** `forgetJobImport` as a hook, for screens that would rather not hold the query client themselves. */
export function useAbandonJobImport() {
  const queryClient = useQueryClient();
  return (id: string) => forgetJobImport(queryClient, id);
}
