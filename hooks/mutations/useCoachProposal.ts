"use client";

// Accept or dismiss one of the coach's plan proposals.
//
// Nothing reaches the plan without this click. Accepting sends the chosen task
// indexes, and the AI service adds each with the dedupeKey
// `coach:{proposalId}:{index}`, so a double-click, or a retry after a lost
// answer, still adds each task once. The plan is refetched when an accept
// settles, whatever the answer: a backend failure after a partial write still
// comes back as a 502.
//
// No toasts, unlike the house default. The card shows its own failure beside
// its buttons. A 409 means another tab has already accepted or dismissed the
// proposal, so the conversation is read again and the card settles to match.
//
// A settled proposal is remembered for the page. The same proposal can be on
// screen twice over one turn, first from the stream and then from the session's
// stored messages, and a card that remounts onto a stored copy still saying
// "open" must not offer Add to plan again for a proposal already accepted.

import { useSyncExternalStore } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { BackendError } from "@/app/lib/api/core";
import { acceptCoachProposal, dismissCoachProposal } from "@/app/lib/coach/api";
import type { AcceptProposalResult, CoachProposalItem, CoachSessionDetail } from "@/app/lib/coach/types";
import { qk } from "@/app/lib/query/keys";
import { periodOf } from "@/app/lib/tasks/types";

const settled = new Map<string, CoachProposalItem>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Accepted and dismissed are final; a proposal never goes back to open. */
function remember(proposal: CoachProposalItem) {
  if (proposal.status === "open") return;
  settled.set(proposal.id, proposal);
  listeners.forEach((listener) => listener());
}

/** `proposal` as this page last knew it: a settled answer outranks a copy that still says open. */
export function useProposalState(proposal: CoachProposalItem): CoachProposalItem {
  const known = useSyncExternalStore(
    subscribe,
    () => settled.get(proposal.id),
    () => undefined,
  );
  return proposal.status === "open" && known ? known : proposal;
}

function storeProposal(queryClient: QueryClient, proposal: CoachProposalItem) {
  remember(proposal);
  queryClient.setQueryData<CoachSessionDetail>(qk.coach.session(proposal.sessionId), (detail) => {
    if (!detail || !detail.messages.some((message) => message.proposal?.id === proposal.id)) return detail;
    return {
      ...detail,
      messages: detail.messages.map((message) => (message.proposal?.id === proposal.id ? { ...message, proposal } : message)),
    };
  });
}

function refetchIfSettledElsewhere(queryClient: QueryClient, error: unknown, proposal: CoachProposalItem) {
  if (error instanceof BackendError && error.status === 409) {
    void queryClient.invalidateQueries({ queryKey: qk.coach.session(proposal.sessionId) });
  }
}

export interface AcceptCoachProposalVariables {
  proposal: CoachProposalItem;
  /** Indexes into `proposal.tasks`, the ones left ticked. */
  taskIndexes: number[];
}

export function useAcceptCoachProposal() {
  const queryClient = useQueryClient();
  return useMutation<AcceptProposalResult, unknown, AcceptCoachProposalVariables>({
    // The month the plan panel beside the chat shows (the user's local month).
    // Left to the backend, it would be the UTC month, which near midnight at a
    // month's end is a different plan from the one on screen.
    mutationFn: ({ proposal, taskIndexes }) => acceptCoachProposal(proposal.id, { taskIndexes, period: periodOf(new Date()) }),
    onSuccess: (result) => storeProposal(queryClient, result.proposal),
    onError: (error, { proposal }) => refetchIfSettledElsewhere(queryClient, error, proposal),
    // Not returned: a returned promise would hold `isPending` until the plan had refetched.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tasks.all });
    },
  });
}

export function useDismissCoachProposal() {
  const queryClient = useQueryClient();
  return useMutation<CoachProposalItem, unknown, CoachProposalItem>({
    // A 2xx is the dismissal, whatever the body holds.
    mutationFn: async (proposal) => (await dismissCoachProposal(proposal.id)) ?? { ...proposal, status: "dismissed" },
    onSuccess: (proposal) => storeProposal(queryClient, proposal),
    onError: (error, proposal) => refetchIfSettledElsewhere(queryClient, error, proposal),
  });
}
