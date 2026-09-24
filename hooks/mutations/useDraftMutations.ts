"use client";

// Every drafts-page write: deleting a draft, and "Mark as applied".
//
// A delete is optimistic — cancel, snapshot, remove, put back on failure —
// because it is one confirmed click on a row the user is looking at. There is
// no Undo: the server forgets the draft, and nothing here could put it back.
//
// "Mark as applied" is the apply wizard's `track()` run from a draft
// (rwwextension/docs/drafts.md §9): a duplicate check, then either the saved
// tracker card for this job moves to Applied, or a new application is created
// carrying the draft's question answers and cover letter. Then the draft is
// fused into that application, which files its answers under the Questions
// screen's "By application" tab and moves it to the drafts page's Applied tab.
// Unlike `track()` it waits for the server rather than writing the board first:
// the fuse needs the application's real id, and the dialog stays open until
// there is one. Its failures are the dialog's to show, inline, so this hook
// does not toast them.

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { applicationInput, createApplication, findDuplicateApplication, isObjectId, updateApplication, wasApplied } from "@/app/lib/applications/api";
import type { ApplicationItem, UpdateApplicationInput } from "@/app/lib/applications/types";
import { deleteDraft, draftApplicationAnswers, draftCoverLetter, fuseDraft } from "@/app/lib/drafts/api";
import type { ApplicationDraftItem } from "@/app/lib/drafts/types";
import { qk } from "@/app/lib/query/keys";
import { refreshStreak } from "./useStreakMutations";

/** Where a tracked application is seen. The tracker has no deep link to one card, so this is the board itself. */
export const TRACKER_HREF = "/dashboard/tracker";

interface Snapshot {
  previous: Array<[QueryKey, ApplicationDraftItem[] | undefined]>;
}

/** Every cached drafts list, whichever status it was read with. */
const listsFilter = () => ({ queryKey: qk.drafts.all });

/**
 * Writes the server's copy of one draft into every cached list, dropping it
 * from a list whose status it no longer has (`list(status)`'s third segment).
 * A fused draft leaves "In progress" at once, rather than after the refetch.
 */
function storeDraft(queryClient: QueryClient, draft: ApplicationDraftItem) {
  for (const [key, rows] of queryClient.getQueriesData<ApplicationDraftItem[]>(listsFilter())) {
    if (!rows) continue;
    const status = key[2];
    const next = rows.some((row) => row.id === draft.id) ? rows.map((row) => (row.id === draft.id ? draft : row)) : [draft, ...rows];
    queryClient.setQueryData<ApplicationDraftItem[]>(
      key,
      next.filter((row) => status === "all" || row.status === status),
    );
  }
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation<{ deleted: true }, unknown, string, Snapshot>({
    mutationFn: deleteDraft,
    onMutate: async (id) => {
      // Stop an in-flight refetch from landing on top of the removal.
      await queryClient.cancelQueries(listsFilter());
      const previous = queryClient.getQueriesData<ApplicationDraftItem[]>(listsFilter());
      queryClient.setQueriesData<ApplicationDraftItem[]>(listsFilter(), (rows) => rows?.filter((row) => row.id !== id));
      return { previous };
    },
    onSuccess: () => toast.success("Draft deleted"),
    onError: (error, _id, context) => {
      // Already gone — deleted from the extension ("Start fresh"), or in another
      // tab. That is what was asked for, so the row stays out.
      if (error instanceof BackendError && error.status === 404) {
        toast.success("Draft deleted");
        return;
      }
      for (const [key, rows] of context?.previous ?? []) queryClient.setQueryData(key, rows);
      toast.error(apiMessage(error));
    },
    onSettled: () => void queryClient.invalidateQueries(listsFilter()),
  });
}

export interface MarkDraftAppliedVars {
  draft: ApplicationDraftItem;
  /** As confirmed in the dialog: both required, prefilled from the draft. */
  company: string;
  role: string;
}

export interface MarkDraftAppliedResult {
  application: ApplicationItem;
  /** False when the fuse did not happen here; the backend's own fuse on the same write may still have. */
  fused: boolean;
  /** The draft as the fuse left it, or null when the fuse failed. */
  draft: ApplicationDraftItem | null;
}

/**
 * The tracker row first, the fuse second. A row that saved is the outcome the
 * user asked for, so a failed fuse does not fail the mutation: the backend
 * fuses on that same write by the draft's url or saved job (§5), and the
 * refetch after it shows where the draft ended up.
 */
async function markApplied({ draft, company, role }: MarkDraftAppliedVars): Promise<MarkDraftAppliedResult> {
  const answers = draftApplicationAnswers(draft);
  const coverLetter = draftCoverLetter(draft);
  const input = applicationInput({
    company,
    role,
    location: draft.location,
    url: draft.url,
    savedJobId: isObjectId(draft.savedJobId) ? draft.savedJobId : null,
    source: "external",
    status: "applied",
    answers,
    coverLetter,
    // A retried create (a lost answer, a second click after a failure) returns the first row.
    idempotencyKey: `draft:${draft.id}`,
  });

  // A warning in the wizard, a routing decision here. When the check itself
  // fails the job is treated as new, as the wizard does; the key above keeps a
  // retry from writing twice.
  const prior = await findDuplicateApplication({ company: input.company, role: input.role, url: input.url ?? undefined }).catch(() => null);

  let application: ApplicationItem;
  if (prior && prior.status === "saved") {
    // The saved card for this job moves to Applied rather than gaining a twin.
    // What was sent rides along only when there is some: an empty list would
    // clear answers the card already holds.
    const patch: UpdateApplicationInput = { status: "applied" };
    if (answers.length > 0) patch.answers = answers;
    if (coverLetter) patch.coverLetter = coverLetter;
    application = await updateApplication(prior.id, patch);
  } else {
    application = await createApplication({ ...input, duplicateOf: prior && wasApplied(prior) ? prior.id : null });
  }

  try {
    const result = await fuseDraft({ applicationId: application.id, draftId: draft.id });
    return { application, fused: result.fused, draft: result.draft };
  } catch {
    // See above: the application is tracked either way.
    return { application, fused: false, draft: null };
  }
}

/**
 * "Mark as applied" for one draft. On success: the draft's new state goes into
 * every cached list and a toast offers the way to the tracker. Settled either
 * way, the drafts, the applications (the board, the duplicate checks nested
 * under it, the funnel), the plan (follow-ups move with an application), the
 * answer history and the streak all refetch.
 */
export function useMarkDraftApplied() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation<MarkDraftAppliedResult, unknown, MarkDraftAppliedVars>({
    mutationFn: markApplied,
    onSuccess: ({ application, fused, draft }) => {
      if (draft) storeDraft(queryClient, draft);
      toast.success(`${application.role} at ${application.company} is marked as applied`, {
        description: fused ? "It's on your tracker, and its answers are with your application answers." : "It's on your tracker.",
        action: { label: "View in tracker", onClick: () => router.push(TRACKER_HREF) },
      });
    },
    // On failure too: a create whose answer was lost may still have written the row.
    onSettled: () => {
      void queryClient.invalidateQueries(listsFilter());
      void queryClient.invalidateQueries({ queryKey: qk.activity.applications() });
      void queryClient.invalidateQueries({ queryKey: qk.activity.summary() });
      void queryClient.invalidateQueries({ queryKey: qk.tasks.all });
      void queryClient.invalidateQueries({ queryKey: qk.answers.history() });
      // The server records the application's streak action with the write.
      refreshStreak(queryClient);
    },
  });
}
