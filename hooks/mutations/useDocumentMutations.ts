"use client";

// Every document action.
//
// Uploads go through a relative path so the Next rewrite carries the session
// cookie — NOT through a server action, whose 1MB body cap would reject a
// normal CV with an error that looks like a network fault.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiPatch, apiPost } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
import type { DocKind, VaultDoc } from "@/app/lib/dashboard/types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const listKey = () => qk.documents.list();

/** Every mutation ends here: the server owns the list, so refetch rather than patch. */
function useDocumentAction<V, R>(run: (vars: V) => Promise<R>, onDone?: (result: R, vars: V) => void) {
  const queryClient = useQueryClient();

  return useMutation<R, unknown, V>({
    mutationFn: run,
    onSuccess: (result, vars) => {
      void queryClient.invalidateQueries({ queryKey: listKey() });
      onDone?.(result, vars);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
}

export const useUploadDocument = () =>
  useDocumentAction<{ file: File; kind?: DocKind }, VaultDoc>(({ file, kind }) => {
    // Checked here as well as on the server so the common mistake never spends
    // ten megabytes of someone's upload bandwidth to be told no.
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("That file is larger than 10MB");
    const body = new FormData();
    body.append("file", file);
    if (kind) body.append("kind", kind);
    return apiPost<VaultDoc>("/api/documents", body);
  }, (doc) => toast.success(`${doc.name} added`, { description: "It's in My documents." }));

export const useRenameDocument = () =>
  useDocumentAction<{ id: string; name: string }, VaultDoc>(({ id, name }) => apiPatch<VaultDoc>(`/api/documents/${id}`, { name }));

export const useArchiveDocument = () =>
  useDocumentAction<{ id: string; archived: boolean }, VaultDoc>(
    ({ id, archived }) => apiPatch<VaultDoc>(`/api/documents/${id}`, { archived }),
    (doc) => toast.success(doc.archived ? "Archived" : "Restored", { description: doc.archived ? `${doc.name} is hidden from pickers.` : undefined }),
  );

export const useSetMasterDocument = () =>
  useDocumentAction<string, VaultDoc>(
    (id) => apiPatch<VaultDoc>(`/api/documents/${id}`, { master: true }),
    (doc) => toast.success(`${doc.name} is your master resume`, { description: "Reviewers read this one when they consider you." }),
  );

export const useDeleteDocument = () =>
  useDocumentAction<string, { deleted: true }>((id) => apiDelete<{ deleted: true }>(`/api/documents/${id}`), () => toast.success("Deleted"));
