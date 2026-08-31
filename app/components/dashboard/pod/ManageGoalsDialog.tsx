"use client";

import { FC, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Lock, Plus, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { usePod } from "./PodProvider";
import { GOAL_KIND_META } from "./pod-goal-meta";
import type { PodGoal } from "@/app/lib/dashboard/types";

/**
 * Goal management as a popup — the old version lived collapsed inside the
 * dark hero, where progress bars fought the ink background and voting was a
 * wall of text. Here it's on white, one goal per card, and voting is two
 * thumbs: green when you backed it, red when you didn't.
 */
export interface ManageGoalsDialogProps {
  onClose: () => void;
  /** Opens the "Suggest a goal" form (a sibling dialog owned by the page). */
  onSuggest: () => void;
}

/** Thumbs up / thumbs down. Pressed state is the whole feedback: lime for, red against. */
const VoteButtons: FC<{ goal: PodGoal; onVote: (choice: "for" | "against") => void }> = ({ goal, onVote }) => {
  const myVote = goal.votes.find((v) => v.memberName === "You");
  const forCount = goal.votes.filter((v) => v.choice === "for").length;
  const againstCount = goal.votes.filter((v) => v.choice === "against").length;

  const base =
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-default";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={myVote?.choice === "for"}
        disabled={!!myVote}
        onClick={() => onVote("for")}
        className={cn(
          base,
          myVote?.choice === "for"
            ? "border-[#222325] bg-[#e1f073] text-[#222325]"
            : "border-black/15 bg-white text-black/60",
          !myVote && "cursor-pointer hover:border-[#222325] hover:text-primary"
        )}>
        <ThumbsUp className="h-3.5 w-3.5" />
        {forCount}
      </button>
      <button
        type="button"
        aria-pressed={myVote?.choice === "against"}
        disabled={!!myVote}
        onClick={() => onVote("against")}
        className={cn(
          base,
          myVote?.choice === "against"
            ? "border-[#b23c26] bg-[#fdeae6] text-[#b23c26]"
            : "border-black/15 bg-white text-black/60",
          !myVote && "cursor-pointer hover:border-[#b23c26] hover:text-[#b23c26]"
        )}>
        <ThumbsDown className="h-3.5 w-3.5" />
        {againstCount}
      </button>
    </div>
  );
};

const ManageGoalsDialog: FC<ManageGoalsDialogProps> = ({ onClose, onSuggest }) => {
  const { goals, castVote, suggestRemoval, voteMajority } = usePod();
  // Read once on mount — feeds the 7-day voting-window math without calling
  // the impure Date.now() from render.
  const [now] = useState(() => Date.now());

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

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-none items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">Pod goals</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-black/60">
                What the pod works toward together. Changes go to a vote — {voteMajority} of 7 wins.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-neo px-6">
            <div className="flex flex-col gap-2.5">
              {activeGoals.map((goal) => {
                const meta = GOAL_KIND_META[goal.kind];
                const Icon = meta.icon;
                const pct = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;
                return (
                  <div key={goal.id} className="rounded-xl border border-black/10 bg-[#fbfbf7] p-4">
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
                        <span title="Every pod carries this — it can't be voted out." className="flex-none text-black/40">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => suggestRemoval(goal.id)}
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
                    return (
                      <div key={goal.id} className="rounded-xl border border-dashed border-black/25 bg-white p-4">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-black/50">
                            {goal.status === "voting-add" ? "New goal" : "Proposed removal"} · {goal.proposedBy ?? "You"} · closes
                            in {goal.daysLeft}d
                          </p>
                          <Pill variant={goal.status === "voting-add" ? "positive" : "urgent"}>
                            {goal.status === "voting-add" ? "Add" : "Remove"}
                          </Pill>
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
                        <VoteButtons goal={goal} onVote={(choice) => castVote(goal.id, choice)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-none items-center justify-between gap-2.5 border-t border-black/10 px-6 py-4">
            <p className="text-[11px] text-black/50">Proposals that never win quietly expire after 7 days.</p>
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
