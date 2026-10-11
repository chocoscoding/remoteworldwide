"use client";

import { FC, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowBigDown, ArrowBigUp, Lock, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { usePod } from "./PodProvider";
import { GOAL_KIND_META } from "./pod-goal-meta";
import { isPendingGoal, myVote, tally } from "@/app/lib/pod/goalVotes";
import type { PodGoal } from "@/app/lib/dashboard/types";

/**
 * Goal management as a popup — the old version lived collapsed inside the
 * dark hero, where progress bars fought the ink background and voting was a
 * wall of text. Here it's on white, one goal per card, and voting is an
 * upvote and a downvote on the goal itself: lime when you upvoted, red when
 * you downvoted. Every click shows at once (the goal writes are optimistic).
 */
export interface ManageGoalsDialogProps {
  onClose: () => void;
  /** Opens the "Suggest a goal" form (a sibling dialog owned by the page). */
  onSuggest: () => void;
  /** The goal a "goal under review" notification pointed at: scrolled to and briefly ringed. */
  focusGoalId?: string | null;
}

/** How long the linked goal stays ringed after the dialog opens on it. */
const FOCUS_RING_MS = 2400;

/**
 * Upvote / downvote, each a toggle: pressing the arrow you hold takes your vote back, and pressing
 * the other one switches it. A suggestion still waiting for its server id can't be voted on yet.
 */
const VoteButtons: FC<{ goal: PodGoal; onVote: (choice: "for" | "against" | null) => void }> = ({ goal, onVote }) => {
  const mine = myVote(goal);
  const { up, down } = tally(goal);
  const pending = isPendingGoal(goal);

  const base =
    "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold tabular-nums transition-colors disabled:cursor-default disabled:opacity-50";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Upvote (${up})`}
        title={mine === "for" ? "Take your upvote back" : "Upvote"}
        aria-pressed={mine === "for"}
        disabled={pending}
        onClick={() => onVote(mine === "for" ? null : "for")}
        className={cn(
          base,
          mine === "for" ? "border-[#222325] bg-[#e1f073] text-[#222325]" : "border-black/15 bg-white text-black/60 hover:border-[#222325] hover:text-primary"
        )}>
        <ArrowBigUp className="h-3.5 w-3.5" fill={mine === "for" ? "currentColor" : "none"} />
        {up}
      </button>
      <button
        type="button"
        aria-label={`Downvote (${down})`}
        title={mine === "against" ? "Take your downvote back" : "Downvote"}
        aria-pressed={mine === "against"}
        disabled={pending}
        onClick={() => onVote(mine === "against" ? null : "against")}
        className={cn(
          base,
          mine === "against" ? "border-[#b23c26] bg-[#fdeae6] text-[#b23c26]" : "border-black/15 bg-white text-black/60 hover:border-[#b23c26] hover:text-[#b23c26]"
        )}>
        <ArrowBigDown className="h-3.5 w-3.5" fill={mine === "against" ? "currentColor" : "none"} />
        {down}
      </button>
    </div>
  );
};

const ManageGoalsDialog: FC<ManageGoalsDialogProps> = ({ onClose, onSuggest, focusGoalId = null }) => {
  const { goals, castVote, suggestRemoval, voteMajority, memberCount } = usePod();
  // Read once on mount — feeds the 7-day voting-window math without calling
  // the impure Date.now() from render.
  const [now] = useState(() => Date.now());

  // The linked goal is ringed for a moment, then settles like the rest. The dialog is keyed by the
  // link, so a second notification remounts it and rings its own goal.
  const [ringed, setRinged] = useState(focusGoalId);
  useEffect(() => {
    if (!focusGoalId) return;
    const timer = window.setTimeout(() => setRinged(null), FOCUS_RING_MS);
    return () => window.clearTimeout(timer);
  }, [focusGoalId]);

  // Scrolled to once, when its card first mounts; later re-renders (a vote) leave the scroll alone.
  const scrolled = useRef(false);
  const focusRef = (el: HTMLDivElement | null) => {
    if (!el || scrolled.current) return;
    scrolled.current = true;
    el.scrollIntoView({ block: "center" });
  };

  const withMeta = goals
    .map((g) => ({
      ...g,
      // Clamped both ways: a proposal created while this dialog is open has a
      // proposedAt NEWER than the mount-time `now`, and floor(negative) would
      // read as "closes in 8d".
      daysLeft: g.proposedAt ? Math.min(7, Math.max(0, 7 - Math.floor((now - new Date(g.proposedAt).getTime()) / 86_400_000))) : 0,
    }))
    .filter((g) => g.status === "active" || g.daysLeft > 0);
  const activeGoals = withMeta.filter((g) => g.status === "active");
  const votingGoals = withMeta.filter((g) => g.status !== "active");
  // The link outlived its vote: the pod voted the goal out, or a suggestion ran out of time.
  const linkClosed = focusGoalId !== null && !withMeta.some((g) => g.id === focusGoalId);

  const cardProps = (goalId: string) =>
    goalId === focusGoalId ? { ref: focusRef, "data-goal-id": goalId } : { "data-goal-id": goalId };
  const ring = (goalId: string) => ringed === goalId && "ring-2 ring-[#222325] ring-offset-2";

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white br-bold duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-none items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">Pod goals</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-black/60">
                What the pod works toward together. Votes count against the whole pod: {voteMajority} of {memberCount} upvotes
                adds a goal, {voteMajority} of {memberCount} downvotes takes it off.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md bg-white text-[#222325] br-shadow-press">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-neo px-6 pb-1">
            {linkClosed && (
              <p className="mb-3 rounded-lg bg-[#f0f0ea] px-3 py-2 text-xs text-black/60">
                That vote has closed, and the goal is no longer on the list.
              </p>
            )}

            <div className="flex flex-col gap-2.5">
              {activeGoals.map((goal) => {
                const meta = GOAL_KIND_META[goal.kind];
                const Icon = meta.icon;
                const pct = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;
                return (
                  <div
                    key={goal.id}
                    {...cardProps(goal.id)}
                    className={cn("rounded-xl border border-black/10 bg-[#fbfbf7] p-4 transition-shadow", ring(goal.id))}>
                    <div className="mb-2.5 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#e1f073]">
                          <Icon className="h-4 w-4 text-[#222325]" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-primary">{goal.label}</p>
                          <p className="text-[11px] text-black/55">
                            {goal.current} of {goal.target} {goal.unit}
                          </p>
                        </div>
                      </div>
                      {goal.protected ? (
                        <span title="Every pod carries this. It can't be voted out." className="flex-none text-black/40">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => suggestRemoval(goal.id)}
                          title="Downvotes it and asks the pod to review it"
                          className="flex-none cursor-pointer text-[11px] font-semibold text-black/50 underline decoration-dotted underline-offset-2 transition-colors hover:text-[#b23c26]">
                          Suggest removing
                        </button>
                      )}
                    </div>
                    <ProgressBar value={pct} height="h-1.5" />
                  </div>
                );
              })}
            </div>

            {votingGoals.length > 0 && (
              <div className="mt-5 border-t border-black/10 pt-4 pb-1">
                <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/50">Up for a vote</p>
                <div className="flex flex-col gap-2.5">
                  {votingGoals.map((goal) => {
                    const meta = GOAL_KIND_META[goal.kind];
                    const Icon = meta.icon;
                    const adding = goal.status === "voting-add";
                    return (
                      <div
                        key={goal.id}
                        {...cardProps(goal.id)}
                        className={cn("rounded-xl border border-dashed border-black/25 bg-white p-4 transition-shadow", ring(goal.id))}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-black/50">
                            {adding && "New goal · "}
                            {goal.proposedBy ?? "You"} · closes in {goal.daysLeft}d
                          </p>
                          <Pill variant={adding ? "positive" : "urgent"}>{adding ? "Add" : "In review"}</Pill>
                        </div>
                        <div className="mb-3 flex items-center gap-2.5">
                          <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
                            <Icon className="h-4 w-4 text-[#222325]" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-primary">{goal.label}</p>
                            <p className="text-[11px] text-black/55">
                              {goal.target} {goal.unit}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <VoteButtons goal={goal} onVote={(choice) => castVote(goal.id, choice)} />
                          <p className="text-[11px] text-black/50">
                            {adding
                              ? `${voteMajority} ${voteMajority === 1 ? "upvote adds" : "upvotes add"} it.`
                              : `${voteMajority} ${voteMajority === 1 ? "upvote keeps" : "upvotes keep"} it, ${voteMajority} ${voteMajority === 1 ? "downvote removes" : "downvotes remove"} it.`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-none items-center justify-between gap-2.5 border-t border-black/10 px-6 py-4">
            <p className="text-[11px] text-black/50">Votes close after 7 days. If a vote doesn&apos;t carry, nothing changes.</p>
            <StickerButton variant="primary" size="md" onClick={onSuggest}>
              <Plus className="h-4 w-4" />
              Suggest a goal
            </StickerButton>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ManageGoalsDialog;
