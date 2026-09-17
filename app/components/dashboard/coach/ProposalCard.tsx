"use client";

// "Should I add this to your plan?" — the coach's only way onto the plan.
//
// The coach proposes; nothing is written until the user presses Add to plan
// (hooks/mutations/useCoachProposal.ts). Every task starts ticked, because the
// coach proposed them together, and unticking one is how it is left out. Once
// accepted or dismissed the card settles into a short record of what happened,
// and it reads the same when the conversation is opened again.
//
// For keyboard and screen-reader users: the buttons stay focusable while a
// request is out (inert, not `disabled`, which drops focus the moment it is
// pressed), one status region stays mounted through every state so the outcome
// is announced, and when the buttons give way to that outcome, focus moves to it
// rather than falling to the top of the page.

import { FC, useEffect, useId, useRef, useState } from "react";
import { Check, ListPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { apiMessage } from "@/app/lib/api/core";
import type { AcceptProposalResult, CoachProposalItem } from "@/app/lib/coach/types";
import { useAcceptCoachProposal, useDismissCoachProposal, useProposalState } from "@/hooks/mutations/useCoachProposal";

const tasksLabel = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`;

/** A sticker button that is inert while a request is out, but keeps its focus. */
const INERT_BUTTON = "cursor-default opacity-50 hover:translate-x-0 hover:translate-y-0 hover:shadow-none";

/** What an accept did. Straight after the click the answer's counts are known; opened again later, only the ids on the plan are. */
function addedSummary(proposal: CoachProposalItem, result: AcceptProposalResult | undefined): string {
  if (result) {
    const parts: string[] = [];
    if (result.created > 0) parts.push(`${tasksLabel(result.created)} added`);
    if (result.existing > 0) parts.push(`${result.existing} already on your plan`);
    return parts.length > 0 ? parts.join(" · ") : "Nothing new was added.";
  }
  const count = proposal.acceptedTaskIds.length;
  return count > 0 ? `${tasksLabel(count)} added` : "Nothing new was added.";
}

export interface ProposalCardProps {
  proposal: CoachProposalItem;
}

const ProposalCard: FC<ProposalCardProps> = ({ proposal: given }) => {
  const proposal = useProposalState(given);
  const headingId = useId();
  const accept = useAcceptCoachProposal();
  const dismiss = useDismissCoachProposal();
  const [chosen, setChosen] = useState<ReadonlySet<number>>(() => new Set(given.tasks.map((_, index) => index)));
  // Which button was pressed last, so a failed Not now is not reported under a later Add to plan.
  const [lastAction, setLastAction] = useState<"accept" | "dismiss" | null>(null);

  const busy = accept.isPending || dismiss.isPending;
  const error = lastAction === "accept" ? accept.error : lastAction === "dismiss" ? dismiss.error : null;
  // A full plan refuses tasks inside a 2xx. The same sentence per task says nothing new, so each is said once.
  const refusals = [...new Set((accept.data?.rejected ?? []).map((rejection) => rejection.message))];

  // Set by a press here, so a card that opens already settled neither announces nor takes focus.
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const focusOutcome = useRef(false);
  useEffect(() => {
    if (proposal.status === "open" || !focusOutcome.current) return;
    focusOutcome.current = false;
    // Only when the pressed button's removal left focus nowhere; someone who has moved on keeps their place.
    const active = document.activeElement;
    if (active === null || active === document.body) outcomeRef.current?.focus();
  }, [proposal.status]);

  if (proposal.tasks.length === 0) return null;

  const settledSummary = proposal.status === "accepted" ? addedSummary(proposal, accept.data) : null;
  const announcement =
    lastAction === null
      ? ""
      : proposal.status === "accepted"
        ? `Added to your plan. ${settledSummary}`
        : proposal.status === "dismissed"
          ? "Not added to your plan."
          : accept.isPending
            ? "Adding to your plan…"
            : "";
  // First in every state, so the same element carries each announcement.
  const status = (
    <p role="status" className="sr-only">
      {announcement}
    </p>
  );

  const refusalList =
    refusals.length > 0 ? (
      <ul role="alert" className="mt-2 flex flex-col gap-1 text-xs leading-relaxed text-[#b23c26]">
        {refusals.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    ) : null;

  if (proposal.status === "accepted") {
    return (
      <DashCard className="bg-[#fbfbf7] p-4 w-full">
        {status}
        <div className="flex items-center gap-2">
          <span aria-hidden className="grid h-5 w-5 flex-none place-content-center rounded-full bg-secondary text-primary">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <p ref={outcomeRef} tabIndex={-1} className="text-sm font-semibold text-primary focus:outline-none">
            Added to your plan
          </p>
        </div>
        <p className="mt-1 pl-7 text-xs text-black/50">{settledSummary}</p>
        {refusalList}
      </DashCard>
    );
  }

  if (proposal.status === "dismissed") {
    return (
      <DashCard className="bg-[#fbfbf7] px-4 py-3 w-full">
        {status}
        <p ref={outcomeRef} tabIndex={-1} className="text-xs text-black/45 focus:outline-none">
          Not added to your plan.
        </p>
      </DashCard>
    );
  }

  const toggle = (index: number) => {
    if (busy) return;
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const onAdd = () => {
    if (busy || chosen.size === 0) return;
    setLastAction("accept");
    focusOutcome.current = true;
    accept.mutate(
      { proposal, taskIndexes: [...chosen].sort((a, b) => a - b) },
      {
        // Still open (a failure, or a full plan refusing every task): the buttons stay, and so does focus.
        onSettled: (result) => {
          if (result?.proposal.status !== "accepted") focusOutcome.current = false;
        },
      },
    );
  };

  const onDismiss = () => {
    if (busy) return;
    setLastAction("dismiss");
    focusOutcome.current = true;
    dismiss.mutate(proposal, {
      onError: () => {
        focusOutcome.current = false;
      },
    });
  };

  const addInert = busy || chosen.size === 0;

  return (
    <DashCard role="group" aria-labelledby={headingId} className="bg-[#fbfbf7] p-4 w-full">
      {status}
      <div className="flex items-center gap-2">
        <ListPlus aria-hidden className="h-4 w-4 flex-none text-primary" />
        <p id={headingId} className="text-sm font-semibold text-primary">
          {proposal.tasks.length === 1 ? "Add this to your plan?" : "Add these to your plan?"}
        </p>
      </div>

      <ul className="mt-2.5 flex flex-col gap-0.5">
        {proposal.tasks.map((task, index) => {
          const checked = chosen.has(index);
          return (
            <li key={index}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(index)}
                aria-disabled={busy || undefined}
                className="group flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325]/30 aria-disabled:cursor-default">
                <NeoCheckbox checked={checked} size="sm" className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug text-primary break-words">{task.title}</span>
                  {task.detail && <span className="mt-0.5 block text-xs leading-relaxed text-black/50 break-words">{task.detail}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StickerButton
          variant="primary"
          size="sm"
          onClick={onAdd}
          aria-disabled={addInert || undefined}
          aria-busy={accept.isPending || undefined}
          className={cn(addInert && INERT_BUTTON)}>
          {accept.isPending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <ListPlus aria-hidden className="h-3.5 w-3.5" />}
          Add to plan
        </StickerButton>
        <StickerButton
          variant="outline"
          size="sm"
          onClick={onDismiss}
          aria-disabled={busy || undefined}
          aria-busy={dismiss.isPending || undefined}
          className={cn(busy && INERT_BUTTON)}>
          {dismiss.isPending && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
          Not now
        </StickerButton>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-[#b23c26]">
          {apiMessage(error)}
        </p>
      ) : null}
      {refusalList}
    </DashCard>
  );
};

export default ProposalCard;
