"use client";

// Every change to the saved-answer library.
//
// Edits, resolves and deletes are optimistic — cancel, snapshot, write, roll
// back on failure — because each is one click on a row the user is looking at,
// and watching their own choice revert for a round trip reads as the click not
// landing. A create is not: the server decides whether the question is already
// saved (its key, not ours), and the answer to that is what the dialog shows.
//
// Every settle invalidates the whole `answers` domain, not just the list: the
// history links each use to the library by question, so an add or a delete
// changes which rows offer "Save to library".
//
// Success toasts are the caller's (AnswersProvider): the Undo on each needs the
// row as it was, which only the caller holds. Failures toast here, through
// `apiMessage`, so the copy is decided in one place.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiMessage } from "@/app/lib/api/core";
import { createAnswer, deleteAnswer, resolveAnswer, updateAnswer } from "@/app/lib/answers/api";
import type { AddAnswerResult, AnswerResolveChoice, CreateAnswerInput, DeleteAnswerResult, UpdateAnswerInput } from "@/app/lib/answers/types";
import type { QaItem } from "@/app/lib/dashboard/types";
import { qk } from "@/app/lib/query/keys";

const listKey = () => qk.answers.list();

interface Snapshot {
  previous: QaItem[] | undefined;
}

async function writeOptimistically(queryClient: QueryClient, write: (items: QaItem[]) => QaItem[]): Promise<Snapshot> {
  // Stop an in-flight refetch from landing on top of the optimistic write.
  await queryClient.cancelQueries({ queryKey: listKey() });
  const previous = queryClient.getQueryData<QaItem[]>(listKey());
  if (previous) queryClient.setQueryData<QaItem[]>(listKey(), write(previous));
  return { previous };
}

function rollBack(queryClient: QueryClient, context: Snapshot | undefined) {
  if (context?.previous) queryClient.setQueryData(listKey(), context.previous);
}

/** The server's row replaces the optimistic guess. */
function storeItem(queryClient: QueryClient, item: QaItem) {
  queryClient.setQueryData<QaItem[]>(listKey(), (old) => old?.map((row) => (row.id === item.id ? item : row)));
}

function refresh(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: qk.answers.all });
}

/**
 * The server's edit rules, mirrored for the optimistic write only — the
 * response replaces it. An AI answer the user edits becomes theirs; a draft
 * string makes the answer a review; a null draft settles it.
 */
function patched(item: QaItem, patch: UpdateAnswerInput): QaItem {
  let { a, cat, kind, draft } = item;
  if (patch.a !== undefined) {
    a = patch.a;
    if (kind === "ai") kind = "saved";
  }
  if (patch.cat !== undefined) cat = patch.cat;
  if (patch.draft !== undefined) {
    if (patch.draft === null) {
      draft = undefined;
      if (kind === "review") kind = "saved";
    } else {
      draft = patch.draft;
      kind = "review";
    }
  }
  return kind === "review" && draft ? { id: item.id, q: item.q, a, kind, cat, draft } : { id: item.id, q: item.q, a, kind, cat };
}

function resolved(item: QaItem, choice: AnswerResolveChoice): QaItem {
  return { id: item.id, q: item.q, a: choice === "draft" ? (item.draft ?? item.a) : item.a, kind: "saved", cat: item.cat };
}

/** Saves a new answer. Resolves with the existing one when the question is already saved. */
export function useCreateAnswer() {
  const queryClient = useQueryClient();
  return useMutation<AddAnswerResult, unknown, CreateAnswerInput>({
    mutationFn: createAnswer,
    onSuccess: (result) => {
      // Newest first, where the list puts it, without waiting for the refetch.
      if (result.added) {
        queryClient.setQueryData<QaItem[]>(listKey(), (old) =>
          old && !old.some((row) => row.id === result.item.id) ? [result.item, ...old] : old,
        );
      }
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => refresh(queryClient),
  });
}

export interface UpdateAnswerVariables {
  id: string;
  patch: UpdateAnswerInput;
}

export function useUpdateAnswer() {
  const queryClient = useQueryClient();
  return useMutation<QaItem, unknown, UpdateAnswerVariables, Snapshot>({
    mutationFn: ({ id, patch }) => updateAnswer(id, patch),
    onMutate: ({ id, patch }) => writeOptimistically(queryClient, (items) => items.map((row) => (row.id === id ? patched(row, patch) : row))),
    onError: (error, _vars, context) => {
      rollBack(queryClient, context);
      toast.error(apiMessage(error));
    },
    onSuccess: (item) => storeItem(queryClient, item),
    onSettled: () => refresh(queryClient),
  });
}

export interface ResolveAnswerVariables {
  id: string;
  choice: AnswerResolveChoice;
}

export function useResolveAnswer() {
  const queryClient = useQueryClient();
  return useMutation<QaItem, unknown, ResolveAnswerVariables, Snapshot>({
    mutationFn: ({ id, choice }) => resolveAnswer(id, choice),
    onMutate: ({ id, choice }) => writeOptimistically(queryClient, (items) => items.map((row) => (row.id === id ? resolved(row, choice) : row))),
    onError: (error, _vars, context) => {
      rollBack(queryClient, context);
      toast.error(apiMessage(error));
    },
    onSuccess: (item) => storeItem(queryClient, item),
    onSettled: () => refresh(queryClient),
  });
}

export function useDeleteAnswer() {
  const queryClient = useQueryClient();
  return useMutation<DeleteAnswerResult, unknown, string, Snapshot>({
    mutationFn: deleteAnswer,
    onMutate: (id) => writeOptimistically(queryClient, (items) => items.filter((row) => row.id !== id)),
    onError: (error, _id, context) => {
      rollBack(queryClient, context);
      toast.error(apiMessage(error));
    },
    onSettled: () => refresh(queryClient),
  });
}
