"use client";

// The master resume — what reviewers read, what "Build for this job" and the
// extension start from — whichever kind it is: an uploaded file in My
// documents, or a resume made here (owner, 2026-10-17). The backend keeps the
// pointer (masterResumeService.ts); an upload's own `master` flag still marks
// it in the vault list, but only this says when the master is one made here.
//
// Not persisted, like the vault list it sits beside.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPut } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

export type MasterResume =
  | { source: "upload"; id: string; name: string; aiResumeId: string | null }
  | { source: "built"; id: string; name: string };

export const MASTER_PATH = "/api/documents/master";

export function useMasterResumeQuery() {
  return useQuery({
    queryKey: qk.documents.master(),
    queryFn: ({ signal }) => apiGet<MasterResume | null>(MASTER_PATH, signal),
    staleTime: STALE_TIME.documents,
  });
}

/** Whether a resume made here is the master. */
export const isBuiltMaster = (master: MasterResume | null | undefined, id: string): boolean => master?.source === "built" && master.id === id;

/** Makes a resume made here the master; an upload is made master through useSetMasterDocument as before. */
export function useSetBuiltMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiPut<MasterResume>(`${MASTER_PATH}/built`, { id, name }),
    onSuccess: (master) => {
      queryClient.setQueryData(qk.documents.master(), master);
      toast.success(`${master.name} is your master resume`, { description: "Reviewers read this one when they consider you." });
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => {
      for (const queryKey of [qk.documents.master(), qk.documents.list(), qk.recommendations.eligibility()]) void queryClient.invalidateQueries({ queryKey });
    },
  });
}
