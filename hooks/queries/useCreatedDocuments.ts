"use client";

// The resumes and cover letters made here, as My documents lists them —
// archived ones included — and what My documents can do to them: rename,
// archive or restore, delete. Each is the editor's own document (the AI
// service's library), so these act on it directly; nothing is copied into the
// vault. See app/lib/documents/library.ts.
//
// Not persisted, like the vault list: names of someone's applications have no
// business surviving on a shared machine.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { ALL_LETTERS, deleteLetter, listLetters, setLetterArchived, updateLetter } from "@/app/lib/cover/api";
import { deleteResumeDocument, listResumeSummaries, saveResumeDocument, setResumeArchived } from "@/app/lib/resume/api";
import { STALE_TIME, qk } from "@/app/lib/query/keys";

export type CreatedKind = "resume" | "cover-letter";

export function useCreatedDocuments() {
  const resumes = useQuery({
    queryKey: qk.resumes.library(),
    queryFn: ({ signal }) => listResumeSummaries(signal),
    staleTime: STALE_TIME.documents,
  });
  const letters = useQuery({
    queryKey: qk.letters.library(),
    queryFn: async ({ signal }) => {
      try {
        return await listLetters("summary", signal, ALL_LETTERS, "include");
      } catch (error) {
        // A service from before My documents listed letters refuses the limit; it answers its newest 50.
        if (error instanceof BackendError && error.status === 400) return listLetters("summary", signal);
        throw error;
      }
    },
    staleTime: STALE_TIME.documents,
  });
  return { resumes, letters };
}

/** Just the resumes made here, for a picker that has no use for the letters (the apply wizard's "Select resume"). */
export function useCreatedResumes() {
  return useQuery({
    queryKey: qk.resumes.library(),
    queryFn: ({ signal }) => listResumeSummaries(signal),
    staleTime: STALE_TIME.documents,
  });
}

type Action = { kind: CreatedKind; id: string } &({ type: "rename"; name: string } | { type: "archive"; archived: boolean } | { type: "remove" });

/** One mutation for every action on a made-here document; each refreshes My documents and the editors' lists. */
export function useCreatedDocumentAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: Action): Promise<unknown> => {
      const resume = action.kind === "resume";
      switch (action.type) {
        case "rename":
          return resume ? saveResumeDocument(action.id, { label: action.name }) : updateLetter(action.id, { label: action.name });
        case "archive":
          return resume ? setResumeArchived(action.id, action.archived) : setLetterArchived(action.id, action.archived);
        case "remove":
          return resume ? deleteResumeDocument(action.id) : deleteLetter(action.id);
      }
    },
    onSuccess: (_, action) => {
      if (action.type === "remove") toast.success(action.kind === "resume" ? "Resume deleted" : "Cover letter deleted");
      if (action.type === "archive") toast.success(action.archived ? "Archived — it's under Archived now" : "Restored");
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: (_, __, action) => {
      const keys = action.kind === "resume" ? [qk.resumes.library(), qk.resumes.list()] : [qk.letters.library(), qk.letters.recent()];
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    },
  });
}
